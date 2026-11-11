import { join } from 'node:path';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { IUserPool, IUserPoolClient } from 'aws-cdk-lib/aws-cognito';
import type { ITableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface ApiStackProps extends StackProps {
  userPool: IUserPool;
  userPoolClient: IUserPoolClient;
  table: ITableV2;
  receiptsBucket: IBucket;
  allowedOrigins: string[];
}

const API_SRC_DIR = join(import.meta.dirname, '../../../services/api/src');
export class ApiStack extends Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const createHandler = (name: string, file: string): NodejsFunction =>
      new NodejsFunction(this, `${name}Function`, {
        entry: join(API_SRC_DIR, file),
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: {
          TABLE_NAME: props.table.tableName,
          RECEIPTS_BUCKET: props.receiptsBucket.bucketName,
        },
        bundling: { minify: true },
        logGroup: new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.ONE_WEEK,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      });

    const listExpenses = createHandler('ListExpenses', 'expenses/handlers/list-expenses.ts');
    props.table.grantReadData(listExpenses);

    const createExpense = createHandler('CreateExpense', 'expenses/handlers/create-expense.ts');
    props.table.grantWriteData(createExpense);

    const updateExpense = createHandler('UpdateExpense', 'expenses/handlers/update-expense.ts');
    props.table.grantWriteData(updateExpense);

    const confirmExpense = createHandler('ConfirmExpense', 'expenses/handlers/confirm-expense.ts');
    props.table.grant(confirmExpense, 'dynamodb:UpdateItem');

    const deleteExpense = createHandler('DeleteExpense', 'expenses/handlers/delete-expense.ts');
    props.table.grantWriteData(deleteExpense);
    props.receiptsBucket.grantDelete(deleteExpense, 'receipts/*');

    const createReceiptUpload = createHandler('CreateReceiptUpload', 'receipts/handlers/create-receipt-upload.ts');
    props.table.grantWriteData(createReceiptUpload);
    props.receiptsBucket.grantPut(createReceiptUpload, 'receipts/*');

    const getReceiptPhoto = createHandler('GetReceiptPhoto', 'receipts/handlers/get-receipt-photo.ts');
    props.table.grant(getReceiptPhoto, 'dynamodb:GetItem');
    props.receiptsBucket.grantRead(getReceiptPhoto, 'receipts/*');

    const authorizer = new HttpUserPoolAuthorizer('CognitoAuthorizer', props.userPool, {
      userPoolClients: [props.userPoolClient],
    });

    const api = new HttpApi(this, 'HttpApi', {
      defaultAuthorizer: authorizer,
      corsPreflight: {
        allowOrigins: props.allowedOrigins,
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PATCH, CorsHttpMethod.DELETE],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.hours(1),
      },
    });

    this.apiUrl = api.apiEndpoint;

    api.addRoutes({
      path: '/expenses',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('ListExpensesIntegration', listExpenses),
    });
    api.addRoutes({
      path: '/expenses',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateExpenseIntegration', createExpense),
    });

    api.addRoutes({
      path: '/expenses/{id}',
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration('UpdateExpenseIntegration', updateExpense),
    });

    api.addRoutes({
      path: '/expenses/{id}',
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('DeleteExpenseIntegration', deleteExpense),
    });

    api.addRoutes({
      path: '/expenses/{id}/confirm',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('ConfirmExpenseIntegration', confirmExpense),
    });
    api.addRoutes({
      path: '/expenses/{id}/receipt',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetReceiptPhotoIntegration', getReceiptPhoto),
    });

    api.addRoutes({
      path: '/receipts',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateReceiptUploadIntegration', createReceiptUpload),
    });

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
  }
}
