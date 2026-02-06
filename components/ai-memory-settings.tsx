"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Eye,
  EyeOff,
  BarChart3,
  Download,
  Trash2,
  RefreshCw,
  Shield,
  AlertTriangle,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatLocalDateInput } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getMemorySummary,
  resetMemory,
  exportMemoryData,
  getVisibilityStats,
} from "@/lib/actions/ai-memory";
import type { AIMemorySummary } from "@/lib/services/ai-memory.service";

export function AIMemorySettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [memorySummary, setMemorySummary] = useState<AIMemorySummary | null>(null);
  const [visibilityStats, setVisibilityStats] = useState({
    total: 0,
    fullAccess: 0,
    metricsOnly: 0,
    hidden: 0,
    aiUsedCount: 0,
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    psychological: false,
    fatigue: false,
    preference: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [summaryResult, stats] = await Promise.all([
        getMemorySummary(),
        getVisibilityStats(),
      ]);

      if (summaryResult.success && summaryResult.data) {
        setMemorySummary(summaryResult.data);
      }
      setVisibilityStats(stats);
    } catch (_error) {
      toast.error("Failed to load AI memory data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (memoryType?: string) => {
    setIsResetting(true);
    try {
      const result = await resetMemory(memoryType as any);
      if (result.success) {
        toast.success(memoryType ? `${memoryType} memory reset` : "All AI memories reset");
        await loadData();
      } else {
        toast.error(result.error || "Failed to reset memory");
      }
    } catch (_error) {
      toast.error("An error occurred");
    } finally {
      setIsResetting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMemoryData();
      if (result.success && result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ai-memory-export-${formatLocalDateInput(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Memory data exported");
      } else {
        toast.error(result.error || "Failed to export");
      }
    } catch (_error) {
      toast.error("An error occurred");
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>AI Memory & Privacy</CardTitle>
                <CardDescription>
                  Control what the AI Coach learns from your data
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export Data
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isResetting}>
                    {isResetting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Reset All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset All AI Memories?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all AI-learned insights about you.
                      The AI Coach will start fresh and need to re-learn your patterns.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleReset()}>
                      Reset All Memories
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Visibility Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Diary Visibility Overview</CardTitle>
          <CardDescription>
            How much of your diary data the AI can access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">AI Visibility Score</span>
            <span className="font-semibold">{memorySummary?.visibilityScore || 0}%</span>
          </div>
          <Progress value={memorySummary?.visibilityScore || 0} className="h-2" />

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <Eye className="h-5 w-5 text-green-500 mx-auto mb-1" />
              <div className="text-2xl font-bold">{visibilityStats.fullAccess}</div>
              <div className="text-xs text-muted-foreground">Full Access</div>
            </div>
            <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
              <BarChart3 className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
              <div className="text-2xl font-bold">{visibilityStats.metricsOnly}</div>
              <div className="text-xs text-muted-foreground">Metrics Only</div>
            </div>
            <div className="text-center p-3 bg-red-500/10 rounded-lg">
              <EyeOff className="h-5 w-5 text-red-500 mx-auto mb-1" />
              <div className="text-2xl font-bold">{visibilityStats.hidden}</div>
              <div className="text-xs text-muted-foreground">Hidden</div>
            </div>
          </div>

          {visibilityStats.aiUsedCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">
                AI has learned from <strong>{visibilityStats.aiUsedCount}</strong> of your diary entries
              </span>
            </div>
          )}

          {memorySummary?.visibilityScore !== undefined && memorySummary.visibilityScore < 50 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-600">Limited AI Insights</p>
                <p className="text-muted-foreground">
                  With low visibility, the AI relies more on objective metrics and may ask more clarifying questions.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memory Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Memory Profiles</CardTitle>
          <CardDescription>
            Aggregated insights the AI has learned (no raw text stored)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {memorySummary?.totalDataPoints === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No AI memories yet</p>
              <p className="text-sm">The AI will learn from your diary entries over time</p>
            </div>
          ) : (
            <>
              {/* Psychological Profile */}
              {memorySummary?.psychological && (
                <Collapsible
                  open={expandedSections.psychological}
                  onOpenChange={() => toggleSection("psychological")}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">Psychological Profile</span>
                      </div>
                      {expandedSections.psychological ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 px-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Motivation Baseline</span>
                        <p className="font-medium">{memorySummary.psychological.motivationBaseline}/5</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stress Tolerance</span>
                        <p className="font-medium">{memorySummary.psychological.stressTolerance}/5</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mood Stability</span>
                        <p className="font-medium">{Math.round(memorySummary.psychological.moodStability * 100)}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stress Recovery</span>
                        <p className="font-medium">~{memorySummary.psychological.stressRecoveryDays} days</p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Fatigue Response Profile */}
              {memorySummary?.fatigueResponse && (
                <Collapsible
                  open={expandedSections.fatigue}
                  onOpenChange={() => toggleSection("fatigue")}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Fatigue Response</span>
                      </div>
                      {expandedSections.fatigue ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 px-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Recovery Rate</span>
                        <p className="font-medium">{memorySummary.fatigueResponse.recoveryRate}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sleep Sensitivity</span>
                        <p className="font-medium">{Math.round(memorySummary.fatigueResponse.sleepSensitivity * 100)}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Optimal Sleep</span>
                        <p className="font-medium">{memorySummary.fatigueResponse.optimalSleepHours}h</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Energy Pattern</span>
                        <p className="font-medium">{memorySummary.fatigueResponse.energyPatterns.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Preference Profile */}
              {memorySummary?.preference && (
                <Collapsible
                  open={expandedSections.preference}
                  onOpenChange={() => toggleSection("preference")}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Training Preferences</span>
                      </div>
                      {expandedSections.preference ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 px-3">
                    <div className="space-y-3 text-sm">
                      {memorySummary.preference.preferredSessionTypes.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Enjoys</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {memorySummary.preference.preferredSessionTypes.map((type) => (
                              <Badge key={type} variant="secondary" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {memorySummary.preference.avoidedSessionTypes.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Struggles With</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {memorySummary.preference.avoidedSessionTypes.map((type) => (
                              <Badge key={type} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-muted-foreground">Intensity Preference</span>
                          <p className="font-medium">{memorySummary.preference.intensityPreference}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Variety Preference</span>
                          <p className="font-medium">{Math.round(memorySummary.preference.varietyPreference * 100)}%</p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Trust & Safety */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-500" />
            Trust & Safety Guarantees
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>AI only learns from entries you&apos;ve allowed (FULL_AI_ACCESS or METRICS_ONLY)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Raw diary text is never stored in AI memory - only aggregated insights</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Hidden entries are completely ignored by the AI</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>You can reset AI memory at any time</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Export your data anytime for full transparency</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
