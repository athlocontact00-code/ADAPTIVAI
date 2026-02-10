"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const MARK_DARK = "/brand/logo-mark-dark.svg";
const LOCKUP_DARK = "/brand/logo-lockup-dark.svg";

export function Logo({
  size = 32,
  variant = "mark",
  className,
  alt = "AdaptivAI",
}: {
  size?: number;
  variant?: "mark" | "lockup";
  className?: string;
  alt?: string;
}) {
  const src = variant === "lockup" ? LOCKUP_DARK : MARK_DARK;
  const isLockup = variant === "lockup";
  const w = isLockup ? Math.round(size * (220 / 48)) : size;
  const h = size;

  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      className={cn("shrink-0 object-contain", className)}
      priority
    />
  );
}
