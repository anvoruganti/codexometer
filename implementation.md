# Reddit Sentiment Analyzer – Implementation Plan

## Goals & Stack
- Deliver the PRD feature set on a single Next.js 15.5.4 app using the App Router and React 19 server/client components.
- Style the UI with shadcn/ui 2.1.3 primitives (Card, Tabs, Table, Chart wrappers) composed with Tailwind CSS.
- Use Supabase (Postgres, Edge Functions, Storage, Cron) as the backend for data persistence, scheduled jobs, and secrets management.
- Run sentiment scoring inside a Supabase Edge Function using VADER (via `deno-nlp` port) to keep the pipeline transparent and reproducible.

## High-Level Architecture
1. **Next.js frontend** renders dashboards, comparison views, methodology content, and admin controls. All data-fetching uses Server Components, Server Actions, and route handlers for cache-aware hydration.
2. **Supabase Postgres** stores subreddit metadata, raw Reddit payloads (posts/comments), sentiment scores, and pre-aggregated trend snapshots. Row level security (RLS) remains disabled because there is no user login in v1.
3. **Supabase Edge Function `sentiment-refresh`** orchestrates Reddit ingestion, sentiment scoring, aggregation, and persistence. It accepts timeframe and optional keyword parameters, returns refresh metadata, and logs progress.
4. **Supabase Cron** optionally triggers nightly refreshes so that a manual refresh yields fast results (refresh button still calls the same Edge Function).
5. **Next.js Route Handlers** (`app/api/*`) proxy signed requests to the Edge Function, stream status updates to the client, and expose JSON for charts/tables.

```
User click → Next.js Server Action → /api/refresh → Supabase Edge Function
      ↳ Edge Function fetches Reddit API → scores sentiment → upserts tables → aggregates view
      ↳ Next.js fetches aggregated data for charts → renders via Server Components → client hydration
```

## Data Flow
1. **Manual/Scheduled Refresh**
   - Client invokes a Server Action (`refreshSentiment`). Action calls the `/api/refresh` route handler with selected timeframe & keyword filter.
   - Route handler validates input, forwards to Supabase Edge Function with signed service key, and returns a refresh job ID.
   - UI polls `/api/refresh/:id` (ISR with revalidate tag) until job status is `completed` or `failed`.
2. **Edge Function Processing**
   - Pull recent posts per subreddit using Reddit API `https://www.reddit.com/r/{subreddit}/{listing}.json`.
   - Filter by timeframe window in UTC; limit 100 posts. For each post, request top-level comments (max 50) via `api.reddit.com/comments/{id}`.
   - Run VADER sentiment on post title+selftext and each comment body. Store raw compound score and normalized label (`positive`, `neutral`, `negative`).
   - Upsert posts/comments into Postgres with TTL policy (auto-delete after 30 days via Supabase retention policy).
   - Insert sentiment rows and materialize per-day buckets into `subreddit_sentiment_daily` table using SQL `INSERT ... SELECT`.
   - Publish job status updates to Supabase Realtime channel so the UI can show progress bars.
3. **Data Consumption**
   - Server Components fetch aggregated sentiment data via Supabase SQL queries (using the service role key on the server only).
   - Client components use `use` with Suspense to stream chart data. Table/list views fetch paginated posts with associated sentiment for UI.

## Database Schema (Supabase)
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `subreddits` | static metadata | `id (uuid)`, `name`, `display_name`, `reddit_path` |
| `refresh_jobs` | audit refresh runs | `id (uuid PK)`, `triggered_at`, `trigger_source`, `timeframe`, `keyword`, `status`, `error` |
| `posts` | cached Reddit posts | `id (uuid)`, `reddit_id`, `subreddit_id`, `title`, `author`, `posted_at`, `score`, `comment_count`, `permalink`, `raw_json` |
| `comments` | cached top-level comments | `id (uuid)`, `reddit_id`, `post_id`, `author`, `posted_at`, `body`, `raw_json` |
| `sentiments` | sentiment scores for posts/comments | `id`, `source_type ('post'/'comment')`, `source_id`, `compound`, `label`, `scored_at` |
| `subreddit_sentiment_daily` | pre-aggregated trend snapshots | `id`, `subreddit_id`, `timeframe`, `bucket_start`, `positive`, `neutral`, `negative`, `activity_count` |

Indexes:
- `posts (subreddit_id, posted_at desc)`
- `sentiments (source_type, source_id)`
- `subreddit_sentiment_daily (subreddit_id, timeframe, bucket_start)`

Retention:
- Supabase `storage_config` policy deletes `posts`, `comments`, and `sentiments` older than 30 days to satisfy “no long-term storage” guidance.

