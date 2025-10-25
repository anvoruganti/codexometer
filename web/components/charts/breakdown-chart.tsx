"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

type Subreddit = {
  id: string;
  displayName: string;
};

type Totals = {
  subredditId: string;
  positive: number;
  neutral: number;
  negative: number;
  activity: number;
};

type Props = {
  totals: Totals[];
  subreddits: Subreddit[];
  className?: string;
};

const SENTIMENT_COLORS = {
  positive: "#16a34a",
  neutral: "#6b7280",
  negative: "#dc2626",
};

function buildChartData(totals: Totals[], subreddits: Subreddit[]) {
  return totals.map((row) => ({
    subreddit:
      subreddits.find((item) => item.id === row.subredditId)?.displayName ??
      row.subredditId,
    positive: row.positive,
    neutral: row.neutral,
    negative: row.negative,
  }));
}

export function BreakdownChart({ totals, subreddits, className }: Props) {
  const data = buildChartData(totals, subreddits);

  if (data.length === 0) {
    return (
      <div className={cn("flex h-72 items-center justify-center text-sm text-slate-100", className)}>
        No subreddit sentiment data yet.
      </div>
    );
  }

  return (
    <div className={cn("h-72", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey="subreddit" stroke="rgba(148,163,184,0.7)" fontSize={12} />
          <YAxis stroke="rgba(148,163,184,0.7)" fontSize={12} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} />
          <Legend wrapperStyle={{ color: "rgba(148,163,184,0.9)" }} />
          <Bar dataKey="positive" stackId="sentiment" fill={SENTIMENT_COLORS.positive} />
          <Bar dataKey="neutral" stackId="sentiment" fill={SENTIMENT_COLORS.neutral} />
          <Bar dataKey="negative" stackId="sentiment" fill={SENTIMENT_COLORS.negative} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
