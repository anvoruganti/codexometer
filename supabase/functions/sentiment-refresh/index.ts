import { serve } from "std/http/server.ts";
import { delay } from "std/async/delay.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SentimentIntensityAnalyzer } from "vader-sentiment";

type SentimentLabel = "positive" | "neutral" | "negative";

type RefreshPayload = {
  timeframe?: string;
  keyword?: string | null;
};

type SubredditRow = {
  id: string;
  name: string;
};

type PostRecordDraft = {
  reddit_id: string;
  subreddit_id: string;
  title: string;
  author: string | null;
  posted_at: string;
  score: number | null;
  comment_count: number | null;
  permalink: string | null;
  raw_json: unknown;
  updated_at: string;
};

type PostSentimentDraft = {
  reddit_id: string;
  compound: number;
  label: SentimentLabel;
  scored_at: string;
  posted_at: string;
  subreddit_id: string;
};

type CommentRecordDraft = {
  reddit_id: string;
  post_reddit_id: string;
  author: string | null;
  posted_at: string;
  body: string;
  raw_json: unknown;
};

type CommentSentimentDraft = {
  reddit_id: string;
  compound: number;
  label: SentimentLabel;
  scored_at: string;
  posted_at: string;
  subreddit_id: string;
};

type AggregateRow = {
  subreddit_id: string;
  timeframe: string;
  bucket_start: string;
  positive: number;
  neutral: number;
  negative: number;
  activity_count: number;
};

type ProcessResult = {
  postsProcessed: number;
  commentsProcessed: number;
  sentimentsInserted: number;
  aggregatesUpserted: number;
  errors: string[];
};

const TIMEFRAME_CONFIG: Record<string, { hours: number }> = {
  "24h": { hours: 24 },
  "7d": { hours: 7 * 24 },
  "30d": { hours: 30 * 24 },
};

const DEFAULT_USER_AGENT = "web:codexometer:v0.1 (by /u/codexometerapp)";
const USER_AGENT = Deno.env.get("REDDIT_USER_AGENT") ?? DEFAULT_USER_AGENT;
const REDDIT_CLIENT_ID = Deno.env.get("REDDIT_CLIENT_ID");
const REDDIT_CLIENT_SECRET = Deno.env.get("REDDIT_CLIENT_SECRET");
const REDDIT_USERNAME = Deno.env.get("REDDIT_USERNAME");
const REDDIT_PASSWORD = Deno.env.get("REDDIT_PASSWORD");
const BASE_REDDIT_HEADERS: HeadersInit = {
  "User-Agent": USER_AGENT,
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.8",
};
const REDDIT_API_BASE = "https://oauth.reddit.com";
const MAX_POSTS = 20;
const MAX_COMMENTS = 10;
const RATE_LIMIT_MS = 900;

type TokenManager = {
  value: string;
  refresh: () => Promise<string>;
};

async function requestRedditAccessToken(
  grantType: "password" | "client_credentials",
): Promise<string> {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error("Reddit client credentials are not configured.");
  }

  const params = new URLSearchParams({
    grant_type: grantType,
  });
  params.set("scope", "read history");

  if (grantType === "password") {
    if (!REDDIT_USERNAME || !REDDIT_PASSWORD) {
      throw new Error(
        "Reddit username/password are required for password grant.",
      );
    }
    params.set("username", REDDIT_USERNAME);
    params.set("password", REDDIT_PASSWORD);
  }

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: params.toString(),
  });

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const reason =
      (payload.error_description as string | undefined) ??
      (payload.error as string | undefined) ??
      text;
    throw new Error(
      `Reddit auth failed (${response.status}) [${grantType}]: ${reason}`,
    );
  }

  const accessToken = payload.access_token as string | undefined;
  if (!accessToken) {
    throw new Error(
      `Reddit auth response missing access token [${grantType}]: ${text}`,
    );
  }

  return accessToken;
}

async function fetchRedditAccessToken(): Promise<string> {
  if (REDDIT_USERNAME && REDDIT_PASSWORD) {
    try {
      return await requestRedditAccessToken("password");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("unauthorized_client")) {
        throw error;
      }
    }
  }

  return requestRedditAccessToken("client_credentials");
}

function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error("Supabase credentials are not configured.");
  }

  return createClient(url, serviceKey);
}

