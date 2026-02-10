"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FlaskConical,
  Plus,
  Play,
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Trash2,
  BarChart3,
  Zap,
  Shield,
  Heart,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  createScenario,
  deleteScenario,
  runScenarioSimulation,
  applyScenario,
  explainScenarioWithCoach,
} from "@/lib/actions/simulator";
import {
  SCENARIO_PRESETS,
  ScenarioParams,
  formatScenarioParams,
  parseScenarioParams,
  BaselineMetrics,
} from "@/lib/services/simulator.service";

interface SimulationResult {
  weekIndex: number;
  simulatedCTL: number;
  simulatedATL: number;
  simulatedTSB: number;
  simulatedReadinessAvg: number;
  simulatedBurnoutRisk: number;
  weeklyTSS: number | null;
  insightsJson: string | null;
  warningsJson: string | null;
}

interface Scenario {
  id: string;
  name: string;
  durationWeeks: number;
  paramsJson: string;
  applied: boolean;
  appliedAt: Date | null;
  createdAt: Date;
  results: SimulationResult[];
}

interface SimulatorClientProps {
  scenarios: Scenario[];
  baseline: BaselineMetrics | null;
}

export function SimulatorClient({ scenarios, baseline }: SimulatorClientProps) {
  const router = useRouter();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    scenarios.length > 0 ? scenarios[0] : null
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareScenarios, setCompareScenarios] = useState<string[]>([]);
  const [coachText, setCoachText] = useState<string>("");
  const [isCoachLoading, setIsCoachLoading] = useState(false);

  useEffect(() => {
    setSelectedScenario((prev) => {
      if (!prev) return scenarios.length > 0 ? scenarios[0] : null;
      return scenarios.find((s) => s.id === prev.id) || (scenarios.length > 0 ? scenarios[0] : null);
    });
  }, [scenarios]);

  const [formData, setFormData] = useState({
    name: "",
    durationWeeks: 8,
    volumeChange: 10,
    intensityBias: "BALANCED" as "LOW" | "BALANCED" | "HIGH",
    recoveryFocus: "NORMAL" as "NORMAL" | "EXTRA",
    complianceAssumption: "REALISTIC" as "REALISTIC" | "OPTIMISTIC" | "CONSERVATIVE",
  });

  async function handleGenerateCoach() {
    if (!selectedScenario) return;
    setIsCoachLoading(true);
    try {
      const result = await explainScenarioWithCoach(selectedScenario.id);
      if (result.success && result.text) {
        setCoachText(result.text);
      } else {
        toast.error(result.error || "Failed to generate coach analysis");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsCoachLoading(false);
    }
  }

  async function handleCreateScenario() {
    if (!formData.name.trim()) {
      toast.error("Please enter a scenario name");
      return;
    }

    setIsCreating(true);
    try {
      const params: ScenarioParams = {
        volumeChange: formData.volumeChange,
        intensityBias: formData.intensityBias,
        recoveryFocus: formData.recoveryFocus,
        complianceAssumption: formData.complianceAssumption,
      };

      const result = await createScenario({
        name: formData.name,
        durationWeeks: formData.durationWeeks,
        params,
      });

      if (result.success) {
        toast.success("Scenario created!");
        setShowCreateDialog(false);
        setFormData({
          name: "",
          durationWeeks: 8,
          volumeChange: 10,
          intensityBias: "BALANCED",
          recoveryFocus: "NORMAL",
          complianceAssumption: "REALISTIC",
        });
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create scenario");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRunSimulation() {
    if (!selectedScenario) return;

    setIsRunning(true);
    try {
      const result = await runScenarioSimulation(selectedScenario.id);
      if (result.success) {
        toast.success("Simulation complete!");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to run simulation");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleApplyScenario() {
    if (!selectedScenario) return;

    setIsApplying(true);
    try {
      const result = await applyScenario(selectedScenario.id);
      if (result.success) {
        toast.success(result.message || "Scenario applied!");
        setShowApplyDialog(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to apply scenario");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsApplying(false);
    }
  }

  async function handleDeleteScenario(id: string) {
    try {
      const result = await deleteScenario(id);
      if (result.success) {
        toast.success("Scenario deleted");
        if (selectedScenario?.id === id) {
          setSelectedScenario(scenarios.find((s) => s.id !== id) || null);
        }
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete");
      }
    } catch {
      toast.error("Something went wrong");
    }
  }

  function applyPreset(presetKey: string) {
    const preset = SCENARIO_PRESETS[presetKey];
    if (preset) {
      setFormData({
        name: preset.name,
        durationWeeks: 8,
        volumeChange: preset.params.volumeChange,
        intensityBias: preset.params.intensityBias,
        recoveryFocus: preset.params.recoveryFocus,
        complianceAssumption: preset.params.complianceAssumption,
      });
    }
  }

  // Prepare chart data
  const chartData = selectedScenario?.results.map((r) => ({
    week: `W${r.weekIndex}`,
    CTL: r.simulatedCTL,
    ATL: r.simulatedATL,
    TSB: r.simulatedTSB,
    Readiness: r.simulatedReadinessAvg,
    Burnout: r.simulatedBurnoutRisk,
  })) || [];

  // Compare chart data
  const compareChartData = compareMode && compareScenarios.length > 0
    ? (() => {
        const maxWeeks = Math.max(
          ...scenarios
            .filter((s) => compareScenarios.includes(s.id))
            .map((s) => s.results.length)
        );
        const data: Array<Record<string, number | string>> = [];
        for (let w = 1; w <= maxWeeks; w++) {
          const point: Record<string, number | string> = { week: `W${w}` };
          scenarios
            .filter((s) => compareScenarios.includes(s.id))
            .forEach((s) => {
              const result = s.results.find((r) => r.weekIndex === w);
              if (result) {
                point[`${s.name} CTL`] = result.simulatedCTL;
                point[`${s.name} Burnout`] = result.simulatedBurnoutRisk;
              }
            });
          data.push(point);
        }
        return data;
      })()
    : [];

  // Get warnings and insights for selected scenario
  const selectedResults = selectedScenario?.results || [];
  const allWarnings = selectedResults.flatMap((r) =>
    r.warningsJson ? JSON.parse(r.warningsJson) : []
  );
  const allInsights = selectedResults.flatMap((r) =>
    r.insightsJson ? JSON.parse(r.insightsJson) : []
  );

  // Calculate summary
  const finalResult = selectedResults[selectedResults.length - 1];
  const ctlChange = finalResult && baseline
    ? (finalResult.simulatedCTL - baseline.ctl).toFixed(1)
    : "0";
  const peakBurnout = selectedResults.length > 0
    ? Math.max(...selectedResults.map((r) => r.simulatedBurnoutRisk))
    : 0;

  return (
    <div className="page-container space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FlaskConical className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">What-If Simulator</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Explore training scenarios without affecting real data
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompareMode(!compareMode)}
            className={cn(compareMode ? "bg-primary/10" : "", "min-w-0")}
          >
            <BarChart3 className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Compare
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)} className="min-w-0">
            <Plus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            New Scenario
          </Button>
        </div>
      </div>

      {/* Baseline Info */}
      {baseline && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Current Baseline (28-day avg)</div>
              <div className="flex gap-6 text-sm">
                <span>CTL: <strong>{baseline.ctl.toFixed(0)}</strong></span>
                <span>ATL: <strong>{baseline.atl.toFixed(0)}</strong></span>
                <span>TSB: <strong>{baseline.tsb.toFixed(0)}</strong></span>
                <span>Weekly TSS: <strong>{baseline.avgWeeklyTSS}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Scenarios List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Scenarios</CardTitle>
            <CardDescription>
              {scenarios.length} scenario{scenarios.length !== 1 ? "s" : ""} created
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scenarios.length === 0 ? (
              <div className="text-center py-8">
                <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  No scenarios yet. Create one to start exploring.
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Scenario
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {scenarios.map((scenario) => {
                  const params = parseScenarioParams(scenario.paramsJson);
                  const hasResults = scenario.results.length > 0;
                  const isSelected = selectedScenario?.id === scenario.id;
                  const isComparing = compareScenarios.includes(scenario.id);

                  return (
                    <div
                      key={scenario.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected && !compareMode
                          ? "border-primary bg-primary/5"
                          : isComparing
                          ? "border-blue-500 bg-blue-500/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        if (compareMode) {
                          setCompareScenarios((prev) =>
                            prev.includes(scenario.id)
                              ? prev.filter((id) => id !== scenario.id)
                              : prev.length < 3
                              ? [...prev, scenario.id]
                              : prev
                          );
                        } else {
                          setSelectedScenario(scenario);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{scenario.name}</p>
                            {scenario.applied && (
                              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {scenario.durationWeeks} weeks •{" "}
                            {params.volumeChange >= 0 ? "+" : ""}
                            {params.volumeChange}% volume
                          </p>
                          {hasResults && (
                            <p className="text-xs text-muted-foreground">
                              Final CTL: {scenario.results[scenario.results.length - 1]?.simulatedCTL.toFixed(0)}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScenario(scenario.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results View */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {compareMode ? "Scenario Comparison" : selectedScenario?.name || "Select a Scenario"}
                </CardTitle>
                {selectedScenario && !compareMode && (
                  <CardDescription>
                    {formatScenarioParams(parseScenarioParams(selectedScenario.paramsJson))}
                  </CardDescription>
                )}
              </div>
              {selectedScenario && !compareMode && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleRunSimulation} disabled={isRunning}>
                    {isRunning ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Run Simulation
                  </Button>
                  {selectedScenario.results.length > 0 && !selectedScenario.applied && (
                    <Button onClick={() => setShowApplyDialog(true)}>
                      <Zap className="mr-2 h-4 w-4" />
                      Apply
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {compareMode ? (
              compareScenarios.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="mx-auto h-12 w-12 mb-4" />
                  <p>Select up to 3 scenarios to compare</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={compareChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="week" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                          }}
                        />
                        <Legend />
                        {scenarios
                          .filter((s) => compareScenarios.includes(s.id))
                          .map((s, i) => (
                            <Line
                              key={s.id}
                              type="monotone"
                              dataKey={`${s.name} CTL`}
                              stroke={["#3b82f6", "#10b981", "#f59e0b"][i]}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {scenarios
                      .filter((s) => compareScenarios.includes(s.id))
                      .map((s) => {
                        const final = s.results[s.results.length - 1];
                        const peak = Math.max(...s.results.map((r) => r.simulatedBurnoutRisk));
                        return (
                          <Card key={s.id} className="bg-muted/30">
                            <CardContent className="pt-4">
                              <p className="font-medium mb-2">{s.name}</p>
                              <div className="space-y-1 text-sm">
                                <p>Final CTL: <strong>{final?.simulatedCTL.toFixed(0)}</strong></p>
                                <p>Peak Burnout: <strong className={peak > 60 ? "text-red-500" : ""}>{peak}%</strong></p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              )
            ) : !selectedScenario ? (
              <div className="text-center py-12 text-muted-foreground">
                <FlaskConical className="mx-auto h-12 w-12 mb-4" />
                <p>Select or create a scenario to view results</p>
              </div>
            ) : selectedScenario.results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Play className="mx-auto h-12 w-12 mb-4" />
                <p className="mb-4">Run the simulation to see projected results</p>
                <Button onClick={handleRunSimulation} disabled={isRunning}>
                  {isRunning ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Run Simulation
                </Button>
              </div>
            ) : (
              <Tabs defaultValue="charts" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="charts">Charts</TabsTrigger>
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                  <TabsTrigger value="warnings">
                    Warnings {allWarnings.length > 0 && `(${allWarnings.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="coach">Coach</TabsTrigger>
                </TabsList>

                <TabsContent value="charts" className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card className="bg-muted/30">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">CTL Change</p>
                        <p className={`text-2xl font-bold ${parseFloat(ctlChange) >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {parseFloat(ctlChange) >= 0 ? "+" : ""}{ctlChange}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Final CTL</p>
                        <p className="text-2xl font-bold">{finalResult?.simulatedCTL.toFixed(0)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Peak Burnout</p>
                        <p className={`text-2xl font-bold ${peakBurnout > 60 ? "text-red-500" : peakBurnout > 40 ? "text-yellow-500" : "text-green-500"}`}>
                          {peakBurnout}%
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/30">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Warnings</p>
                        <p className={`text-2xl font-bold ${allWarnings.length > 0 ? "text-yellow-500" : "text-green-500"}`}>
                          {allWarnings.length}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* CTL/ATL/TSB Chart */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Fitness Metrics Projection</h4>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="week" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                            }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="CTL" stroke="#3b82f6" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="ATL" stroke="#ef4444" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="TSB" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Readiness & Burnout Chart */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Readiness & Burnout Risk</h4>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="week" className="text-xs" />
                          <YAxis domain={[0, 100]} className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                            }}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="Readiness" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                          <Area type="monotone" dataKey="Burnout" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="insights">
                  {allInsights.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No insights generated</p>
                  ) : (
                    <div className="space-y-2">
                      {allInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <p className="text-sm">{insight}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="warnings">
                  {allWarnings.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                      <p className="text-sm text-muted-foreground">No warnings - scenario looks safe!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allWarnings.map((warning, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                          <p className="text-sm">{warning}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="coach" className="space-y-4">
                  <div className="flex items-center justify-end">
                    <Button variant="outline" onClick={handleGenerateCoach} disabled={isCoachLoading}>
                      {isCoachLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Generate analysis
                    </Button>
                  </div>

                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      {coachText.trim().length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Generate a coach-style analysis of this scenario (risks, sustainability, and next step).
                        </p>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{coachText}</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Scenario Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Scenario</DialogTitle>
            <DialogDescription>
              Define parameters for your what-if simulation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Presets */}
            <div className="space-y-2">
              <Label>Quick Presets</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => applyPreset("aggressive_build")}
                >
                  <Zap className="mr-2 h-4 w-4 text-red-500" />
                  Aggressive Build
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => applyPreset("balanced_progress")}
                >
                  <TrendingUp className="mr-2 h-4 w-4 text-blue-500" />
                  Balanced Progress
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => applyPreset("longevity_first")}
                >
                  <Heart className="mr-2 h-4 w-4 text-green-500" />
                  Longevity First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => applyPreset("comeback_safe")}
                >
                  <Shield className="mr-2 h-4 w-4 text-purple-500" />
                  Comeback Safe
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Scenario Name</Label>
              <Input
                placeholder="e.g., Marathon Build Phase"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Duration: {formData.durationWeeks} weeks</Label>
              <Slider
                value={[formData.durationWeeks]}
                onValueChange={(values: number[]) =>
                  setFormData({ ...formData, durationWeeks: values[0] })
                }
                min={2}
                max={12}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Volume Change: {formData.volumeChange >= 0 ? "+" : ""}{formData.volumeChange}%</Label>
              <Slider
                value={[formData.volumeChange]}
                onValueChange={(values: number[]) =>
                  setFormData({ ...formData, volumeChange: values[0] })
                }
                min={-50}
                max={50}
                step={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Intensity Bias</Label>
                <Select
                  value={formData.intensityBias}
                  onValueChange={(v: string) => {
                    if (v === "LOW" || v === "BALANCED" || v === "HIGH") {
                      setFormData({ ...formData, intensityBias: v });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="BALANCED">Balanced</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recovery Focus</Label>
                <Select
                  value={formData.recoveryFocus}
                  onValueChange={(v: string) => {
                    if (v === "NORMAL" || v === "EXTRA") {
                      setFormData({ ...formData, recoveryFocus: v });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="EXTRA">Extra Recovery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Compliance Assumption</Label>
              <Select
                value={formData.complianceAssumption}
                onValueChange={(v: string) => {
                  if (v === "CONSERVATIVE" || v === "REALISTIC" || v === "OPTIMISTIC") {
                    setFormData({ ...formData, complianceAssumption: v });
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSERVATIVE">Conservative (75%)</SelectItem>
                  <SelectItem value="REALISTIC">Realistic (85%)</SelectItem>
                  <SelectItem value="OPTIMISTIC">Optimistic (95%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateScenario} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Simulate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Scenario Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Scenario to Calendar?</DialogTitle>
            <DialogDescription>
              This will mark the scenario as applied. You can then use AI Coach to generate
              workouts based on these parameters.
            </DialogDescription>
          </DialogHeader>
          {selectedScenario && (
            <div className="py-4 space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="font-medium mb-2">{selectedScenario.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatScenarioParams(parseScenarioParams(selectedScenario.paramsJson))}
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-sm">
                  This action marks the scenario as your chosen plan. Real workouts will only
                  be created when you use AI Coach.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>Cancel</Button>
            <Button onClick={handleApplyScenario} disabled={isApplying}>
              {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Scenario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
