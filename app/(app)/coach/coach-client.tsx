"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  Sparkles,
  Loader2,
  TrendingUp,
  Clock,
  Zap,
  Battery,
  ChevronRight,
  History,
  AlertTriangle,
  Heart,
  RefreshCw,
  Send,
  MessageSquare,
  Plus,
  Pin,
  CheckCircle,
} from "lucide-react";
import { applySimplifyWeek, applyRecoveryMicrocycle } from "@/lib/actions/psychology";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CoachCommandChips, type CoachCommandChip } from "@/components/coach/command-chips";
import { CoachCommandCenter } from "@/components/coach/coach-command-center";
import { CoachMessageRenderer } from "@/components/coach/coach-message-renderer";
import { CoachContextToggles, type CoachContextPayload } from "@/components/coach/coach-context-toggles";
import { HowItWorksDialog } from "@/components/coach/how-it-works-dialog";
import { PaywallCard } from "@/components/paywall-card";
import { sendCoachMessage } from "@/lib/actions/coach-chat";
import { undoDraftWorkouts, insertWorkoutFromCoachResponse, updateCoachIncludeResultTemplate } from "@/lib/actions/coach-draft";
import { isSendToCalendarIntent, extractCoachIntent } from "@/lib/utils/coach-intent";

const EMPTY_STATE_MESSAGE =
  "No workouts yet. Generate today's workout or start a chat.";

// Mobile-only command palette: 1 quick prompt + More actions (bottom sheet).
const MOBILE_CHIPS: CoachCommandChip[] = [
  { label: "What should I do today?", template: "What should I do today?" },
  { label: "Generate today", template: "Generate today's workout" },
  { label: "Plan week", template: "Generate a week training plan" },
  { label: "Add swim", template: "Add a swim session to my plan" },
  { label: "Change tomorrow", template: "Change tomorrow's workout" },
  { label: "Adjust based on check-in", template: "Adjust today based on check-in" },
  { label: "Explain today", template: "Explain today's workout" },
  { label: "Adjust my plan…", template: "Adjust my plan due to: [fatigue/soreness/time]" },
  { label: "Summarize last 7 days", template: "Summarize my last 7 days" },
];
interface PlanLog {
  id: string;
  startDate: Date;
  endDate: Date;
  summaryMd: string;
  createdAt: Date;
}

interface CoachContext {
  sport: string;
  experienceLevel: string;
  weeklyHoursGoal: number;
  currentCtl: number;
  currentAtl: number;
  currentTsb: number;
  readiness: number;
  lastWeekHours: number;
  lastWeekTss: number;
  workoutsLastWeek: number;
  coachIncludeResultTemplate?: boolean;
}

interface PsychologyData {
  compliance: {
    score: number;
    status: string;
    completionRate: number;
    currentStreak: number;
    nudge: string | null;
  } | null;
  burnout: {
    risk: number;
    status: string;
    drivers: { driver: string; description: string }[];
    recommendation: string;
    actions: { id: string; label: string; description: string }[];
  } | null;
  insight: {
    text: string;
    type: string;
  } | null;
}

interface CoachPageData {
  todayWorkout: { id: string; title: string; type: string; durationMin: number | null; tss: number | null } | null;
  todayTss: number;
  weekPlannedHours: number;
  weekPlannedTss: number;
  weekCompliancePercent: number;
  rampStatus: "rising" | "stable" | "spiking";
  lastCheckInDate: Date | null;
  atl: number;
}

interface CoachClientProps {
  userId: string;
  context: CoachContext | null;
  recentLogs: PlanLog[];
  psychologyData?: PsychologyData | null;
  pageData?: CoachPageData | null;
  canUseAICoach?: boolean;
  trialEndsAt?: Date | null;
}

interface Message {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  timestamp: Date;
}

type StoredMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  timestamp: string;
};

type StoredConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
  pinned?: boolean;
  planApplied?: boolean;
};

