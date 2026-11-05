# @receipts-app/infra

AWS CDK v2 app (TypeScript) that defines every AWS resource of Receipts App. All stacks deploy to `us-east-2` and every resource is tagged `project=receipts-app`.

## Stacks

| Stack | Resources | Depends on |
|---|---|---|
| `AuthStack` | Cognito User Pool (Lite plan, email sign-in, email-only recovery) and the web app client (SRP, no secret, OAuth disabled, 1 h access / 7 d refresh tokens, revocation) | — |
| `DataStack` | DynamoDB table (on-demand, `PK`/`SK` + `GSI1`) and the private receipts bucket (EventBridge notifications, CORS for browser `POST` uploads) | — |
| `ApiStack` | API Gateway HTTP API with a Cognito JWT authorizer as the default; one Lambda per route, each with its own role and a one-week log group | Auth, Data |
| `WebStack` | Private site bucket, CloudFront distribution (OAC, HTTPS redirect, URL rewrite function, security headers policy) and the deployment of `apps/web/out` | Api |
| `CiStack` | The `github-deployer` IAM user for GitHub Actions. Its only permission is `sts:AssumeRole` on the CDK bootstrap roles; its access key is created by hand in the console, never in the stack | — |

Cross-stack references (for example the table passed to `ApiStack`) become CloudFormation exports and imports. An exported value can't be removed while another stack still imports it.

## Layout

```
infra/
├─ bin/app.ts                 Entry point: creates the CDK app
├─ lib/create-stacks.ts       Creates and wires every stack (shared by bin/ and the tests)
├─ lib/stacks/                One file per stack
├─ lib/edge-functions/        CloudFront Functions (plain JS: CloudFront runs them as-is)
└─ test/                      CDK assertion tests
```

## Commands

Run from `infra/`. Credentials come from `aws login`.

| Command | What it does |
|---|---|
| `pnpm exec cdk synth` | Generate the CloudFormation templates into `cdk.out/` (local only) |
| `pnpm exec cdk diff` | Compare every stack with what is deployed (all stacks by default) |
| `pnpm exec cdk deploy <Stack>` | Deploy one stack (and the stacks it depends on) |
| `pnpm exec cdk deploy --all` | Deploy every stack in dependency order |
| `pnpm exec cdk destroy <Stack>` | Delete a stack and its resources |
| `pnpm test` | Run the infrastructure tests |

Two habits:
- **Always read `cdk diff` before deploying.** Look for `replace` on resources that hold data or a public identity (table, buckets, user pool, distribution), and review every IAM change.
- **Run `pnpm typecheck` from the root first.** CDK runs `bin/app.ts` through `tsx`, which transpiles without type-checking.

`WebStack` packages `apps/web/out`, so build the web before synthesizing or testing:

```bash
pnpm --filter @receipts-app/web build
```

## Outputs

| Stack | Output | Used by |
|---|---|---|
| `AuthStack` | `UserPoolId`, `WebClientId` | `apps/web/.env.local` |
| `ApiStack` | `ApiUrl` | `apps/web/.env.local`, the API smoke test |
| `WebStack` | `SiteUrl` | Browser |

```bash
aws cloudformation describe-stacks --stack-name AuthStack --query "Stacks[0].Outputs" --output table
```

## Tests

`test/stacks.test.ts` synthesizes the real app (through `createStacks`) with a fixed fake account, so it needs no AWS credentials, and asserts the project rules:

- the table is on-demand and has `GSI1`
- buckets block all public access; the receipts bucket only allows `POST` uploads and sends events to EventBridge
- every API route uses the JWT authorizer
- every Lambda runs on Node.js 24 and arm64
- every API log group keeps logs for one week
- no IAM statement in the API grants `*`
- CloudFront redirects to HTTPS and sends CSP and HSTS
- resources are tagged with the project name

## Notes

- **Custom-resource log groups:** custom-resource Lambdas that CDK adds (bucket auto-delete, bucket notifications) create their own log groups at runtime. Those are not managed by the stack and are left behind after `cdk destroy`.
- **Deleting `CiStack`:** delete the `github-deployer` access key first. CloudFormation can't delete a user that still has an access key it didn't create.
- **Invalidation permission:** `BucketDeployment` grants `cloudfront:CreateInvalidation` on `*`. That is a CDK limitation, scoped to the deployment helper Lambda.
