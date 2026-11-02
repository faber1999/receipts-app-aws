import { App, Tags } from "aws-cdk-lib";

const app = new App();
Tags.of(app).add("project", "receipts-app");
