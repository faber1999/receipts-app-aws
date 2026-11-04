import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AccountRecovery, FeaturePlan, UserPool, type UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';

export class AuthStack extends Stack {
  public readonly userPool: UserPool;
  public readonly webClient: UserPoolClient;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.userPool = new UserPool(this, 'UserPool', {
      featurePlan: FeaturePlan.LITE,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.webClient = this.userPool.addClient('WebClient', {
      authFlows: { userSrp: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      disableOAuth: true,
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'WebClientId', {
      value: this.webClient.userPoolClientId,
    });
  }
}
