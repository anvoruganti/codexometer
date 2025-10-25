export type SentimentLabel = "positive" | "neutral" | "negative";

export function labelFromScore(score: number): SentimentLabel {
  if (score >= 0.05) {
    return "positive";
  }

  if (score <= -0.05) {
    return "negative";
  }

  return "neutral";
}
