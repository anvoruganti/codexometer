"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

export function SpotlightCard({ children, className }: SpotlightCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-white/80 p-[1px] shadow-[0_25px_60px_-30px_rgba(15,23,42,0.75)] backdrop-blur-lg",
        "dark:border-slate-800/60 dark:bg-slate-950/75",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_10%_-10%,rgba(56,189,248,0.18),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_90%_0%,rgba(236,72,153,0.18),transparent_65%)]" />
      <div className="relative rounded-[calc(theme(borderRadius.xl))] border border-white/5 bg-slate-900/80 p-6 text-slate-100">
        {children}
      </div>
    </motion.div>
  );
}
