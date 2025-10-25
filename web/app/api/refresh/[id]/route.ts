import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("refresh_jobs")
    .select(
      "id, status, timeframe, keyword, triggered_at, started_at, finished_at, error, posts_processed, comments_processed, sentiments_processed, duration_ms",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch refresh job status.", details: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Refresh job not found.", id: params.id },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
