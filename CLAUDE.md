# Receipts App

Gestor de gastos a partir de fotos de recibos. El usuario sube una foto, la app extrae los datos (comercio, total, fecha, categoría) con IA, los guarda y muestra un resumen de gastos.

## Objetivo del proyecto

- Proyecto de **portafolio** y **práctica de AWS** para las certificaciones Solutions Architect Associate, Developer Associate, y bases de DevOps Pro y GenAI Developer Pro.
- Dominio deliberadamente simple; la complejidad está en la arquitectura AWS.
- Debe mantenerse **dentro del free tier / centavos al mes**.

## Funcionalidades (alcance cerrado)

1. Registro / login
2. Subir foto de un recibo
3. Ver lista de gastos (editar, borrar) y totales por categoría
4. Recibir un resumen mensual por email

No agregar funcionalidades fuera de este alcance sin pedirlo.

## Stack

- **Lenguaje:** TypeScript estricto en todo el repo (`strict: true`, sin `any`, sin `as` innecesarios)
- **Infra:** AWS CDK v2 (TypeScript)
- **Frontend:** Next.js con export estático, servido desde S3 + CloudFront
- **Backend:** AWS Lambda (Node.js LTS, TypeScript, bundling con esbuild vía `NodejsFunction`)
- **Validación y contratos:** Zod; tipos inferidos con `z.infer`, compartidos entre front, back e infra
- **Observabilidad:** Powertools for AWS Lambda (TypeScript): Logger, Metrics, Tracer
- **Tests:** Vitest (lógica) + `aws-cdk-lib/assertions` (infra)
- **Monorepo:** pnpm workspaces
- **CI/CD:** GitHub Actions con OIDC hacia AWS (sin access keys)

## Arquitectura

```
Next.js (S3 + CloudFront)
        │
   API Gateway (HTTP API) ──► Cognito (JWT authorizer)
        │
     Lambdas (CRUD) ──► DynamoDB (single-table)
        │
   Lambda: genera presigned URL ──► S3 (bucket de recibos)
                                        │
                           EventBridge (Object Created)
                                        │
                  Step Functions:
                    1. Bedrock extrae datos de la imagen (JSON)
                    2. Validación con Zod
                    3. Guarda en DynamoDB (status: PROCESSED)
                    4. Si falla → status: FAILED + mensaje a SQS DLQ

   EventBridge Scheduler (mensual) ──► Lambda resumen ──► SES
```

## Servicios AWS y su propósito

| Funcionalidad | Servicios |
|---|---|
| Autenticación | Cognito User Pool |
| API | API Gateway HTTP API + Lambda |
| Persistencia | DynamoDB (single-table, on-demand) |
| Subida de imágenes | S3 + presigned URLs |
| Procesamiento async | EventBridge + Step Functions |
| Extracción con IA | Amazon Bedrock (modelo multimodal económico) |
| Errores y reintentos | SQS + DLQ |
| Resumen mensual | EventBridge Scheduler + Lambda + SES |
| Hosting frontend | S3 + CloudFront (+ ACM y dominio propio) |
| Configuración/secretos | SSM Parameter Store |
| Observabilidad | CloudWatch, X-Ray, Powertools |
| Seguridad | IAM least-privilege; WAF solo para práctica temporal |

## Modelo de datos (DynamoDB single-table)

| Entidad | PK | SK |
|---|---|---|
| Recibo/gasto | `USER#<userId>` | `RECEIPT#<receiptId>` |

Atributos: `merchant`, `total`, `currency`, `date`, `category`, `imageKey`, `status` (`PENDING` / `PROCESSED` / `FAILED`), `createdAt`.
GSI opcional para consultar por usuario y mes: `GSI1PK = USER#<userId>`, `GSI1SK = DATE#<yyyy-mm-dd>`.

## Estructura del repositorio

```
receipts-app/
├─ packages/
│  └─ contracts/      # schemas Zod + tipos compartidos
├─ apps/
│  └─ web/            # Next.js (export estático)
├─ services/
│  └─ api/            # handlers Lambda
└─ infra/             # CDK app y stacks
```

Stacks CDK sugeridos: `AuthStack`, `DataStack`, `ApiStack`, `ProcessingStack`, `WebStack`, `NotificationsStack`.

## Fases

1. **Base:** monorepo, CDK bootstrap, Cognito, front en CloudFront
2. **API:** CRUD de gastos con API Gateway + Lambda + DynamoDB
3. **Procesamiento:** presigned URLs, EventBridge, Step Functions, Bedrock
4. **Resiliencia y notificaciones:** DLQ, reintentos, idempotencia, resumen mensual con SES
5. **Operación:** CI/CD con GitHub Actions + OIDC, observabilidad, alarmas, README con diagrama y estimación de costos

## Reglas de costos (obligatorias)

- **Nunca** crear NAT Gateway, instancias EC2, RDS ni VPC con subnets privadas.
- DynamoDB en modo on-demand.
- Usar SSM Parameter Store en lugar de Secrets Manager.
- WAF y Route 53 hosted zones solo si se piden explícitamente (tienen costo fijo).
- Bedrock: usar el modelo multimodal más barato disponible en la región.
- Todos los recursos deben poder eliminarse con `cdk destroy` (`RemovalPolicy.DESTROY` y `autoDeleteObjects` en entornos `dev`).
- Etiquetar todos los recursos con `project=receipts-app`.

## Convenciones de código

- TypeScript estricto, tipos explícitos en límites públicos (handlers, props de constructs).
- Validar todo input externo (API, eventos, respuesta de Bedrock) con Zod.
- Handlers delgados: lógica de negocio en funciones puras testeables.
- Un construct de CDK por responsabilidad; no meter todo en un solo stack.
- IAM: usar `grant*` de CDK, nunca políticas con `*`.
- Respuestas y explicaciones concisas.
