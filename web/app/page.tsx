import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import { SentimentNetChart } from "@/components/charts/net-chart";
import { SentimentShareChart } from "@/components/charts/share-chart";
import { RefreshButton } from "@/components/refresh/refresh-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TIMEFRAMES, type Timeframe } from "@/lib/timeframes";
import { fetchDashboardData } from "@/lib/supabase/queries";
import { AnimatedCounter } from "@/components/layout/animated-counter";
import { SubtlePulse } from "@/components/layout/subtle-pulse";
import { SpotlightCard } from "@/components/layout/spotlight-card";

const DEFAULT_TIMEFRAME: Timeframe = "7d";

const SENTIMENT_BADGE_STYLES: Record<string, string> = {
  positive: "border-emerald-400/60 bg-emerald-400/15 text-emerald-100",
  neutral: "border-slate-400/60 bg-slate-400/15 text-slate-100",
  negative: "border-rose-400/60 bg-rose-400/15 text-rose-100",
};

type DashboardPageProps = {
  searchParams?: Record<string, string | string[]>;
};

function resolveTimeframe(params: DashboardPageProps["searchParams"]): Timeframe {
  const paramValue = Array.isArray(params?.timeframe)
    ? params?.timeframe[0]
    : params?.timeframe;

  if (!paramValue) {
    return DEFAULT_TIMEFRAME;
  }

  return (Object.hasOwn(TIMEFRAMES, paramValue)
    ? paramValue
    : DEFAULT_TIMEFRAME) as Timeframe;
}

function resolveSubreddit(
  params: DashboardPageProps["searchParams"],
  subreddits: { id: string }[],
): string | "all" {
  const value = Array.isArray(params?.subreddit)
    ? params?.subreddit[0]
    : params?.subreddit;

  if (!value || value === "all") {
    return "all";
  }

  return subreddits.some((item) => item.id === value) ? value : "all";
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return "0%";
  }
  return `${Math.round(value)}%`;
}

