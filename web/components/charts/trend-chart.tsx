/* eslint-disable react/no-unused-prop-types */
"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

type TrendPoint = {
  subredditId: string;
  bucketStart: string;
  positive: number;
  neutral: number;
  negative: number;
  activityCount: number;
};

type Subreddit = {
  id: string;
  displayName: string;
};

type Props = {
  data: TrendPoint[];
  subreddits: Subreddit[];
  selectedSubredditId: string | "all";
  className?: string;
};

const SENTIMENT_COLORS = {
  positive: "#16a34a",
  neutral: "#6b7280",
  negative: "#dc2626",
};

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function buildSeries(data: TrendPoint[], subredditId: string | "all") {
  const grouped = new Map<
    string,
    { positive: number; neutral: number; negative: number }
  >();

  data.forEach((point) => {
    if (subredditId !== "all" && point.subredditId !== subredditId) {
      return;
    }

    const existing = grouped.get(point.bucketStart) ?? {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    grouped.set(point.bucketStart, {
      positive: existing.positive + point.positive,
      neutral: existing.neutral + point.neutral,
      negative: existing.negative + point.negative,
    });
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([bucket, values]) => ({
      bucket,
      ...values,
    }));
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
};

function TrendTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/90 p-3 text-xs shadow-xl backdrop-blur dark:bg-slate-900/90">
      <p className="mb-2 font-medium text-slate-900 dark:text-slate-100">
        {`Bucket: ${formatDateLabel(label ?? "")}`}
      </p>
      <div className="space-y-1 text-slate-700 dark:text-slate-200">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2">
              <span
                className="inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({
  data,
  subreddits,
  selectedSubredditId,
  className,
}: Props) {
  const series = buildSeries(data, selectedSubredditId);

  const subtitle =
    selectedSubredditId === "all"
      ? "Aggregate sentiment counts across all tracked subreddits."
      : `Sentiment counts for ${
          subreddits.find((item) => item.id === selectedSubredditId)
            ?.displayName ?? "selected subreddit"
        }.`;

  if (series.length === 0) {
    return (
      <div className={cn("flex h-72 flex-col items-start justify-center gap-3", className)}>
        <p className="text-sm text-slate-100 dark:text-slate-100">{subtitle}</p>
        <span className="text-sm text-slate-100 dark:text-slate-100">
          No sentiment points yet. Trigger a refresh to populate this chart.
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex h-72 flex-col gap-4", className)}>
      <p className="text-sm text-slate-100 dark:text-slate-100">{subtitle}</p>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series}>
          <defs>
            <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SENTIMENT_COLORS.positive} stopOpacity={0.3} />
              <stop offset="95%" stopColor={SENTIMENT_COLORS.positive} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="neutralGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SENTIMENT_COLORS.neutral} stopOpacity={0.3} />
              <stop offset="95%" stopColor={SENTIMENT_COLORS.neutral} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SENTIMENT_COLORS.negative} stopOpacity={0.3} />
              <stop offset="95%" stopColor={SENTIMENT_COLORS.negative} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis
            dataKey="bucket"
            tickFormatter={formatDateLabel}
            stroke="rgba(148,163,184,0.7)"
            fontSize={12}
          />
          <YAxis stroke="rgba(148,163,184,0.7)" fontSize={12} allowDecimals={false} />
          <Legend wrapperStyle={{ color: "rgba(148,163,184,0.9)" }} />
          <Tooltip content={<TrendTooltip />} />
          <Area
            type="monotone"
            dataKey="positive"
            stroke={SENTIMENT_COLORS.positive}
            fill="url(#positiveGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="neutral"
            stroke={SENTIMENT_COLORS.neutral}
            fill="url(#neutralGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="negative"
            stroke={SENTIMENT_COLORS.negative}
            fill="url(#negativeGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
