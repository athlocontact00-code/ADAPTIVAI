"use client";

import { Loader2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

interface SettingsTopBarProps {
  title: string;
  description?: string;
  status: SaveStatus;
  hasChanges: boolean;
  onSave: () => void;
  onReset?: () => void;
  isSaving?: boolean;
}

export function SettingsTopBar({
  title,
  description,
  status,
  hasChanges,
  onSave,
  onReset,
  isSaving,
}: SettingsTopBarProps) {
  return (
    <header className="sm:sticky sm:top-0 z-10 -mx-4 px-4 py-2 sm:py-3 md:-mx-6 md:px-6 bg-background/80 backdrop-blur-md border-b border-white/[0.04]">
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="hidden sm:block mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={status} />
          {onReset && hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={isSaving}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSave}
            disabled={!hasChanges || isSaving}
            className="h-9 px-4 rounded-[10px]"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-2" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: SaveStatus }) {
  const config = {
    saved: { label: "Saved", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    unsaved: { label: "Unsaved", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    saving: { label: "Saving…", className: "bg-muted text-muted-foreground" },
    error: { label: "Error", className: "bg-destructive/10 text-destructive border-destructive/20" },
  }[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] font-normal px-2 py-0.5 rounded-md border",
        config.className
      )}
    >
      {config.label}
    </Badge>
  );
}
