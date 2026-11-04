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
import type { Construct } from 'constructs';

export interface ApiStackProps extends StackProps {
  userPool: IUserPool;
  userPoolClient: IUserPoolClient;
  table: ITableV2;
  allowedOrigins: string[];
}

const HANDLERS_DIR = join(import.meta.dirname, '../../../services/api/src/expenses/handlers');

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const createHandler = (name: string, file: string): NodejsFunction =>
      new NodejsFunction(this, `${name}Function`, {
        entry: join(HANDLERS_DIR, file),
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        memorySize: 256,
        timeout: Duration.seconds(10),
        environment: { TABLE_NAME: props.table.tableName },
        bundling: { minify: true },
        logGroup: new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.ONE_WEEK,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      });

    const listExpenses = createHandler('ListExpenses', 'list-expenses.ts');
    props.table.grantReadData(listExpenses);

    const createExpense = createHandler('CreateExpense', 'create-expense.ts');
    props.table.grantWriteData(createExpense);

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

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
  }
}
