import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    timeframe?: string;
    keyword?: string | null;
  };

  const timeframe = body.timeframe ?? "7d";
  const keyword = body.keyword?.trim() || null;

  const edgeFunctionUrl = process.env.SUPABASE_EDGE_FUNCTION_URL;

  if (!edgeFunctionUrl) {
    return NextResponse.json(
      {
        error: "Supabase Edge Function URL is not configured.",
        timeframe,
        keyword,
      },
      { status: 503 },
    );
  }

  const authToken =
    process.env.SUPABASE_SERVICE_ROLE_JWT ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authToken) {
    return NextResponse.json(
      {
        error: "Missing Supabase service token for Edge Function invocation.",
      },
      { status: 500 },
    );
  }

  const response = await fetch(edgeFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      apikey: authToken,
    },
    body: JSON.stringify({ timeframe, keyword }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      {
        error: "Edge Function invocation failed.",
        details: errorText,
      },
      { status: 502 },
    );
  }

  const result = (await response.json()) as Record<string, unknown>;

  return NextResponse.json(result);
}
