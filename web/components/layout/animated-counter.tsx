"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  duration?: number;
};

export function AnimatedCounter({ value, duration = 1000 }: Props) {
  const [displayValue, setDisplayValue] = useState(() => Math.floor(value));
  const startValueRef = useRef<number>(Math.floor(value));
  const previousValueRef = useRef<number>(Math.floor(value));
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const targetValue = Math.floor(value);

    previousValueRef.current = targetValue;
    startValueRef.current = startValue;
    startTimeRef.current = null;

    if (startValue === targetValue) {
      setDisplayValue(targetValue);
      return;
    }

    let frame = 0;

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      const nextValue =
        startValueRef.current + (targetValue - startValueRef.current) * progress;

      setDisplayValue(Math.round(nextValue));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{displayValue.toLocaleString()}</span>;
}
