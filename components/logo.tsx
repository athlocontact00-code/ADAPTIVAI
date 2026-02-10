"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/logo.png";

export function Logo({
  size = 32,
  className,
  alt = "AdaptivAI",
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src={LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      priority
    />
  );
}
