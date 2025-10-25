## Reddit Sentiment Analyzer (GA Stack)

This directory hosts the Next.js 14 front-end for the Reddit Sentiment Analyzer described in `implementation.md` and `PRD.md`. The project targets only generally available releases.

### Prerequisites

- Node.js 20.x (LTS). A local portable build is committed under `node-v20.11.1-darwin-arm64/` for development on macOS arm64. Add its `bin` folder to your `PATH` before running scripts:  
  `export PATH="$(pwd)/node-v20.11.1-darwin-arm64/bin:$PATH"`
- npm 10 (bundled with Node 20).
- A Supabase project with Postgres 15, storage, and edge functions enabled.

### Environment Variables

Copy `.env.example` to `.env.local` and provide values:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Base URL for server actions to call internal APIs. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (anon). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon API key for client components. |
| `SUPABASE_URL` | Supabase URL used by server-only code. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for Route Handlers / Server Actions. |
| `SUPABASE_SERVICE_ROLE_JWT` | Optional JWT for invoking Edge Functions. |
| `SUPABASE_EDGE_FUNCTION_URL` | Base URL for the `sentiment-refresh` function. |

Never expose the service role key to the browser.

### Install Dependencies

```bash
npm install
```

### Supabase Tooling

- The Supabase CLI is installed locally (`npm install --save-dev supabase`).
- Project scaffolding lives in `../supabase/`:
  - `config.toml` – CLI configuration.
  - `migrations/` – SQL schema derived from `implementation.md`.
  - `seed.sql` – Inserts the default subreddit list.
  - `functions/sentiment-refresh/index.ts` – Edge Function stub that enqueues refresh jobs (placeholder for Reddit/VADER pipeline).

Run migrations locally (requires Docker or a Supabase connection):

```bash
npx supabase db reset --env-file ./web/.env.local
```

Deploy or test the edge function:

```bash
# Local serve (uses env vars from .env.local)
npx supabase functions serve sentiment-refresh --env-file ./web/.env.local

# Deploy to Supabase
npx supabase functions deploy sentiment-refresh --env-file ./web/.env.local
```

After deployment, copy the invoke URL into `SUPABASE_EDGE_FUNCTION_URL` and (optionally) the function JWT into `SUPABASE_SERVICE_ROLE_JWT`.

### Access Model

- Row Level Security (RLS) is intentionally disabled on the sentiment tables because v1 exposes data publicly without user-specific access control. Supabase will surface an RLS warning in the dashboard; acknowledge it for this project or enable policies once authentication is introduced.
- Edge Function secrets include only service-role credentials. Do not expose these in browsers or logs.

### Local Development

```bash
npm run dev
```

The app becomes available at [http://localhost:3000](http://localhost:3000).

### Project Layout Highlights

- `app/` &mdash; App Router pages, including placeholders for dashboard, comparison, posts, methodology, and API routes.
- `actions/` &mdash; Server Action stubs (e.g., refresh sentiment trigger).
- `lib/supabase/` &mdash; Supabase client factories for server and browser contexts.
- `components/` &mdash; shadcn/ui primitives plus layout scaffolding.

### Next Steps

1. Apply the Supabase migrations/seed (`npx supabase db reset`) and deploy the `sentiment-refresh` Edge Function, then set `SUPABASE_EDGE_FUNCTION_URL`.
2. Connect the dashboard UI to the refresh API, surface job activity, and render real sentiment data (charts, tables, etc.).
3. Harden the data pipeline with additional error handling/monitoring and schedule the nightly cron if desired.
4. Add automated tests (Vitest + React Testing Library) covering utilities and key UI flows.

Deployment is expected on Vercel using the same Node.js 20 runtime and Supabase environment variables.
