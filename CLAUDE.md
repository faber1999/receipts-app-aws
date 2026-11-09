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
  - **Excepción temporal:** la SCP del plan Free niega `iam:CreateOpenIDConnectProvider`. Mientras tanto se despliega con la access key del usuario `github-deployer` (`CiStack`), cuyo único permiso es `sts:AssumeRole` sobre los roles de bootstrap de CDK; la key vive en el environment `production` de GitHub, limitado a `main`. Al pasar al plan de pago: crear el rol OIDC, borrar la key y el usuario.

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
                    1. Lambda extrae datos de la imagen con Claude (API de Anthropic, JSON)
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
| Extracción con IA | API de Anthropic (Claude Haiku 5.5) desde Lambda; API key en SSM SecureString. Ver "Extracción con IA" abajo |
| Errores y reintentos | SQS + DLQ |
| Resumen mensual | EventBridge Scheduler + Lambda + SES |
| Hosting frontend | S3 + CloudFront (+ ACM y dominio propio) |
| Configuración/secretos | SSM Parameter Store |
| Observabilidad | CloudWatch, X-Ray, Powertools |
| Seguridad | IAM least-privilege; WAF solo para práctica temporal |

### Extracción con IA: por qué no Bedrock

- **Plan original:** Amazon Bedrock (Nova Lite en `us-east-2`).
- **Por qué cambió:** la cuenta es nueva (plan Free) y todas sus cuotas de inferencia de Bedrock están en 0. AWS Support rechazó el aumento (noviembre 2026) hasta que la cuenta tenga más historial de uso. Textract también está negado por SCP.
- **Alternativa actual:** la Lambda `extract-receipt` llama a la API de Anthropic con `@anthropic-ai/sdk`:
  - Modelo `claude-haiku-5-5` (el más barato con visión), `effort: 'low'`, structured outputs con el schema Zod `receiptExtractionSchema` de `contracts`.
  - Costo aproximado: $0.0004 por recibo. Se paga con los créditos mensuales de API del plan Max del usuario. La organización de la Claude Console tiene un límite de gasto de $10 al mes; al agotarse, las llamadas fallan sin cobro extra.
  - API key de una cuenta de servicio (`receipts-app`, workspace `personal-projects`, vence 2027-02-28) guardada en SSM SecureString `/receipts-app/anthropic-api-key`. Se lee con Powertools Parameters (caché de 5 min). Nunca va en código, variables de entorno ni CloudFormation.
- **Para volver a Bedrock:** el extractor es el tipo `ReceiptExtractor` (`services/api/src/receipts/receipt-extractor.ts`); basta con otra implementación. Reintentar la solicitud de cuota cuando la cuenta tenga más uso.

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

Organización por feature dentro de cada paquete:

- `packages/contracts/src/<feature>/`: schemas Zod de cada dominio (ej. `expenses/`), reexportados en `index.ts`.
- `services/api/src/<feature>/`: `handlers/` (un archivo por Lambda) y la lógica del dominio (ej. `expense-repository.ts`); lo común en `shared/`.
- `apps/web/src/app/`: solo rutas (`page.tsx`, layouts; las de auth en el route group `(auth)`). Componentes y lógica de cada feature en `src/features/<feature>/`; UI compartida en `src/components/` (`ui/` para primitivos); utilidades en `src/lib/`.
- `infra/lib/stacks/`: un archivo por stack; `infra/lib/edge-functions/`: CloudFront Functions.

Stacks CDK sugeridos: `AuthStack`, `DataStack`, `ApiStack`, `ProcessingStack`, `WebStack`, `NotificationsStack`.

## Fases

1. **Base:** monorepo, CDK bootstrap, Cognito, front en CloudFront
2. **API:** CRUD de gastos con API Gateway + Lambda + DynamoDB
3. **Procesamiento:** presigned URLs, EventBridge, Step Functions, extracción con IA (Claude vía API de Anthropic)
4. **Resiliencia y notificaciones:** DLQ, reintentos, idempotencia, resumen mensual con SES
5. **Operación:** CI/CD con GitHub Actions + OIDC, observabilidad, alarmas, README con diagrama y estimación de costos

## Reglas de costos (obligatorias)

- **Nunca** crear NAT Gateway, instancias EC2, RDS ni VPC con subnets privadas.
- DynamoDB en modo on-demand.
- Usar SSM Parameter Store en lugar de Secrets Manager.
- WAF y Route 53 hosted zones solo si se piden explícitamente (tienen costo fijo).
- Extracción con IA: usar el modelo con visión más barato (hoy `claude-haiku-5-5`, `effort: 'low'`) y mantener el límite de gasto de la Claude Console.
- Todos los recursos deben poder eliminarse con `cdk destroy` (`RemovalPolicy.DESTROY` y `autoDeleteObjects` en entornos `dev`).
- Etiquetar todos los recursos con `project=receipts-app`.

## Convenciones de código

- TypeScript estricto, tipos explícitos en límites públicos (handlers, props de constructs).
- Validar todo input externo (API, eventos, respuesta del modelo de IA) con Zod.
- Handlers delgados: lógica de negocio en funciones puras testeables.
- Un construct de CDK por responsabilidad; no meter todo en un solo stack.
- IAM: usar `grant*` de CDK, nunca políticas con `*`.
- Respuestas y explicaciones concisas.