function formatTimestamp(input: string | null | undefined): string {
  if (!input) {
    return "—";
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "just now";
  }
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(Math.round(diffMs / 60000), 0);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function buildTimeframeHref(timeframe: string, subreddit?: string | null) {
  const params = new URLSearchParams();
  if (timeframe !== DEFAULT_TIMEFRAME) {
    params.set("timeframe", timeframe);
  }
  if (subreddit && subreddit !== "all") {
    params.set("subreddit", subreddit);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function buildSubredditHref(
  timeframe: string,
  subreddit: string | "all",
): string {
  return buildTimeframeHref(timeframe, subreddit === "all" ? null : subreddit);
}

function sentimentBadge(label: string | null | undefined, score?: number | null) {
  if (!label) {
    return <span className="text-slate-100">—</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${SENTIMENT_BADGE_STYLES[label] ?? "border-white/20 bg-white/10 text-slate-100"}`}
    >
      <span className="font-medium capitalize">{label}</span>
      {typeof score === "number" ? (
        <span className="opacity-70">{score.toFixed(2)}</span>
      ) : null}
    </span>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const timeframe = resolveTimeframe(searchParams);
  const data = await fetchDashboardData(timeframe);
  const selectedSubreddit = resolveSubreddit(searchParams, data.subreddits);

  const totalsBySubreddit = data.subreddits.map((subreddit) => {
    const relatedBuckets = data.trend.filter(
      (bucket) => bucket.subredditId === subreddit.id,
    );

    const aggregate = relatedBuckets.reduce(
      (acc, bucket) => {
        acc.positive += bucket.positive;
        acc.neutral += bucket.neutral;
        acc.negative += bucket.negative;
        acc.activity += bucket.activityCount;
        return acc;
      },
      { positive: 0, neutral: 0, negative: 0, activity: 0 },
    );

    return {
      id: subreddit.id,
      displayName: subreddit.displayName,
      ...aggregate,
    };
  });

  const positiveTotal = totalsBySubreddit.reduce((sum, row) => sum + row.positive, 0);
  const neutralTotal = totalsBySubreddit.reduce((sum, row) => sum + row.neutral, 0);
  const negativeTotal = totalsBySubreddit.reduce((sum, row) => sum + row.negative, 0);
  const totalActivity = positiveTotal + neutralTotal + negativeTotal;

  const positiveShare = totalActivity ? (positiveTotal / totalActivity) * 100 : 0;
  const neutralShare = totalActivity ? (neutralTotal / totalActivity) * 100 : 0;
  const negativeShare = totalActivity ? (negativeTotal / totalActivity) * 100 : 0;

  const topSubreddit = totalsBySubreddit
    .filter((row) => row.activity > 0)
    .sort((a, b) => b.activity - a.activity)[0] ?? null;

  const topSubredditName = topSubreddit
    ? data.subreddits.find((item) => item.id === topSubreddit.id)?.displayName ?? topSubreddit.id
    : "—";

  const topPositiveShare = topSubreddit?.activity
    ? (topSubreddit.positive / topSubreddit.activity) * 100
    : 0;

  const netSentiment = positiveTotal - negativeTotal;
  const dailyRows = [...data.trend]
    .sort((a, b) => (a.bucketStart < b.bucketStart ? 1 : -1))
    .slice(0, 12);

  const lastJob = data.latestJob;
  const lastUpdated = lastJob?.finishedAt ?? lastJob?.triggeredAt ?? null;
  const relativeUpdated = lastUpdated ? formatRelativeTime(lastUpdated) : null;
  const isProcessing = lastJob?.status === "processing";
  const timeframeLabel = TIMEFRAMES[timeframe]?.label ?? TIMEFRAMES[DEFAULT_TIMEFRAME].label;

  const recentPosts = data.recentPosts.slice(0, 6);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-950/85 to-slate-900 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_70%_at_0%_0%,rgba(56,189,248,0.25),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_55%_at_100%_0%,rgba(236,72,153,0.2),transparent)]" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <SpotlightCard className="min-h-[260px]">
            <div className="flex h-full flex-col justify-between gap-8">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.25em] text-slate-100">
                  <span className="rounded-full bg-sky-400/20 px-3 py-1 text-[10px] font-semibold text-sky-200">
                    Live Sentiment
                  </span>
                  <span className="tracking-wide text-slate-100">{timeframeLabel}</span>
                </div>
                <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
                  Reddit Sentiment Pulse Dashboard
                </h1>
                <p className="max-w-2xl text-sm text-slate-100">
                  Monitor how the generative AI subreddits are feeling in near real-time. Each refresh
                  pulls the latest posts and comment reactions, runs transparent VADER scoring, and
                  updates trend aggregates for quick decision making.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <RefreshButton defaultTimeframe={timeframe} />
                  {lastUpdated ? (
                    <div className="flex items-center gap-2 text-xs text-slate-100">
                      {isProcessing ? <SubtlePulse /> : <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />}
                      <span>
                        {isProcessing ? "Refresh in progress…" : `Updated ${relativeUpdated}`}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-100">Run your first refresh to populate the dashboard.</div>
                  )}
                </div>

                <div className="space-y-2 text-xs text-slate-100">
                  <span className="block uppercase tracking-[0.24em]">Timeframe</span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(TIMEFRAMES).map(([key, value]) => {
                      const isActive = key === timeframe;
                      return (
                        <Link
                          key={key}
                          href={buildTimeframeHref(key, selectedSubreddit)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            isActive
                              ? "border-sky-400/50 bg-sky-400/20 text-sky-100"
                              : "border-white/10 bg-white/5 text-slate-100 hover:border-sky-300/40 hover:text-sky-100"
                          }`}
                        >
                          {value.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard className="min-h-[260px]">
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-100">
                    Latest Refresh
                  </p>
                  {lastJob ? (
                    <Badge
                      variant="outline"
                      className={`border px-2 py-0.5 text-[0.7rem] uppercase tracking-wide ${
                        lastJob.status === "completed"
                          ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                          : lastJob.status === "failed"
                          ? "border-rose-400/60 bg-rose-400/15 text-rose-100"
                          : "border-sky-400/40 bg-sky-400/10 text-sky-200"
                      }`}
                    >
                      {lastJob.status}
                    </Badge>
                  ) : null}
                </div>
                <h2 className="text-2xl font-semibold">
                  {lastJob ? "Latest refresh run" : "No refresh run yet"}
                </h2>
                <p className="text-sm text-slate-100">
                  {lastJob
                    ? isProcessing
                      ? "Supabase Edge Function is currently processing the latest Reddit pull."
                      : `Completed ${relativeUpdated}.`
                    : "Trigger the first refresh to begin collecting sentiment telemetry."}
                </p>
              </div>

              {lastJob ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-100">Posts</p>
                    <p className="text-2xl font-semibold text-slate-100">
                      <AnimatedCounter value={lastJob.postsProcessed ?? 0} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-100">Comments</p>
                    <p className="text-2xl font-semibold text-slate-100">
                      <AnimatedCounter value={lastJob.commentsProcessed ?? 0} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-100">Sentiments</p>
                    <p className="text-2xl font-semibold text-slate-100">
                      <AnimatedCounter value={lastJob.sentimentsProcessed ?? 0} />
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-100">
                  Head to the refresh controls to queue a run and watch this card light up with
                  throughput metrics.
                </div>
              )}

              {lastJob?.error ? (
                <p className="text-xs text-rose-300">
                  {lastJob.error}
                </p>
              ) : null}
            </div>
          </SpotlightCard>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SpotlightCard className="min-h-[190px]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-100">Total Activity</p>
              <p className="text-3xl font-semibold text-slate-100">
                <AnimatedCounter value={totalActivity} />
              </p>
              <p className="text-sm text-slate-100">
                {formatPercent(positiveShare)} positive • {formatPercent(neutralShare)} neutral • {" "}
                {formatPercent(negativeShare)} negative
              </p>
            </div>
          </SpotlightCard>
          <SpotlightCard className="min-h-[190px]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-100">Top Momentum</p>
              <p className="text-xl font-semibold text-slate-100">{topSubredditName}</p>
              <p className="text-sm text-slate-100">
                {topSubreddit ? (
                  <>
                    {formatNumber(topSubreddit.activity)} interactions • {formatPercent(topPositiveShare)}
                    {" "}positive share
                  </>
                ) : (
                  "Awaiting first refresh to detect subreddit momentum."
                )}
              </p>
            </div>
          </SpotlightCard>
          <SpotlightCard className="min-h-[190px]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-100">Net Sentiment</p>
              <p className={`text-3xl font-semibold ${netSentiment >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                <AnimatedCounter value={Math.abs(netSentiment)} />
                <span className="ml-1 text-base font-medium text-slate-100">
                  {netSentiment >= 0 ? "net positive" : "net negative"}
                </span>
              </p>
              <p className="text-sm text-slate-100">
                Positive minus negative posts/comments across the selected window.
              </p>
            </div>
          </SpotlightCard>
          <SpotlightCard className="min-h-[190px]">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-100">Average Post Impact</p>
              <p className="text-3xl font-semibold text-slate-100">
                {recentPosts.length > 0
                  ? formatNumber(
                      Math.round(
                        recentPosts.reduce(
                          (sum, post) => sum + (post.commentCount ?? 0) + (post.score ?? 0),
                          0,
                        ) / recentPosts.length,
                      ),
                    )
                  : "—"}
              </p>
              <p className="text-sm text-slate-100">
                Average combined score + comments for the recent posts captured.
              </p>
            </div>
          </SpotlightCard>
        </section>

        <SpotlightCard className="space-y-6">
          <Tabs defaultValue="trend" className="w-full">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-100">Sentiment signals</h2>
                <p className="text-sm text-slate-100">
                  Compare sentiment momentum across the tracked subreddits.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "all", label: "All subreddits" },
                  ...data.subreddits.map((item) => ({ id: item.id, label: item.displayName })),
                ].map((option) => {
                  const isActive = selectedSubreddit === option.id;
                  return (
                    <Link
                      key={option.id}
                      href={buildSubredditHref(timeframe, option.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        isActive
                          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                          : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-300/40 hover:text-emerald-200"
                      }`}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </div>
              <TabsList className="h-9 bg-white/10 p-1 text-slate-100">
                <TabsTrigger value="trend" className="rounded-full">
                  Trend
                </TabsTrigger>
                <TabsTrigger value="breakdown" className="rounded-full">
                  Breakdown
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="trend" className="mt-4">
              <TrendChart
                data={data.trend}
                subreddits={data.subreddits.map((item) => ({
                  id: item.id,
                  displayName: item.displayName,
                }))}
                selectedSubredditId={selectedSubreddit}
                className="text-slate-100"
              />
            </TabsContent>
            <TabsContent value="breakdown" className="mt-4">
              <BreakdownChart
                totals={totalsBySubreddit.map((row) => ({
                  subredditId: row.id,
                  positive: row.positive,
                  neutral: row.neutral,
                  negative: row.negative,
                  activity: row.activity,
                }))}
                subreddits={data.subreddits.map((item) => ({
                  id: item.id,
                  displayName: item.displayName,
                }))}
                className="text-slate-100"
              />
            </TabsContent>
          </Tabs>
        </SpotlightCard>

        <section className="grid gap-6 lg:grid-cols-2">
          <SpotlightCard className="min-h-[320px]">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Net sentiment trajectory</h3>
                <p className="text-sm text-slate-200">
                  Positive minus negative volume per subreddit across the selected timeframe.
                </p>
              </div>
              <SentimentNetChart
                data={data.trend.map((row) => ({
                  subredditId: row.subredditId,
                  bucketStart: row.bucketStart,
                  positive: row.positive,
                  negative: row.negative,
                }))}
                subreddits={data.subreddits.map((item) => ({
                  id: item.id,
                  displayName: item.displayName,
                }))}
              />
            </div>
          </SpotlightCard>
          <SpotlightCard className="min-h-[320px]">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Sentiment share mix</h3>
                <p className="text-sm text-slate-200">
                  How positive, neutral, and negative reactions split across recent buckets.
                </p>
              </div>
              <SentimentShareChart
                data={data.trend.map((row) => ({
                  bucketStart: row.bucketStart,
                  positive: row.positive,
                  neutral: row.neutral,
                  negative: row.negative,
                }))}
              />
            </div>
          </SpotlightCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SpotlightCard>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Daily sentiment buckets</h3>
                <p className="text-sm text-slate-100">
                  The most recent aggregates per subreddit and day. Strong colors indicate larger
                  swings in sentiment volume.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-full text-sm text-slate-100">
                  <TableHeader className="bg-white/5 text-xs uppercase tracking-wide text-slate-100">
                    <TableRow className="border-white/10">
                      <TableHead className="text-left">Date</TableHead>
                      <TableHead className="text-left">Subreddit</TableHead>
                      <TableHead className="text-right">Positive</TableHead>
                      <TableHead className="text-right">Neutral</TableHead>
                      <TableHead className="text-right">Negative</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="border-white/10 py-6 text-center text-slate-100">
                          No daily sentiment snapshots yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dailyRows.map((bucket) => {
                        const subreddit = data.subreddits.find(
                          (item) => item.id === bucket.subredditId,
                        );
                        return (
                          <TableRow key={`${bucket.subredditId}-${bucket.bucketStart}`} className="border-white/5">
                            <TableCell className="text-slate-100">
                              {bucket.bucketStart}
                            </TableCell>
                            <TableCell className="text-slate-100">
                              {subreddit?.displayName ?? bucket.subredditId}
                            </TableCell>
                            <TableCell className="text-right text-emerald-300">
                              {formatNumber(bucket.positive)}
                            </TableCell>
                            <TableCell className="text-right text-slate-100">
                              {formatNumber(bucket.neutral)}
                            </TableCell>
                            <TableCell className="text-right text-rose-300">
                              {formatNumber(bucket.negative)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </SpotlightCard>

          <SpotlightCard>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Recent posts</h3>
                <p className="text-sm text-slate-100">
                  High-signal posts captured during the latest refresh cycle.
                </p>
              </div>
              <div className="space-y-4">
                {recentPosts.length === 0 ? (
                  <p className="text-sm text-slate-100">
                    No posts stored yet. Run a refresh to populate this list.
                  </p>
                ) : (
                  recentPosts.map((post) => {
                    const subreddit = data.subreddits.find(
                      (item) => item.id === post.subredditId,
                    );
                    const content = (
                      <div className="group flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-white/30 hover:bg-white/10">
                        <div className="flex items-start justify-between gap-4">
                          <p className="line-clamp-2 text-sm font-medium text-slate-100">
                            {post.title}
                          </p>
                          <ArrowUpRight className="hidden h-4 w-4 flex-shrink-0 text-slate-100 group-hover:inline" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-100">
                          <span className="rounded-full bg-white/10 px-2 py-0.5">
                            {subreddit?.displayName ?? post.subredditId}
                          </span>
                          <span>Score {formatNumber(post.score)}</span>
                          <span>Comments {formatNumber(post.commentCount)}</span>
                          <span className="text-slate-100">{formatTimestamp(post.postedAt)}</span>
                        </div>
                        <div>{sentimentBadge(post.sentimentLabel, post.sentimentScore)}</div>
                      </div>
                    );

                    return post.permalink ? (
                      <Link
                        key={post.id}
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={post.id}>{content}</div>
                    );
                  })
                )}
              </div>
            </div>
          </SpotlightCard>
        </section>
      </div>
    </div>
  );
}
