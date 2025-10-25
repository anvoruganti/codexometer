"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

type TrendPoint = {
  bucketStart: string;
  positive: number;
  neutral: number;
  negative: number;
};

type Props = {
  data: TrendPoint[];
  className?: string;
};

function buildShareSeries(data: TrendPoint[]) {
  const buckets = Array.from(new Set(data.map((row) => row.bucketStart))).sort();
  return buckets.map((bucket) => {
    const points = data.filter((row) => row.bucketStart === bucket);
    const totals = points.reduce(
      (acc, row) => {
        acc.positive += row.positive;
        acc.neutral += row.neutral;
        acc.negative += row.negative;
        return acc;
      },
      { positive: 0, neutral: 0, negative: 0 },
    );

    const total = totals.positive + totals.neutral + totals.negative || 1;
    return {
      bucket,
      positive: totals.positive / total,
      neutral: totals.neutral / total,
      negative: totals.negative / total,
    };
  });
}

export function SentimentShareChart({ data, className }: Props) {
  const series = buildShareSeries(data);

  if (series.length === 0) {
    return (
      <div className={cn("flex h-72 items-center justify-center text-sm text-slate-100", className)}>
        No sentiment snapshots available.
      </div>
    );
  }

  return (
    <div className={cn("h-72", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} stackOffset="expand">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
          <XAxis dataKey="bucket" stroke="rgba(148,163,184,0.8)" fontSize={12} />
          <YAxis
            tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
            stroke="rgba(148,163,184,0.8)"
            fontSize={12}
          />
          <Tooltip
            formatter={(value: number, name) => [`${Math.round(value * 100)}%`, name]}
          />
          <Area type="monotone" dataKey="positive" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
          <Area type="monotone" dataKey="neutral" stackId="1" stroke="#cbd5f5" fill="#cbd5f5" fillOpacity={0.6} />
          <Area type="monotone" dataKey="negative" stackId="1" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.6} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
