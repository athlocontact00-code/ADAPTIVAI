"use client";

import { useState } from "react";
import {
  Info,
  ChevronDown,
  ChevronUp,
  Brain,
  Activity,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AIWhyPanelProps {
  title?: string;
  explanation: string;
  factors?: Array<{
    type: "positive" | "negative" | "neutral";
    label: string;
    value?: string;
  }>;
  confidence?: number;
  basedOn?: string[];
  compact?: boolean;
}

export function AIWhyPanel({
  title = "Why this recommendation",
  explanation,
  factors,
  confidence,
  basedOn,
  compact = false,
}: AIWhyPanelProps) {
  const [isOpen, setIsOpen] = useState(!compact);

  const getFactorIcon = (type: "positive" | "negative" | "neutral") => {
    switch (type) {
      case "positive":
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "negative":
        return <AlertTriangle className="h-3 w-3 text-orange-500" />;
      default:
        return <Info className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Brain className="h-4 w-4" />
            <span>{title}</span>
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
            <p className="text-muted-foreground">{explanation}</p>
            {factors && factors.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {factors.map((factor, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 text-xs"
                  >
                    {getFactorIcon(factor.type)}
                    <span>{factor.label}</span>
                    {factor.value && (
                      <span className="text-muted-foreground">({factor.value})</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Card className="bg-muted/30 border-muted">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{title}</h4>
              {confidence !== undefined && (
                <Badge variant="outline" className="text-xs">
                  {confidence}% confidence
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{explanation}</p>
            
            {factors && factors.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {factors.map((factor, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background text-xs"
                  >
                    {getFactorIcon(factor.type)}
                    <span>{factor.label}</span>
                    {factor.value && (
                      <span className="text-muted-foreground">{factor.value}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {basedOn && basedOn.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Based on: {basedOn.join(" • ")}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIAdaptationBadge({
  decision,
  onClick,
}: {
  decision: string;
  onClick?: () => void;
}) {
  const getDecisionStyle = (d: string) => {
    switch (d) {
      case "PROCEED":
        return "bg-green-500/10 text-green-500 border-green-500/30";
      case "REDUCE_INTENSITY":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/30";
      case "SHORTEN":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "SWAP_RECOVERY":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case "REST":
        return "bg-purple-500/10 text-purple-500 border-purple-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getDecisionLabel = (d: string) => {
    switch (d) {
      case "PROCEED":
        return "As Planned";
      case "REDUCE_INTENSITY":
        return "Intensity Reduced";
      case "SHORTEN":
        return "Shortened";
      case "SWAP_RECOVERY":
        return "Swapped to Recovery";
      case "REST":
        return "Rest Day";
      default:
        return d.replace(/_/g, " ");
    }
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-colors hover:opacity-80 ${getDecisionStyle(decision)}`}
    >
      <Brain className="h-3 w-3" />
      {getDecisionLabel(decision)}
    </button>
  );
}

export function FeedbackUsedIndicator({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Activity className="h-3 w-3" />
      <span>
        AI used {count} feedback {count === 1 ? "entry" : "entries"} from your recent sessions
      </span>
    </div>
  );
}
