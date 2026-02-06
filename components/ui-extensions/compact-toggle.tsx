"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function CompactToggle({
  value,
  onChange,
  className,
  label = "Compact",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

