-- Schema based on implementation.md (data pipeline requirements)

create extension if not exists "pgcrypto";

create table if not exists public.subreddits (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    display_name text not null,
    reddit_path text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.refresh_jobs (
    id uuid primary key default gen_random_uuid(),
    triggered_at timestamptz not null default now(),
    trigger_source text not null default 'manual',
    timeframe text not null check (timeframe in ('24h','7d','30d')),
    keyword text,
    status text not null default 'queued',
    error text,
    started_at timestamptz,
    finished_at timestamptz,
    posts_processed integer not null default 0,
    comments_processed integer not null default 0,
    sentiments_processed integer not null default 0,
    duration_ms integer
);

create table if not exists public.posts (
    id uuid primary key default gen_random_uuid(),
    subreddit_id uuid not null references public.subreddits(id) on delete cascade,
    reddit_id text not null unique,
    title text not null,
    author text,
    posted_at timestamptz not null,
    score integer,
    comment_count integer,
    permalink text,
    raw_json jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.posts(id) on delete cascade,
    reddit_id text not null unique,
    author text,
    posted_at timestamptz not null,
    body text not null,
    raw_json jsonb not null,
    created_at timestamptz not null default now()
);

create table if not exists public.sentiments (
    id uuid primary key default gen_random_uuid(),
    source_type text not null check (source_type in ('post','comment')),
    post_id uuid references public.posts(id) on delete cascade,
    comment_id uuid references public.comments(id) on delete cascade,
    compound numeric not null,
    label text not null check (label in ('positive','neutral','negative')),
    scored_at timestamptz not null default now(),
    check (
        (source_type = 'post' and post_id is not null and comment_id is null)
        or (source_type = 'comment' and comment_id is not null and post_id is null)
    )
);

create table if not exists public.subreddit_sentiment_daily (
    id uuid primary key default gen_random_uuid(),
    subreddit_id uuid not null references public.subreddits(id) on delete cascade,
    timeframe text not null check (timeframe in ('24h','7d','30d')),
    bucket_start date not null,
    positive integer not null default 0,
    neutral integer not null default 0,
    negative integer not null default 0,
    activity_count integer not null default 0,
    created_at timestamptz not null default now(),
    unique (subreddit_id, timeframe, bucket_start)
);

create index if not exists idx_posts_subreddit_posted_at
    on public.posts (subreddit_id, posted_at desc);

create index if not exists idx_comments_post_id_posted_at
    on public.comments (post_id, posted_at desc);

create index if not exists idx_sentiments_post
    on public.sentiments (post_id)
    where post_id is not null;

create index if not exists idx_sentiments_comment
    on public.sentiments (comment_id)
    where comment_id is not null;

create index if not exists idx_subreddit_sentiment_daily
    on public.subreddit_sentiment_daily (subreddit_id, timeframe, bucket_start);

comment on table public.posts is 'Cached Reddit posts (retained for 30 days via Supabase retention policy).';
comment on table public.comments is 'Cached top-level comments (retained for 30 days).';
comment on table public.sentiments is 'VADER sentiment scores for posts and comments.';
comment on table public.subreddit_sentiment_daily is 'Pre-aggregated daily sentiment breakdowns per subreddit/timeframe.';