## Next.js Application Structure
```
app/
  layout.tsx               # global shell, theme provider, Supabase client provider
  page.tsx                 # default dashboard (7-day view)
  compare/page.tsx         # cross-subreddit comparison analytics
  methodology/page.tsx     # static transparency content
  posts/page.tsx           # table view with filters/search
  api/
    refresh/route.ts       # POST: trigger sentiment refresh (server-only)
    refresh/[id]/route.ts  # GET: job status polling
    charts/route.ts        # GET: aggregated metrics for charts (timeframe query)
  components/
    charts/TrendChart.tsx
    charts/BreakdownChart.tsx
    data/PostTable.tsx
    refresh/RefreshButton.tsx
    layout/SiteHeader.tsx
    layout/Sidebar.tsx
  lib/
    supabase/server.ts     # service role client (server only)
    supabase/client.ts     # anon client (if ever needed for client-side)
    timeframes.ts
    sentiment.ts           # shared label helpers
  actions/
    refreshSentiment.ts    # Server Action wrapper over /api/refresh
```

All pages are Server Components by default. Client wrappers are only added for interactive controls (e.g., timeframe picker, chart tooltips). shadcn/ui is installed via the CLI and components are generated into `components/ui/*`.

## Edge Function Outline (`sentiment-refresh`)
1. Validate JWT (service role) and parse timeframe (`24h|7d|30d`) + optional keyword.
2. Derive since/until timestamps, subreddit list.
3. For each subreddit:
   - Fetch posts JSON; discard stickied/removed posts.
   - Fetch comments concurrently (rate-limited with Reddit API courtesy delays).
   - Run VADER sentiment on each content block; return compound & label.
   - Upsert into `posts`, `comments`, `sentiments`.
4. Execute SQL function `fn_update_subreddit_aggregates(subreddit_id, timeframe)` that:
   - Buckets posts/comments by `date_trunc('day', posted_at)`.
   - Counts labels -> update `subreddit_sentiment_daily`.
5. Emit progress via `supabase.channel('refresh:<job_id>')`.
6. Update job status, return summary counts (posts processed, comments processed, duration).

## Frontend Features
- **Dashboard (Default 7-day)**: Trend chart per subreddit (line chart), sentiment distribution (bar/pie), key metrics (cards). Uses `TrendChart`, `BreakdownChart`.
- **Comparison View**: Multi-series line chart comparing subreddits, plus activity heatmap using shadcn Chart components and D3 under the hood.
- **Post Explorer**: Paginated table (shadcn `DataTable`) listing newest posts with sentiment badges, score, comment preview, and expand modal showing top comments.
- **Methodology Page**: Static MDX page with data pipeline, limitations, last refresh timestamp, link to PRD.
- **Manual Refresh**: Accent button showing spinner/progress, calls Server Action, optimistic UI updates on success.
- **Error Handling**: Toasts using shadcn `use-toast` for failures; fallback components for empty data.

Responsive design relies on Tailwind breakpoints; mobile layout simplifies charts into stacked cards and collapsible sections (nice-to-have but planned).

## Optional Feature Hooks
1. **Keyword Filter**: Edge Function accepts `keyword`. SQL filters on `posts.title || posts.selftext` and `comments.body`. UI adds search input feeding to `refreshSentiment`.
2. **CSV Export**: Add route `app/api/export/route.ts` that returns a streamed CSV built from Supabase query, protected via secret token.
3. **Comment Sentiment Visualization**: Extend modal to render bar chart using existing sentiments data.

## Testing & Observability
- **Unit Tests**: Use Vitest for shared utils (`lib/timeframes`, sentiment label mapping). Use React Testing Library for critical components with mocked Supabase data.
- **Integration Tests**: Mock Supabase Edge Function via MSW in Playwright component tests to verify data flows.
- **Edge Function Tests**: Write Deno unit tests for sentiment pipeline (Supabase Edge Functions support `deno test`).
- **Monitoring**: Enable Supabase Logs for Edge Function errors; instrument Next.js route handlers with simple metrics (duration, error count logged to console + Supabase table `api_logs` if required).

## Delivery Milestones
1. **Setup (Day 1-2)**: Bootstrap Next.js 15 app, configure Tailwind + shadcn, set Supabase project & env vars, scaffold schema via migrations.
2. **Backend Integration (Day 3-5)**: Implement Edge Function, database SQL helpers, `/api/refresh` pipeline, aggregate tables.
3. **Frontend Dashboards (Day 6-8)**: Dashboard charts, comparison view, post explorer, methodology page.
4. **QA & Polish (Day 9-10)**: Accessibility sweep (ARIA for charts), loading/error states, documentation, deploy to Vercel with Supabase envs.

## Open Questions / Follow-ups
- Do we need public access without auth, or should refresh be limited via basic auth/token?
- Should manual refresh throttle per IP to avoid Reddit API rate limits?
- Are there compliance requirements for storing Reddit content temporarily (e.g., disclaimers)?
- Confirm acceptance for VADER accuracy; otherwise budget time for Hugging Face API integration.

