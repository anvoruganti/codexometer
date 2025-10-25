"use server";

import { revalidateTag } from "next/cache";

export async function refreshSentimentAction(input: {
  timeframe: string;
  keyword?: string | null;
}) {
  const payload = {
    timeframe: input.timeframe,
    keyword: input.keyword ?? null,
  };

  const edgeFunctionUrl = process.env.SUPABASE_EDGE_FUNCTION_URL;
  const authToken =
    process.env.SUPABASE_SERVICE_ROLE_JWT ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!edgeFunctionUrl) {
    throw new Error("Supabase Edge Function URL is not configured.");
  }

  if (!authToken) {
    throw new Error("Missing Supabase service token for Edge Function invocation.");
  }

  const response = await fetch(edgeFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      apikey: authToken,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to request sentiment refresh: ${errorText}`);
  }

  const json = (await response.json()) as { timeframe: string; jobId?: string };

  revalidateTag(`sentiment:${json.timeframe}`);
  revalidateTag("sentiment:jobs");

  return json;
}
