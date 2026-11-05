import { DefaultStackSynthesizer, Stack, type StackProps } from 'aws-cdk-lib';
import { PolicyStatement, User } from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export class CiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const qualifier = DefaultStackSynthesizer.DEFAULT_QUALIFIER;

    const deployer = new User(this, 'GitHubDeployer', {
      userName: 'github-deployer',
    });

    deployer.addToPolicy(
      new PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-${qualifier}-*-${this.account}-${this.region}`],
      }),
    );
  }
}