function normalizeKeyword(keyword: string | null | undefined): string | null {
  if (!keyword) {
    return null;
  }
  const trimmed = keyword.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function labelFromScore(score: number): SentimentLabel {
  if (score >= 0.05) {
    return "positive";
  }
  if (score <= -0.05) {
    return "negative";
  }
  return "neutral";
}

function matchesKeyword(text: string, keyword: string | null): boolean {
  if (!keyword) {
    return true;
  }
  return text.toLowerCase().includes(keyword);
}

function sanitizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  if (value === "[deleted]" || value === "[removed]") {
    return "";
  }
  return value;
}

function updateAggregate(
  aggregates: Map<string, AggregateRow>,
  args: { subredditId: string; timeframe: string; timestamp: string; label: SentimentLabel },
) {
  const bucket = new Date(args.timestamp);
  bucket.setUTCHours(0, 0, 0, 0);
  const bucketDate = bucket.toISOString().slice(0, 10);
  const key = `${args.subredditId}:${bucketDate}`;
  let row = aggregates.get(key);

  if (!row) {
    row = {
      subreddit_id: args.subredditId,
      timeframe: args.timeframe,
      bucket_start: bucketDate,
      positive: 0,
      neutral: 0,
      negative: 0,
      activity_count: 0,
    };
  }

  if (args.label === "positive") {
    row.positive += 1;
  } else if (args.label === "negative") {
    row.negative += 1;
  } else {
    row.neutral += 1;
  }

  row.activity_count += 1;

  aggregates.set(key, row);
}

async function fetchJson<T>(
  url: string,
  tokenManager: TokenManager,
  attempt = 1,
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      ...BASE_REDDIT_HEADERS,
      Authorization: `Bearer ${tokenManager.value}`,
    },
  });

  if (response.status === 401 && attempt < 3) {
    tokenManager.value = await tokenManager.refresh();
    return fetchJson(url, tokenManager, attempt + 1);
  }

  if ((response.status === 429 || response.status === 403) && attempt < 3) {
    await delay(RATE_LIMIT_MS * attempt);
    return fetchJson(url, tokenManager, attempt + 1);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Reddit request failed (${response.status}): ${url} :: ${text}`,
    );
  }

  return response.json() as Promise<T>;
}

async function processSubreddit(
  subreddit: SubredditRow,
  timeframe: string,
  sinceEpoch: number,
  keyword: string | null,
  aggregates: Map<string, AggregateRow>,
  errors: string[],
  tokenManager: TokenManager,
): Promise<{
  postRecords: PostRecordDraft[];
  postSentiments: PostSentimentDraft[];
  commentRecords: CommentRecordDraft[];
  commentSentiments: CommentSentimentDraft[];
}> {
  const postsUrl = new URL(`/r/${subreddit.name}/new`, REDDIT_API_BASE);
  postsUrl.searchParams.set("limit", String(MAX_POSTS));
  postsUrl.searchParams.set("raw_json", "1");

  const postRecords: PostRecordDraft[] = [];
  const postSentiments: PostSentimentDraft[] = [];
  const commentRecords: CommentRecordDraft[] = [];
  const commentSentiments: CommentSentimentDraft[] = [];

  let listing: any;
  try {
    listing = await fetchJson<{ data?: { children?: any[] } }>(
      postsUrl.toString(),
      tokenManager,
    );
  } catch (error) {
    errors.push(
      `[${subreddit.name}] Failed to fetch posts: ${(error as Error).message}`,
    );
    return { postRecords, postSentiments, commentRecords, commentSentiments };
  }

  const children = Array.isArray(listing?.data?.children)
    ? listing.data.children
    : [];
  const nowIso = new Date().toISOString();

  for (const child of children) {
    const data = child?.data;

    if (!data || child.kind !== "t3") {
      continue;
    }

    if (data.stickied || data.removed_by_category) {
      continue;
    }

    const createdUtc = Number(data.created_utc);
    if (!Number.isFinite(createdUtc)) {
      continue;
    }

    if (createdUtc < sinceEpoch) {
      continue;
    }

    const title = sanitizeText(data.title);
    const selfText = sanitizeText(data.selftext);
    const combinedForKeyword = `${title}\n${selfText}`.trim();

    if (keyword && !matchesKeyword(combinedForKeyword, keyword)) {
      continue;
    }

    const postRecord: PostRecordDraft = {
      reddit_id: data.id,
      subreddit_id: subreddit.id,
      title,
      author: sanitizeText(data.author) || null,
      posted_at: new Date(createdUtc * 1000).toISOString(),
      score: typeof data.score === "number" ? data.score : null,
      comment_count: typeof data.num_comments === "number"
        ? data.num_comments
        : null,
      permalink: typeof data.permalink === "string"
        ? `https://reddit.com${data.permalink}`
        : null,
      raw_json: data,
      updated_at: nowIso,
    };

    postRecords.push(postRecord);

    if (combinedForKeyword.length > 0) {
      const polarity = SentimentIntensityAnalyzer.polarity_scores(
        combinedForKeyword,
      );
      const label = labelFromScore(polarity.compound);
      const scoredAt = new Date().toISOString();

      postSentiments.push({
        reddit_id: data.id,
        compound: polarity.compound,
        label,
        scored_at: scoredAt,
        posted_at: postRecord.posted_at,
        subreddit_id: subreddit.id,
      });

      updateAggregate(aggregates, {
        subredditId: subreddit.id,
        timeframe,
        timestamp: postRecord.posted_at,
        label,
      });
    }

    const commentsUrl = new URL(
      `/comments/${data.id}`,
      REDDIT_API_BASE,
    );
    commentsUrl.searchParams.set("depth", "1");
    commentsUrl.searchParams.set("limit", String(MAX_COMMENTS));
    commentsUrl.searchParams.set("raw_json", "1");

    let commentsListing: any;
    try {
      commentsListing = await fetchJson<any>(
        commentsUrl.toString(),
        tokenManager,
      );
    } catch (error) {
      errors.push(
        `[${subreddit.name}] Failed to fetch comments for ${data.id}: ${
          (error as Error).message
        }`,
      );
      await delay(RATE_LIMIT_MS);
      continue;
    }

    const commentChildren = Array.isArray(commentsListing?.[1]?.data?.children)
      ? commentsListing[1].data.children
      : [];

    for (const commentChild of commentChildren) {
      if (commentChild?.kind !== "t1") {
        continue;
      }

      const commentData = commentChild.data;
      if (!commentData) {
        continue;
      }

      const commentCreated = Number(commentData.created_utc);
      if (!Number.isFinite(commentCreated) || commentCreated < sinceEpoch) {
        continue;
      }

      const body = sanitizeText(commentData.body);
      if (!body) {
        continue;
      }

      if (keyword && !matchesKeyword(body, keyword)) {
        continue;
      }

      const postedAtIso = new Date(commentCreated * 1000).toISOString();

      commentRecords.push({
        reddit_id: commentData.id,
        post_reddit_id: data.id,
        author: sanitizeText(commentData.author) || null,
        posted_at: postedAtIso,
        body,
        raw_json: commentData,
      });

      const polarity = SentimentIntensityAnalyzer.polarity_scores(body);
      const label = labelFromScore(polarity.compound);
      const scoredAt = new Date().toISOString();

      commentSentiments.push({
        reddit_id: commentData.id,
        compound: polarity.compound,
        label,
        scored_at: scoredAt,
        posted_at: postedAtIso,
        subreddit_id: subreddit.id,
      });

      updateAggregate(aggregates, {
        subredditId: subreddit.id,
        timeframe,
        timestamp: postedAtIso,
        label,
      });
    }

    await delay(RATE_LIMIT_MS);
  }

  return { postRecords, postSentiments, commentRecords, commentSentiments };
}

