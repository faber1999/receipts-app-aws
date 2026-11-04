# @receipts-app/web

The Receipts App website: Next.js 16 (App Router) with `output: 'export'`, so it builds to static files that are served from S3 through CloudFront. It has no server. Authentication goes straight to Cognito through Amplify Auth, and data comes from the HTTP API.

## Environment

Copy `.env.example` to `.env.local` and fill it with the stack outputs:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_USER_POOL_ID` | `AuthStack` → `UserPoolId` |
| `NEXT_PUBLIC_USER_POOL_CLIENT_ID` | `AuthStack` → `WebClientId` |
| `NEXT_PUBLIC_API_URL` | `ApiStack` → `ApiUrl` |

These values are public: they end up in the JavaScript bundle. They are validated with Zod at build time (`src/lib/env.ts`), so a missing or malformed value fails the build. Never put a secret in a `NEXT_PUBLIC_` variable.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server on http://localhost:3000 |
| `pnpm build` | Static export to `out/` (also type-checks), then `scripts/fix-static-export-segments.mjs` |
| `pnpm test` | Unit tests (Vitest) |

From the repository root, prefix them with `pnpm --filter @receipts-app/web`.

## Pages

| Route | What it shows | Access |
|---|---|---|
| `/` | Landing | Visitors only; signed-in users are redirected to `/expenses` |
| `/sign-up`, `/confirm-sign-up`, `/sign-in`, `/forgot-password` | Auth flows (`app/(auth)/` route group) | Visitors only |
| `/expenses` | Monthly expenses, category totals, and create / edit / delete | Signed-in users |

These guards are a UX convenience only. The real protection is the API rejecting requests without a valid Cognito JWT.

## Structure

```
src/
├─ app/                Routes only (page.tsx, layouts); auth routes in the (auth) group
├─ features/
│  ├─ auth/            AuthProvider (session state), forms, schemas, guest-only redirect
│  ├─ expenses/        API calls, month cache, summary logic, screen components
│  └─ home/
├─ components/         Site shell, account menu, language switcher
│  └─ ui/              Primitives: Button, TextField, PasswordField, OtpField, MoneyField,
│                      Select, Dialog, Menu, Tooltip, Toast…
├─ i18n/               Typed dictionaries (en default, es) and the locale provider
└─ lib/                API client, money formatting, env validation, helpers
```

## Conventions

- **i18n:** all user-facing text lives in `src/i18n/dictionaries/`, read with `useI18n()`. `es.ts` is typed as the English `Dictionary`, so a missing translation is a type error. Validation and API errors are dictionary keys, translated when rendered.
- **Contracts:** API data is parsed with the shared Zod schemas from `@receipts-app/contracts` (see `src/features/expenses/api.ts`).
- **API client:** `src/lib/api-client.ts` adds the access token from `fetchAuthSession()`, which refreshes it when it has expired.
- **Money:** all currency formatting goes through `src/lib/money.ts`. Symbol placement follows the locale, and a mixed-currency view switches to unambiguous symbols.
- **Design system:**
  - light theme only; tokens are defined in `src/app/globals.css` (Tailwind v4 `@theme`)
  - WCAG 2.2 AA contrast
  - shared entrance motion (`animate-rise` + `stagger-N`) that respects reduced motion
  - no native `title` tooltips: use `<Tooltip>`
- **Security:** CloudFront serves the site with a CSP whose `connect-src` only allows the API and Cognito. Calling a new origin with `fetch` needs a change to `WebStack`.

## Windows build workaround

`next build` on Windows writes the router's segment prefetch files as nested folders instead of dot-separated names, which causes 404s for prefetches in the deployed site. `scripts/fix-static-export-segments.mjs` flattens them after the build, and does nothing on Linux or macOS.

The upstream issue is [vercel/next.js#85374](https://github.com/vercel/next.js/issues/85374), with a fix proposed in PR #92340. Remove the script once a Next.js release includes the fix.
