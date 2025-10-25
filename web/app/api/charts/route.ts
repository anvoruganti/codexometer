import { NextResponse } from "next/server";
import { fetchDashboardData } from "@/lib/supabase/queries";
import { TIMEFRAMES, type Timeframe } from "@/lib/timeframes";

function normalizeTimeframe(input: string | null): Timeframe {
  if (!input) {
    return "7d";
  }
  return (Object.hasOwn(TIMEFRAMES, input) ? input : "7d") as Timeframe;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = normalizeTimeframe(searchParams.get("timeframe"));

  const data = await fetchDashboardData(timeframe);

  return NextResponse.json({
    timeframe,
    subreddits: data.subreddits,
    trend: data.trend,
    totals: data.subreddits.map((subreddit) => {
      const buckets = data.trend.filter((bucket) => bucket.subredditId === subreddit.id);
      return buckets.reduce(
        (acc, bucket) => {
          acc.positive += bucket.positive;
          acc.neutral += bucket.neutral;
          acc.negative += bucket.negative;
          acc.activity += bucket.activityCount;
          return acc;
        },
        {
          subredditId: subreddit.id,
          positive: 0,
          neutral: 0,
          negative: 0,
          activity: 0,
        },
      );
    }),
  });
}