async function processRefresh(
  supabase: SupabaseClient,
  timeframe: string,
  keyword: string | null,
  tokenManager: TokenManager,
): Promise<ProcessResult> {
  const config = TIMEFRAME_CONFIG[timeframe];
  const since = new Date();
  since.setUTCHours(since.getUTCHours() - config.hours);
  const sinceEpoch = Math.floor(since.getTime() / 1000);

  const { data: subreddits, error: subredditsError } = await supabase
    .from("subreddits")
    .select("id, name");

  if (subredditsError) {
    throw new Error(`Failed to load subreddits: ${subredditsError.message}`);
  }

  if (!subreddits || subreddits.length === 0) {
    throw new Error("No subreddits configured. Seed the table first.");
  }

  const aggregates = new Map<string, AggregateRow>();
  const errors: string[] = [];

  const allPostRecords: PostRecordDraft[] = [];
  const allPostSentiments: PostSentimentDraft[] = [];
  const allCommentDrafts: CommentRecordDraft[] = [];
  const allCommentSentiments: CommentSentimentDraft[] = [];

  for (const subreddit of subreddits as SubredditRow[]) {
    const result = await processSubreddit(
      subreddit,
      timeframe,
      sinceEpoch,
      keyword,
      aggregates,
      errors,
      tokenManager,
    );

    allPostRecords.push(...result.postRecords);
    allPostSentiments.push(...result.postSentiments);
    allCommentDrafts.push(...result.commentRecords);
    allCommentSentiments.push(...result.commentSentiments);
  }

  const uniquePostRedditIds = Array.from(
    new Set(allPostRecords.map((record) => record.reddit_id)),
  );

  if (allPostRecords.length > 0) {
    const { error: upsertPostsError } = await supabase
      .from("posts")
      .upsert(allPostRecords, { onConflict: "reddit_id" });

    if (upsertPostsError) {
      throw new Error(`Failed to upsert posts: ${upsertPostsError.message}`);
    }
  }

  const { data: storedPosts, error: storedPostsError } = await supabase
    .from("posts")
    .select("id, reddit_id")
    .in("reddit_id", uniquePostRedditIds);

  if (storedPostsError) {
    throw new Error(
      `Failed to load stored posts: ${storedPostsError.message}`,
    );
  }

  const postIdMap = new Map<string, string>(
    (storedPosts ?? []).map((row) => [row.reddit_id, row.id]),
  );

  const commentRows = allCommentDrafts
    .map((draft) => {
      const postId = postIdMap.get(draft.post_reddit_id);
      if (!postId) {
        return null;
      }
      return {
        reddit_id: draft.reddit_id,
        post_id: postId,
        author: draft.author,
        posted_at: draft.posted_at,
        body: draft.body,
        raw_json: draft.raw_json,
      };
    })
    .filter((value): value is {
      reddit_id: string;
      post_id: string;
      author: string | null;
      posted_at: string;
      body: string;
      raw_json: unknown;
    } => Boolean(value));

  const uniqueCommentIds = Array.from(
    new Set(commentRows.map((row) => row.reddit_id)),
  );

  if (commentRows.length > 0) {
    const { error: upsertCommentsError } = await supabase
      .from("comments")
      .upsert(commentRows, { onConflict: "reddit_id" });

    if (upsertCommentsError) {
      throw new Error(
        `Failed to upsert comments: ${upsertCommentsError.message}`,
      );
    }
  }

  const { data: storedComments, error: storedCommentsError } = await supabase
    .from("comments")
    .select("id, reddit_id")
    .in("reddit_id", uniqueCommentIds);

  if (storedCommentsError) {
    throw new Error(
      `Failed to load stored comments: ${storedCommentsError.message}`,
    );
  }

  const commentIdMap = new Map<string, string>(
    (storedComments ?? []).map((row) => [row.reddit_id, row.id]),
  );

  const postSentimentRows = allPostSentiments
    .map((draft) => {
      const postId = postIdMap.get(draft.reddit_id);
      if (!postId) {
        return null;
      }
      return {
        source_type: "post" as const,
        post_id: postId,
        compound: draft.compound,
        label: draft.label,
        scored_at: draft.scored_at,
      };
    })
    .filter((value): value is {
      source_type: "post";
      post_id: string;
      compound: number;
      label: SentimentLabel;
      scored_at: string;
    } => Boolean(value));

  const commentSentimentRows = allCommentSentiments
    .map((draft) => {
      const commentId = commentIdMap.get(draft.reddit_id);
      if (!commentId) {
        return null;
      }
      return {
        source_type: "comment" as const,
        comment_id: commentId,
        compound: draft.compound,
        label: draft.label,
        scored_at: draft.scored_at,
      };
    })
    .filter((value): value is {
      source_type: "comment";
      comment_id: string;
      compound: number;
      label: SentimentLabel;
      scored_at: string;
    } => Boolean(value));

  const postIdsForCleanup = Array.from(
    new Set(postSentimentRows.map((row) => row.post_id)),
  );
  const commentIdsForCleanup = Array.from(
    new Set(commentSentimentRows.map((row) => row.comment_id)),
  );

  if (postIdsForCleanup.length > 0) {
    const { error: deletePostSentimentsError } = await supabase
      .from("sentiments")
      .delete()
      .in("post_id", postIdsForCleanup);

    if (deletePostSentimentsError) {
      throw new Error(
        `Failed to clean existing post sentiments: ${
          deletePostSentimentsError.message
        }`,
      );
    }
  }

  if (commentIdsForCleanup.length > 0) {
    const { error: deleteCommentSentimentsError } = await supabase
      .from("sentiments")
      .delete()
      .in("comment_id", commentIdsForCleanup);

    if (deleteCommentSentimentsError) {
      throw new Error(
        `Failed to clean existing comment sentiments: ${
          deleteCommentSentimentsError.message
        }`,
      );
    }
  }

  if (postSentimentRows.length > 0) {
    const { error: insertPostSentimentError } = await supabase
      .from("sentiments")
      .insert(postSentimentRows);

    if (insertPostSentimentError) {
      throw new Error(
        `Failed to insert post sentiments: ${insertPostSentimentError.message}`,
      );
    }
  }

  if (commentSentimentRows.length > 0) {
    const { error: insertCommentSentimentError } = await supabase
      .from("sentiments")
      .insert(commentSentimentRows);

    if (insertCommentSentimentError) {
      throw new Error(
        `Failed to insert comment sentiments: ${
          insertCommentSentimentError.message
        }`,
      );
    }
  }

  const aggregateRows = Array.from(aggregates.values());

  if (aggregateRows.length > 0) {
    const subredditsProcessed = Array.from(
      new Set(aggregateRows.map((row) => row.subreddit_id)),
    );

    const { error: deleteAggregatesError } = await supabase
      .from("subreddit_sentiment_daily")
      .delete()
      .eq("timeframe", timeframe)
      .in("subreddit_id", subredditsProcessed);

    if (deleteAggregatesError) {
      throw new Error(
        `Failed to clean sentiment aggregates: ${
          deleteAggregatesError.message
        }`,
      );
    }

    const { error: insertAggregatesError } = await supabase
      .from("subreddit_sentiment_daily")
      .upsert(aggregateRows, {
        onConflict: "subreddit_id,timeframe,bucket_start",
      });

    if (insertAggregatesError) {
      throw new Error(
        `Failed to upsert sentiment aggregates: ${
          insertAggregatesError.message
        }`,
      );
    }
  }

  return {
    postsProcessed: allPostRecords.length,
    commentsProcessed: commentRows.length,
    sentimentsInserted: postSentimentRows.length + commentSentimentRows.length,
    aggregatesUpserted: aggregateRows.length,
    errors,
  };
}