export function CoachClient({ userId, context, recentLogs, psychologyData, pageData = null, canUseAICoach = true, trialEndsAt }: CoachClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = searchParams.get("prefill");
  const didInitConversationsForUserId = useRef<string | null>(null);
  const [isApplyingAction, setIsApplyingAction] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSearch, setChatSearch] = useState("");
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [contextPayload, setContextPayload] = useState<CoachContextPayload>({
    useCheckInData: true,
    useDiaryNotes: false,
    useSeasonGoals: true,
    timeBudgetHours: context?.weeklyHoursGoal ?? 5,
  });

  useEffect(() => {
    if (context?.weeklyHoursGoal != null) {
      setContextPayload((p) => ({ ...p, timeBudgetHours: context.weeklyHoursGoal }));
    }
  }, [context?.weeklyHoursGoal]);

  useEffect(() => {
    if (!prefill) return;
    setDraft((prev) => (prev.trim().length > 0 ? prev : prefill));
  }, [prefill]);

  useEffect(() => {
    if (didInitConversationsForUserId.current === userId) return;
    didInitConversationsForUserId.current = userId;

    const STORAGE_KEY = `adaptivai.coach.conversations.v1.${userId}`;
    const ACTIVE_KEY = `adaptivai.coach.activeConversationId.v1.${userId}`;
    const LEGACY_STORAGE_KEY = "adaptivai.coach.conversations.v1";
    const LEGACY_ACTIVE_KEY = "adaptivai.coach.activeConversationId.v1";
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as StoredConversation[]) : [];

      let storedConversations = Array.isArray(parsed) ? parsed : [];
      let storedActiveId = window.localStorage.getItem(ACTIVE_KEY);

      // One-time migration from legacy keys (pre user-scoped storage)
      if (storedConversations.length === 0) {
        const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        const legacyParsed = legacyRaw ? (JSON.parse(legacyRaw) as StoredConversation[]) : [];
        const legacyConversations = Array.isArray(legacyParsed) ? legacyParsed : [];
        const legacyActiveId = window.localStorage.getItem(LEGACY_ACTIVE_KEY);
        if (legacyConversations.length > 0) {
          storedConversations = legacyConversations;
          storedActiveId = legacyActiveId;
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyConversations));
          if (legacyActiveId) window.localStorage.setItem(ACTIVE_KEY, legacyActiveId);
        }
      }

      if (storedConversations.length > 0) {
        setConversations(storedConversations);

        const candidate = storedActiveId && storedConversations.some((c) => c.id === storedActiveId)
          ? storedActiveId
          : storedConversations[0].id;

        setActiveConversationId(candidate);
        const conv = storedConversations.find((c) => c.id === candidate);
        if (conv) {
          setMessages(
            conv.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp),
            }))
          );
        }
        return;
      }

      const now = new Date();
      const id = `conv-${now.getTime()}`;
      const initial: StoredConversation = {
        id,
        title: "New chat",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        messages: [
          {
            id: "welcome",
            role: "assistant",
            content: EMPTY_STATE_MESSAGE,
            timestamp: now.toISOString(),
          },
        ],
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([initial]));
      window.localStorage.setItem(ACTIVE_KEY, id);
      setConversations([initial]);
      setActiveConversationId(id);
      setMessages(
        initial.messages.map((m) => ({
          id: m.id,
          role: m.role as "assistant" | "user" | "system",
          content: m.content,
          timestamp: new Date(m.timestamp),
        }))
      );
    } catch {
      const now = new Date();
      const id = `conv-${now.getTime()}`;
      const fallback: StoredConversation = {
        id,
        title: "New chat",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        messages: [
          {
            id: "welcome",
            role: "assistant",
            content: EMPTY_STATE_MESSAGE,
            timestamp: now.toISOString(),
          },
        ],
      };
      setConversations([fallback]);
      setActiveConversationId(id);
      setMessages(
        fallback.messages.map((m) => ({
          id: m.id,
          role: m.role as "assistant" | "user" | "system",
          content: m.content,
          timestamp: new Date(m.timestamp),
        }))
      );
    }
  }, [context, userId]);

  useEffect(() => {
    if (!activeConversationId) return;
    if (typeof window === "undefined") return;

    const STORAGE_KEY = `adaptivai.coach.conversations.v1.${userId}`;
    const ACTIVE_KEY = `adaptivai.coach.activeConversationId.v1.${userId}`;

    const nowIso = new Date().toISOString();
    const firstUser = messages.find((m) => m.role === "user")?.content?.trim();
    const title = firstUser && firstUser.length > 0 ? firstUser.slice(0, 48) : "New chat";

    const storedMessages: StoredMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
    }));

    setConversations((prev) => {
      const next = prev.some((c) => c.id === activeConversationId)
        ? prev.map((c) =>
            c.id === activeConversationId
              ? {
                  ...c,
                  title,
                  updatedAt: nowIso,
                  messages: storedMessages,
                }
              : c
          )
        : [
            {
              id: activeConversationId,
              title,
              createdAt: nowIso,
              updatedAt: nowIso,
              messages: storedMessages,
            },
            ...prev,
          ];

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.localStorage.setItem(ACTIVE_KEY, activeConversationId);
      } catch {
      }
      return next;
    });
  }, [messages, activeConversationId, userId]);

  function startNewChat() {
    const now = new Date();
    const id = `conv-${now.getTime()}`;
    const welcome: Message = {
      id: "welcome",
      role: "assistant",
      content: EMPTY_STATE_MESSAGE,
      timestamp: now,
    };
    setActiveConversationId(id);
    setMessages([welcome]);
  }

  function handleCommand(cmd: string) {
    setDraft(cmd);
  }

  function switchConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setActiveConversationId(id);
    setMessages(
      conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
      }))
    );
  }

  function getLastUserPreview(conv: StoredConversation): string {
    for (let i = conv.messages.length - 1; i >= 0; i -= 1) {
      const m = conv.messages[i];
      if (m.role === "user" && typeof m.content === "string") return m.content;
    }
    return "";
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;

    const historyForRequest = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      },
    ]);
    setDraft("");

    setMessages((prev) => [
      ...prev,
      {
        id: `thinking-${Date.now()}`,
        role: "system",
        content: "🤔 Thinking…",
        timestamp: new Date(),
      },
    ]);

    try {
      if (isSendToCalendarIntent(text)) {
        const intent = extractCoachIntent(text);
        const sportFilter =
          intent.sport !== "UNKNOWN" && intent.sport !== "MIXED"
            ? (intent.sport as "SWIM" | "BIKE" | "RUN" | "STRENGTH")
            : undefined;
        const dateFilter = intent.constraints?.date;
        const assistantMessages = [...messages]
          .filter((m) => m.role === "assistant")
          .map((m) => m.content)
          .reverse();
        const lastAssistant = assistantMessages[0];
        const insertResult = await insertWorkoutFromCoachResponse(lastAssistant ?? "", {
          forceMode: "final",
          assistantMessages: assistantMessages.length > 0 ? assistantMessages : undefined,
          sportFilter,
          dateFilter,
        });
        if (insertResult.success) {
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.id.startsWith("thinking-"));
            const idLine =
              insertResult.createdIds?.length
                ? ` (Workout ID: ${insertResult.createdIds[0]})`
                : "";
            return [
              ...filtered,
              {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: `Added to calendar ✅${idLine}`,
                timestamp: new Date(),
              },
            ];
          });
          toast.success("Added to calendar");
          router.refresh();
          return;
        }
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.id.startsWith("thinking-"));
          return [
            ...filtered,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: insertResult.error ?? "Nie widzę ostatnio rozpisanego treningu do zapisania. Napisz np.: „rozpisz trening na dziś (swim/bike/run)”, a potem „dodaj do kalendarza”.",
              timestamp: new Date(),
            },
          ];
        });
        toast.info("Brak treningu do zapisania – doprecyzuj lub poproś o rozpisanie.");
        return;
      }

      const result = await sendCoachMessage({
        input: text,
        history: historyForRequest,
        contextOverrides: {
          useCheckInData: contextPayload.useCheckInData,
          useDiaryNotes: contextPayload.useDiaryNotes,
          useSeasonGoals: contextPayload.useSeasonGoals,
          timeBudgetHours: contextPayload.timeBudgetHours,
        },
      });

      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.id.startsWith("thinking-"));

        if (!result.ok) {
          return [
            ...filtered,
            {
              id: `error-${Date.now()}`,
              role: "assistant",
              content: `❌ ${result.error}`,
              timestamp: new Date(),
            },
          ];
        }

        return [
          ...filtered,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: result.text,
            timestamp: new Date(),
          },
        ];
      });

      if (!result.ok) {
        toast.error(result.error);
        if ((result as { code?: string }).code === "PAYWALL") {
          router.refresh();
        }
      } else if (result.meta?.createdWorkoutIds?.length) {
        const ids = result.meta.createdWorkoutIds;
        toast.success("Added to calendar (Draft)", {
          action: {
            label: "Undo",
            onClick: async () => {
              const r = await undoDraftWorkouts(ids);
              if (r.success && r.deleted > 0) {
                toast.success("Removed from calendar");
                router.refresh();
              }
            },
          },
        });
      }
    } catch {
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.id.startsWith("thinking-"));
        return [
          ...filtered,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "❌ Sorry — I couldn't reach the coach right now. Please try again.",
            timestamp: new Date(),
          },
        ];
      });

      toast.error("Failed to send message");
    }
  }

  async function handleBurnoutAction(actionId: string) {
    setIsApplyingAction(actionId);
    try {
      const result = actionId === "simplify" 
        ? await applySimplifyWeek()
        : await applyRecoveryMicrocycle();
      
      if (result.success) {
        toast.success(result.message);
        router.refresh();
        setMessages(prev => [
          ...prev,
          {
            id: `action-${Date.now()}`,
            role: "assistant",
            content: actionId === "simplify"
              ? "✅ I've simplified your workouts for the next 7 days. Intensity reduced, but the habit stays intact."
              : "✅ Recovery microcycle created. Focus on rest, gentle movement, and mental reset this week.",
            timestamp: new Date(),
          },
        ]);
      } else {
        toast.error(result.error || "Failed to apply action");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsApplyingAction(null);
    }
  }

  if (!canUseAICoach) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Coach</h1>
            <p className="text-sm text-muted-foreground">Generate personalized training plans</p>
          </div>
        </div>
        <PaywallCard
          title="Trial ended"
          message="Upgrade to Pro to use AI Coach and unlock all premium features."
          trialEndsAt={trialEndsAt}
        />
      </div>
    );
  }

  return (
    <div className="page-container space-y-4 sm:space-y-6">
      {/* Burnout Warning Banner */}
      {psychologyData?.burnout && (psychologyData.burnout.status === "MODERATE" || psychologyData.burnout.status === "HIGH") && (
        <div className="hidden sm:block">
          <Card className={`border-l-4 ${psychologyData.burnout.status === "HIGH" ? "border-l-red-500 bg-red-500/5" : "border-l-yellow-500 bg-yellow-500/5"}`}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`h-5 w-5 mt-0.5 ${psychologyData.burnout.status === "HIGH" ? "text-red-500" : "text-yellow-500"}`} />
                <div className="flex-1">
                  <p className="font-medium">
                    {psychologyData.burnout.status === "HIGH" ? "High Burnout Risk Detected" : "Burnout Warning"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {psychologyData.burnout.recommendation}
                  </p>
                  {psychologyData.burnout.actions.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {psychologyData.burnout.actions.map((action) => (
                        <Button
                          key={action.id}
                          variant={action.id === "recovery" ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleBurnoutAction(action.id)}
                          disabled={isApplyingAction !== null}
                        >
                          {isApplyingAction === action.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            <>
                              {action.id === "recovery" ? <Heart className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                              {action.label}
                            </>
                          )}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="hidden sm:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Coach</h1>
            <p className="text-sm text-muted-foreground">
              Generate personalized training plans
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          className="text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded"
        >
          How it works
        </button>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Main Chat Panel — on mobile show first so chat is visible */}
        <div className="order-first lg:order-none lg:col-span-2">
          <Card className="flex flex-col min-h-[420px] h-[70dvh] sm:min-h-[320px] sm:h-[480px] lg:h-[600px]">
            <CardHeader className="border-b">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                Training Assistant
              </CardTitle>
            </CardHeader>

            {/* MOBILE: minimal quick prompt + More actions */}
            <div className="sm:hidden border-b border-border/60 p-3 bg-muted/20 min-w-0">
              <div className="min-w-0 overflow-hidden">
                <CoachCommandChips value={draft} onChange={setDraft} chips={MOBILE_CHIPS} maxVisible={1} />
              </div>
            </div>

            {/* DESKTOP/TABLET: command chips */}
            <div className="hidden sm:block border-b border-border/60 p-4 space-y-3 bg-muted/20 min-w-0">
              <p className="text-sm font-medium text-foreground">Ask or choose a command</p>
              <div className="min-w-0 overflow-hidden">
                <CoachCommandChips value={draft} onChange={setDraft} maxVisible={3} />
              </div>
            </div>

            {/* Messages */}
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scroll-touch">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : message.role === "system"
                        ? "bg-muted/50 text-muted-foreground italic"
                        : "bg-muted"
                    }`}
                  >
                    <CoachMessageRenderer
                      content={message.content}
                      role={message.role}
                      className={message.role === "user" ? "text-primary-foreground" : ""}
                    />
                  </div>
                </div>
              ))}
            </CardContent>

            {/* Input */}
            <div className="border-t border-border/60 p-4 space-y-3 bg-background safe-area-inset-bottom">
              <div className="hidden sm:block">
                <CoachContextToggles value={contextPayload} onChange={setContextPayload} />
                <label className="mt-3 flex items-start sm:items-center gap-2 text-sm text-foreground/90 cursor-pointer min-w-0">
                  <input
                    type="checkbox"
                    checked={context?.coachIncludeResultTemplate !== false}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      const res = await updateCoachIncludeResultTemplate(checked);
                      if (res.success) router.refresh();
                    }}
                    className="rounded border-input shrink-0 mt-0.5 sm:mt-0"
                  />
                  <span className="min-w-0">Include result template in workout descriptions</span>
                </label>
              </div>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask a question or use a command chip…"
                rows={3}
                className="min-h-[44px] border-border/70 bg-card/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-2"
              />
              <Button onClick={handleSend} variant="default" className="w-full min-h-[44px] font-medium">
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </Card>
        </div>

        {/* Command center: on mobile below chat (order-2), on lg full width above (lg:order-first lg:col-span-3) */}
        <div className="hidden sm:block order-2 lg:order-first lg:col-span-3">
          <CoachCommandCenter pageData={pageData} context={context} onCommand={handleCommand} onRefresh={() => router.refresh()} />
        </div>

        {/* Chats sidebar */}
        <div className="hidden sm:block order-3 lg:col-span-1 space-y-4">
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chats
                </span>
                <Button size="sm" variant="outline" onClick={startNewChat}>
                  <Plus className="mr-2 h-4 w-4" />
                  New
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search chats…"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="space-y-2">
                {[...conversations]
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .filter((c) => {
                    if (!chatSearch.trim()) return true;
                    const q = chatSearch.toLowerCase();
                    return (c.title || "").toLowerCase().includes(q) || getLastUserPreview(c).toLowerCase().includes(q);
                  })
                  .slice(0, 10)
                  .map((c) => {
                    const isActive = c.id === activeConversationId;
                    const updated = new Date(c.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const preview = getLastUserPreview(c);
                    const planApplied = c.planApplied ?? false;
                    const pinned = c.pinned ?? false;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => switchConversation(c.id)}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
                          isActive
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium">{c.title || "New chat"}</span>
                              {planApplied && (
                                <span title="Plan applied" aria-label="Plan applied">
                                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                </span>
                              )}
                              {pinned && (
                                <span title="Pinned" aria-label="Pinned">
                                  <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-muted-foreground mt-0.5">{preview}</div>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{updated}</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Current Status */}
          {context && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Current Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Battery className="h-4 w-4 text-muted-foreground" />
                    <span>Readiness</span>
                  </div>
                  <span className={`font-medium ${
                    context.readiness >= 70 ? "text-green-500" : 
                    context.readiness >= 40 ? "text-yellow-500" : "text-red-500"
                  }`}>
                    {Math.round(context.readiness)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span>Fitness (CTL)</span>
                  </div>
                  <span className="font-medium">{Math.round(context.currentCtl)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span>Fatigue (ATL)</span>
                  </div>
                  <span className="font-medium">{Math.round(context.currentAtl)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Last Week</span>
                  </div>
                  <span className="font-medium">{context.lastWeekHours}h</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Plans */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No plans generated yet
                </p>
              ) : (
                <div className="space-y-2">
                  {recentLogs.slice(0, 3).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50"
                    >
                      <span>
                        {new Date(log.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })} - {new Date(log.endDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      <HowItWorksDialog open={showHowItWorks} onOpenChange={setShowHowItWorks} />
    </div>
  );
}