import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Timeframe } from "@/lib/timeframes";

export type DashboardData = {
  timeframe: Timeframe;
  subreddits: Array<{
    id: string;
    name: string;
    displayName: string;
  }>;
  trend: Array<{
    subredditId: string;
    bucketStart: string;
    positive: number;
    neutral: number;
    negative: number;
    activityCount: number;
  }>;
  recentPosts: Array<{
    id: string;
    title: string;
    subredditId: string;
    postedAt: string;
    permalink: string | null;
    score: number | null;
    commentCount: number | null;
    sentimentLabel: string | null;
    sentimentScore: number | null;
  }>;
  latestJob: {
    id: string;
    status: string;
    triggeredAt: string;
    finishedAt: string | null;
    timeframe: string;
    postsProcessed: number;
    commentsProcessed: number;
    sentimentsProcessed: number;
    error: string | null;
  } | null;
};

type SubredditRow = {
  id: string;
  name: string;
  display_name: string;
};

type TrendRow = {
  subreddit_id: string;
  bucket_start: string;
  positive: number;
  neutral: number;
  negative: number;
  activity_count: number;
};

type PostRow = {
  id: string;
  title: string;
  subreddit_id: string;
  posted_at: string;
  permalink: string | null;
  score: number | null;
  comment_count: number | null;
  sentiments?: Array<{ label: string; compound: number }>;
};

type JobRow = {
  id: string;
  status: string;
  timeframe: string;
  triggered_at: string;
  finished_at: string | null;
  posts_processed: number | null;
  comments_processed: number | null;
  sentiments_processed: number | null;
  error: string | null;
};

export async function fetchDashboardData(
  timeframe: Timeframe,
): Promise<DashboardData> {
  const supabase = createServiceRoleClient();

  const subredditsPromise = supabase
    .from("subreddits")
    .select("id, name, display_name")
    .order("display_name", { ascending: true });

  const trendPromise = supabase
    .from("subreddit_sentiment_daily")
    .select(
      "subreddit_id, bucket_start, positive, neutral, negative, activity_count",
    )
    .eq("timeframe", timeframe)
    .order("bucket_start", { ascending: true });

  const postsPromise = supabase
    .from("posts")
    .select(
      "id, title, subreddit_id, posted_at, permalink, score, comment_count, sentiments(label, compound)",
    )
    .order("posted_at", { ascending: false })
    .limit(10);

  const jobPromise = supabase
    .from("refresh_jobs")
    .select(
      "id, status, timeframe, triggered_at, finished_at, posts_processed, comments_processed, sentiments_processed, error",
    )
    .order("triggered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [
    { data: subredditRows, error: subredditError },
    { data: trendRows, error: trendError },
    { data: postsRows, error: postsError },
    { data: jobRow, error: jobError },
  ] = await Promise.all([
    subredditsPromise,
    trendPromise,
    postsPromise,
    jobPromise,
  ]) as [
    { data: SubredditRow[] | null; error: { message: string } | null },
    { data: TrendRow[] | null; error: { message: string } | null },
    { data: PostRow[] | null; error: { message: string } | null },
    { data: JobRow | null; error: { message: string } | null },
  ];

  if (subredditError) {
    throw new Error(`Failed to load subreddits: ${subredditError.message}`);
  }

  if (trendError) {
    throw new Error(`Failed to load sentiment trend: ${trendError.message}`);
  }

  if (postsError) {
    throw new Error(`Failed to load recent posts: ${postsError.message}`);
  }

  if (jobError) {
    throw new Error(`Failed to load latest refresh job: ${jobError.message}`);
  }

  const recentPosts =
    postsRows?.map((row) => ({
      id: row.id,
      title: row.title,
      subredditId: row.subreddit_id,
      postedAt: row.posted_at,
      permalink: row.permalink,
      score: row.score,
      commentCount: row.comment_count,
      sentimentLabel:
        Array.isArray(row.sentiments) && row.sentiments.length > 0
          ? row.sentiments[0]?.label ?? null
          : null,
      sentimentScore:
        Array.isArray(row.sentiments) && row.sentiments.length > 0
          ? row.sentiments[0]?.compound ?? null
          : null,
    })) ?? [];

  return {
    timeframe,
    subreddits:
      subredditRows?.map((row) => ({
        id: row.id,
        name: row.name,
        displayName: row.display_name,
      })) ?? [],
    trend:
      trendRows?.map((row) => ({
        subredditId: row.subreddit_id,
        bucketStart: row.bucket_start,
        positive: row.positive,
        neutral: row.neutral,
        negative: row.negative,
        activityCount: row.activity_count,
      })) ?? [],
    recentPosts,
    latestJob: jobRow
      ? {
        id: jobRow.id,
        status: jobRow.status,
        triggeredAt: jobRow.triggered_at,
        finishedAt: jobRow.finished_at,
        timeframe: jobRow.timeframe,
        postsProcessed: jobRow.posts_processed ?? 0,
        commentsProcessed: jobRow.comments_processed ?? 0,
        sentimentsProcessed: jobRow.sentiments_processed ?? 0,
        error: jobRow.error ?? null,
      }
      : null,
  };
}
