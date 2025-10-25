"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { refreshSentimentAction } from "@/actions/refresh-sentiment";
import { Button } from "@/components/ui/button";
import { SubtlePulse } from "@/components/layout/subtle-pulse";
import { Loader2, RefreshCw } from "lucide-react";

type Props = {
  defaultTimeframe: string;
};

export function RefreshButton({ defaultTimeframe }: Props) {
  const [isPending, startTransition] = useTransition();
  const [timeframe] = useState(defaultTimeframe);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "queued" | "error">("idle");

  useEffect(() => {
    if (status === "queued") {
      const timer = setTimeout(() => {
        setStatus("idle");
      }, 8000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status]);

  const onRefresh = useCallback(() => {
    startTransition(async () => {
      setErrorMessage(null);
      setStatus("queued");

      try {
        const result = await refreshSentimentAction({
          timeframe,
        });
        if (result.jobId) {
          setJobId(result.jobId);
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Refresh request failed.",
        );
      }
    });
  }, [timeframe]);

  return (
    <div className="space-y-2 text-slate-100">
      <Button
        onClick={onRefresh}
        disabled={isPending}
        size="sm"
        variant="secondary"
        className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 text-sm font-medium text-white transition hover:bg-white/20"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 transition group-hover:rotate-180" />
        )}
        {isPending ? "Queueing…" : "Refresh sentiment"}
      </Button>
      {status === "queued" && (
        <p className="flex items-center gap-2 text-xs text-emerald-300">
          <SubtlePulse /> Refresh queued with Supabase Edge Function{jobId ? (
            <>
              <span className="opacity-70">•</span>
              <span className="font-mono text-emerald-200">
                {jobId.slice(0, 8)}…
              </span>
            </>
          ) : null}
        </p>
      )}
      {errorMessage ? (
        <p className="text-xs text-rose-400">{errorMessage}</p>
      ) : null}
    </div>
  );
}
