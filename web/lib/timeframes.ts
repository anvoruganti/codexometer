export type Timeframe = "24h" | "7d" | "30d";

export const TIMEFRAMES: Record<Timeframe, { label: string; hours: number }> = {
  "24h": { label: "Last 24 hours", hours: 24 },
  "7d": { label: "Last 7 days", hours: 7 * 24 },
  "30d": { label: "Last 30 days", hours: 30 * 24 },
};

export function getSinceDate(timeframe: Timeframe): Date {
  const { hours } = TIMEFRAMES[timeframe];
  const date = new Date();
  date.setUTCHours(date.getUTCHours() - hours);
  return date;
}
