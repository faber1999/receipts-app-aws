import { join } from 'node:path';
import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import type { ITableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Match, Rule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import {
  Choice,
  Condition,
  DefinitionBody,
  Fail,
  Pass,
  QueryLanguage,
  StateMachine,
  StateMachineType,
  Succeed,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import {
  DynamoAttributeValue,
  DynamoUpdateItem,
  LambdaInvoke,
  SqsSendMessage,
} from 'aws-cdk-lib/aws-stepfunctions-tasks';
import type { Construct } from 'constructs';

export interface ProcessingStackProps extends StackProps {
  table: ITableV2;
  receiptsBucket: IBucket;
}

const API_SRC_DIR = join(import.meta.dirname, '../../../services/api/src');

/** SSM SecureString created by hand (CDK can't create SecureStrings): the Anthropic API key. */
const ANTHROPIC_API_KEY_PARAMETER = '/receipts-app/anthropic-api-key';

const CONDITION_FAILED = 'DynamoDB.ConditionalCheckFailedException';

export class ProcessingStack extends Stack {
  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    // --- Extraction Lambda ---------------------------------------------------------------
    const extractReceipt = new NodejsFunction(this, 'ExtractReceiptFunction', {
      entry: join(API_SRC_DIR, 'receipts/handlers/extract-receipt.ts'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      // The photo is held in memory and base64-encoded; the model call can take several seconds.
      memorySize: 512,
      timeout: Duration.seconds(60),
      environment: { ANTHROPIC_API_KEY_PARAMETER },
      bundling: { minify: true },
      logGroup: new LogGroup(this, 'ExtractReceiptLogs', {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    props.receiptsBucket.grantRead(extractReceipt, 'receipts/*');
    StringParameter.fromSecureStringParameterAttributes(this, 'AnthropicApiKey', {
      parameterName: ANTHROPIC_API_KEY_PARAMETER,
    }).grantRead(extractReceipt);

    // --- Dead-letter queue: receipts that failed for an unexpected reason -----------------
    const deadLetterQueue = new Queue(this, 'ProcessingDeadLetterQueue', {
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: Duration.days(14),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // --- Workflow --------------------------------------------------------------------------
    const receiptKey = {
      PK: DynamoAttributeValue.fromString('{% "USER#" & $userId %}'),
      SK: DynamoAttributeValue.fromString('{% "RECEIPT#" & $receiptId %}'),
    };

    // 1. Keep what the S3 event says as variables, available to every later state.
    //    Key format: receipts/<userId>/<receiptId>.<ext>
    const readEvent = Pass.jsonata(this, 'ReadEvent', {
      assign: {
        bucket: '{% $states.input.detail.bucket.name %}',
        key: '{% $states.input.detail.object.key %}',
        userId: "{% $split($states.input.detail.object.key, '/')[1] %}",
        receiptId: "{% $substringBefore($split($states.input.detail.object.key, '/')[2], '.') %}",
      },
    });

    // 2. Read the photo with Claude.
    const extract = LambdaInvoke.jsonata(this, 'ExtractReceipt', {
      lambdaFunction: extractReceipt,
      payload: TaskInput.fromObject({ bucket: '{% $bucket %}', key: '{% $key %}' }),
      assign: { expense: '{% $states.result.Payload.expense %}' },
    });

    // 3. Save the data. Only a PENDING item is updated: a duplicate event or a deleted expense is a no-op.
    const saveExpense = DynamoUpdateItem.jsonata(this, 'SaveExpense', {
      table: props.table,
      key: receiptKey,
      updateExpression:
        'SET #status = :processed, #merchant = :merchant, #total = :total, #currency = :currency, #date = :date, #category = :category, #GSI1SK = :gsi1sk',
      conditionExpression: '#status = :pending',
      expressionAttributeNames: {
        '#status': 'status',
        '#merchant': 'merchant',
        '#total': 'total',
        '#currency': 'currency',
        '#date': 'date',
        '#category': 'category',
        '#GSI1SK': 'GSI1SK',
      },
      expressionAttributeValues: {
        ':processed': DynamoAttributeValue.fromString('PROCESSED'),
        ':pending': DynamoAttributeValue.fromString('PENDING'),
        ':merchant': DynamoAttributeValue.fromString('{% $expense.merchant %}'),
        ':total': DynamoAttributeValue.numberFromString('{% $string($expense.total) %}'),
        ':currency': DynamoAttributeValue.fromString('{% $expense.currency %}'),
        ':date': DynamoAttributeValue.fromString('{% $expense.date %}'),
        ':category': DynamoAttributeValue.fromString('{% $expense.category %}'),
        ':gsi1sk': DynamoAttributeValue.fromString('{% "DATE#" & $expense.date %}'),
      },
    });

    // Failure path: mark the receipt FAILED, then decide whether it needs attention.
    const markFailed = DynamoUpdateItem.jsonata(this, 'MarkFailed', {
      table: props.table,
      key: receiptKey,
      updateExpression: 'SET #status = :failed',
      conditionExpression: '#status = :pending',
      expressionAttributeNames: { '#status': 'status' },
      expressionAttributeValues: {
        ':failed': DynamoAttributeValue.fromString('FAILED'),
        ':pending': DynamoAttributeValue.fromString('PENDING'),
      },
    });

    const sendToDeadLetterQueue = SqsSendMessage.jsonata(this, 'SendToDeadLetterQueue', {
      queue: deadLetterQueue,
      messageBody: TaskInput.fromText(
        '{% $string({"bucket": $bucket, "key": $key, "receiptId": $receiptId, "error": $error}) %}',
      ),
    });

    // An unreadable photo is an expected outcome (the user sees FAILED); anything else goes to the DLQ.
    const isUnreadable = Choice.jsonata(this, 'IsUnreadable')
      .when(
        Condition.jsonata('{% $error.Error = "UnreadableReceiptError" %}'),
        Succeed.jsonata(this, 'ReceiptUnreadable'),
      )
      .otherwise(
        sendToDeadLetterQueue.next(
          Fail.jsonata(this, 'ProcessingFailed', {
            error: 'ReceiptProcessingFailed',
            cause: 'See the dead-letter queue',
          }),
        ),
      );

    markFailed.addCatch(isUnreadable, { errors: [CONDITION_FAILED] });
    markFailed.next(isUnreadable);

    const keepError = { error: '{% $states.errorOutput %}' };
    extract.addCatch(Succeed.jsonata(this, 'IgnoreObject'), { errors: ['NotAReceiptError', 'ReceiptDeletedError'] });
    extract.addCatch(markFailed, { errors: ['States.ALL'], assign: keepError });
    saveExpense.addCatch(Succeed.jsonata(this, 'AlreadyHandled'), { errors: [CONDITION_FAILED] });
    saveExpense.addCatch(markFailed, { errors: ['States.ALL'], assign: keepError });

    const stateMachine = new StateMachine(this, 'ReceiptProcessing', {
      stateMachineType: StateMachineType.STANDARD,
      queryLanguage: QueryLanguage.JSONATA,
      timeout: Duration.minutes(5),
      definitionBody: DefinitionBody.fromChainable(
        readEvent.next(extract).next(saveExpense).next(Succeed.jsonata(this, 'ReceiptProcessed')),
      ),
    });

    // --- Trigger: a photo uploaded under receipts/ ------------------------------------------
    new Rule(this, 'ReceiptUploadedRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [props.receiptsBucket.bucketName] },
          object: { key: Match.prefix('receipts/') },
        },
      },
      targets: [new SfnStateMachine(stateMachine)],
    });
  }
}