async function updateJob(
  supabase: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("refresh_jobs")
    .update(patch)
    .eq("id", jobId);

  if (error) {
    console.error("Failed to update refresh job", jobId, error.message);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: RefreshPayload = {};
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const timeframe = payload.timeframe ?? "7d";
  if (!Object.prototype.hasOwnProperty.call(TIMEFRAME_CONFIG, timeframe)) {
    return Response.json(
      {
        error: "Unsupported timeframe.",
        allowed: Object.keys(TIMEFRAME_CONFIG),
      },
      { status: 400 },
    );
  }

  const keyword = normalizeKeyword(payload.keyword);

  let supabase: SupabaseClient;
  try {
    supabase = createServiceClient();
  } catch (error) {
    return Response.json(
      { error: (error as Error).message ?? "Supabase initialization failed." },
      { status: 500 },
    );
  }

  const startTimestamp = new Date();
  let jobId: string | null = null;

  try {
    const { data: jobRecord, error: jobError } = await supabase
      .from("refresh_jobs")
      .insert({
        timeframe,
        keyword,
        trigger_source: "edge_function",
        status: "queued",
      })
      .select("id")
      .single();

    if (jobError || !jobRecord) {
      throw new Error(jobError?.message ?? "Failed to create refresh job.");
    }

    jobId = jobRecord.id;

    await updateJob(supabase, jobId, {
      status: "processing",
      started_at: startTimestamp.toISOString(),
    });

    const tokenManager: TokenManager = {
      value: await fetchRedditAccessToken(),
      refresh: fetchRedditAccessToken,
    };

    const result = await processRefresh(
      supabase,
      timeframe,
      keyword,
      tokenManager,
    );

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startTimestamp.getTime();

    await updateJob(supabase, jobId, {
      status: "completed",
      finished_at: finishedAt.toISOString(),
      posts_processed: result.postsProcessed,
      comments_processed: result.commentsProcessed,
      sentiments_processed: result.sentimentsInserted,
      duration_ms: durationMs,
      error: result.errors.length > 0 ? result.errors.join(" | ") : null,
    });

    return Response.json({
      jobId,
      status: result.errors.length > 0 ? "completed_with_warnings" : "completed",
      timeframe,
      keyword,
      postsProcessed: result.postsProcessed,
      commentsProcessed: result.commentsProcessed,
      sentimentsInserted: result.sentimentsInserted,
      aggregatesUpserted: result.aggregatesUpserted,
      warnings: result.errors,
      durationMs,
    });
  } catch (error) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startTimestamp.getTime();

    if (jobId) {
      await updateJob(supabase, jobId, {
        status: "failed",
        finished_at: finishedAt.toISOString(),
        error: (error as Error).message,
        duration_ms: durationMs,
      });
    }

    return Response.json(
      {
        error: (error as Error).message ?? "Refresh failed.",
        jobId,
      },
      { status: 500 },
    );
  }
});
