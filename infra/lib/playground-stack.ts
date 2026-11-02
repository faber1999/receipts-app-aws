import { RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export class PlaygroundStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new Bucket(this, "PlaygroundBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}
