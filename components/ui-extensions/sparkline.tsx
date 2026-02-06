"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const vals = Array.isArray(values) ? values.filter((v) => typeof v === "number" && Number.isFinite(v)) : [];
  const has = vals.length >= 2;
  if (!has) return null;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1e-6, max - min);

  const w = 56;
  const h = 18;
  const pad = 1.5;

  const points = vals
    .map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
      const y = pad + (1 - clamp01((v - min) / span)) * (h - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className={cn("opacity-80", className)}
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

