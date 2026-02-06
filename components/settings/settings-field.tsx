"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface SettingsFieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}

export function SettingsField({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: SettingsFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label
          htmlFor={htmlFor}
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
        </Label>
      )}
      {children}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </div>
  );
}

interface InputAdornmentProps {
  suffix?: string;
  children: React.ReactNode;
  className?: string;
}

export function InputWithAdornment({ suffix, children, className }: InputAdornmentProps) {
  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-[12px] border border-white/[0.08] bg-background/50 px-3 transition-default focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10",
        className
      )}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {suffix && (
        <span className="ml-2 text-xs text-muted-foreground tabular-nums">{suffix}</span>
      )}
    </div>
  );
}
