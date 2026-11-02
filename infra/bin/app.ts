import { App, Tags } from "aws-cdk-lib";
import { PlaygroundStack } from "../lib/playground-stack";

const app = new App();

Tags.of(app).add("project", "receipts-app");

new PlaygroundStack(app, "PlaygroundStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-2",
  },
});
