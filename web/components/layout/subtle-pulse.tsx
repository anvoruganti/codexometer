"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function SubtlePulse({ className }: Props) {
  return (
    <motion.span
      initial={{ opacity: 0.4, scale: 0.95 }}
      animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.95, 1.02, 0.95] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      className={cn("inline-flex h-2 w-2 rounded-full bg-emerald-500", className)}
    />
  );
}
