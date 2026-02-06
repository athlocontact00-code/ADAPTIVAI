"use client";

import { useState } from "react";
import {
  Eye,
  EyeOff,
  BarChart3,
  Brain,
  Check,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { updateDiaryVisibility } from "@/lib/actions/ai-memory";

type VisibilityLevel = "FULL_AI_ACCESS" | "METRICS_ONLY" | "HIDDEN";

interface DiaryVisibilityToggleProps {
  entryId: string;
  currentLevel: VisibilityLevel;
  aiUsed: boolean;
  aiUsedAt?: Date | null;
  compact?: boolean;
  onUpdate?: (newLevel: VisibilityLevel) => void;
}

const VISIBILITY_OPTIONS: {
  value: VisibilityLevel;
  label: string;
  description: string;
  icon: typeof Eye;
  color: string;
}[] = [
  {
    value: "FULL_AI_ACCESS",
    label: "Full Access",
    description: "AI can read everything including notes",
    icon: Eye,
    color: "text-green-500",
  },
  {
    value: "METRICS_ONLY",
    label: "Metrics Only",
    description: "AI sees scores but not text",
    icon: BarChart3,
    color: "text-yellow-500",
  },
  {
    value: "HIDDEN",
    label: "Hidden",
    description: "AI ignores this entry completely",
    icon: EyeOff,
    color: "text-red-500",
  },
];

export function DiaryVisibilityToggle({
  entryId,
  currentLevel,
  aiUsed,
  aiUsedAt,
  compact = false,
  onUpdate,
}: DiaryVisibilityToggleProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [level, setLevel] = useState<VisibilityLevel>(currentLevel);

  const currentOption = VISIBILITY_OPTIONS.find((o) => o.value === level);
  const Icon = currentOption?.icon || Eye;

  const handleChange = async (newLevel: VisibilityLevel) => {
    setIsUpdating(true);
    try {
      const result = await updateDiaryVisibility(entryId, newLevel);
      if (result.success) {
        setLevel(newLevel);
        onUpdate?.(newLevel);
        toast.success("Visibility updated");
      } else {
        toast.error(result.error || "Failed to update");
      }
    } catch (_error) {
      toast.error("An error occurred");
    } finally {
      setIsUpdating(false);
    }
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                const currentIndex = VISIBILITY_OPTIONS.findIndex((o) => o.value === level);
                const nextIndex = (currentIndex + 1) % VISIBILITY_OPTIONS.length;
                handleChange(VISIBILITY_OPTIONS[nextIndex].value);
              }}
              disabled={isUpdating}
              className={`p-1.5 rounded-md hover:bg-muted transition-colors ${currentOption?.color}`}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{currentOption?.label}</p>
            <p className="text-xs text-muted-foreground">{currentOption?.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">AI Visibility</span>
        </div>
        {aiUsed && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs">
                  <Check className="h-3 w-3 mr-1 text-green-500" />
                  AI used this entry
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {aiUsedAt ? (
                  <p>Used on {new Date(aiUsedAt).toLocaleDateString()}</p>
                ) : (
                  <p>This entry was used for AI learning</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <Select
        value={level}
        onValueChange={(value) => handleChange(value as VisibilityLevel)}
        disabled={isUpdating}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            <div className="flex items-center gap-2">
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className={`h-4 w-4 ${currentOption?.color}`} />
              )}
              <span>{currentOption?.label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {VISIBILITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <option.icon className={`h-4 w-4 ${option.color}`} />
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          {level === "FULL_AI_ACCESS" && "The AI Coach can read all data including your notes to provide personalized insights."}
          {level === "METRICS_ONLY" && "The AI Coach can see your mood, stress, and other scores, but not your written notes."}
          {level === "HIDDEN" && "This entry is completely private. The AI Coach will not see or learn from it."}
        </p>
      </div>
    </div>
  );
}
