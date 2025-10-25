"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const LINE_COLORS = ["#38bdf8", "#f97316", "#22c55e", "#a855f7", "#facc15"];

type TrendPoint = {
  subredditId: string;
  bucketStart: string;
  positive: number;
  negative: number;
};

type Subreddit = {
  id: string;
  displayName: string;
};

type Props = {
  data: TrendPoint[];
  subreddits: Subreddit[];
  className?: string;
};

function buildSeries(data: TrendPoint[], subreddits: Subreddit[]) {
  const buckets = Array.from(new Set(data.map((row) => row.bucketStart))).sort();

  return buckets.map((bucket) => {
    const entry: Record<string, number | string> = { bucket };
    subreddits.forEach((subreddit) => {
      const point = data.find(
        (row) => row.bucketStart === bucket && row.subredditId === subreddit.id,
      );
      entry[subreddit.id] = point ? point.positive - point.negative : 0;
    });
    return entry;
  });
}

export function SentimentNetChart({ data, subreddits, className }: Props) {
  const series = buildSeries(data, subreddits);

  if (series.length === 0) {
    return (
      <div className={cn("flex h-72 items-center justify-center text-sm text-slate-100", className)}>
        Net sentiment requires at least one refresh.
      </div>
    );
  }

  return (
    <div className={cn("flex h-72 flex-col gap-3", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
          <XAxis dataKey="bucket" stroke="rgba(148,163,184,0.8)" fontSize={12} />
          <YAxis stroke="rgba(148,163,184,0.8)" fontSize={12} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ color: "rgba(226,232,240,0.9)" }} />
          {subreddits.map((subreddit, index) => (
            <Line
              key={subreddit.id}
              type="monotone"
              dataKey={subreddit.id}
              name={subreddit.displayName}
              stroke={LINE_COLORS[index % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
