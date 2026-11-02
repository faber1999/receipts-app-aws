import { App, Tags } from "aws-cdk-lib";
import { AuthStack } from "../lib/auth-stack";

const app = new App();
Tags.of(app).add("project", "receipts-app");

new AuthStack(app, "AuthStack", {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-2" },
});
