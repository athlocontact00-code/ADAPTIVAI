"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createSeasonManual,
  autoCreateSeasonWizard,
  autoCreateBlocks,
  updateBlock,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  dismissSeasonAlert,
} from "@/lib/actions/season";
import type { SeasonHQ, BlockHQ, MilestoneHQ } from "@/lib/types/season";
import type { AutoCreateWizardInput } from "@/lib/types/season";
import { SeasonEmptyState } from "./components/season-empty-state";
import { SeasonNoBlocks } from "./components/season-no-blocks";
import { SeasonHeader } from "./components/season-header";
import { BlocksTimeline } from "./components/blocks-timeline";
import { BlockEditorPanel } from "./components/block-editor-panel";
import { SeasonIntelligence } from "./components/season-intelligence";
import { AutoCreateWizard } from "./components/auto-create-wizard";
import { CreateSeasonDialog } from "./components/create-season-dialog";
import { AddMilestoneDialog } from "./components/add-milestone-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface SeasonClientProps {
  season: (SeasonHQ & { currentWeekStats?: import("@/lib/actions/season").CurrentWeekStats }) | null;
}

export function SeasonClient({ season }: SeasonClientProps) {
  const router = useRouter();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [editMilestone, setEditMilestone] = useState<MilestoneHQ | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockHQ | null>(null);
  const [blockPanelOpen, setBlockPanelOpen] = useState(false);

  const handleAutoCreate = async (input: AutoCreateWizardInput) => {
    const res = await autoCreateSeasonWizard(input);
    if (res.success) {
      toast.success("Season created!");
      router.refresh();
    } else {
      toast.error(res.error || "Failed to create season");
    }
  };

  const handleCreateManual = async (data: Parameters<typeof createSeasonManual>[0]) => {
    const res = await createSeasonManual(data);
    if (res.success) {
      toast.success("Season created!");
      router.refresh();
    } else {
      toast.error(res.error || "Failed to create season");
    }
  };

  const handleAutoCreateBlocks = async () => {
    if (!season) return;
    const res = await autoCreateBlocks(season.id);
    if (res.success) {
      toast.success("Blocks created!");
      router.refresh();
    } else {
      toast.error(res.error || "Failed to create blocks");
    }
  };

  const handleSaveBlock = useCallback(async (
    id: string,
    data: {
      type?: string;
      startDate?: string;
      endDate?: string;
      focus?: string | null;
      targetHoursMin?: number;
      targetHoursMax?: number;
      targetTSSMin?: number;
      targetTSSMax?: number;
      focusDiscipline?: string;
      focusLabel?: string | null;
      guardrails?: { maxHardSessionsPerWeek?: number; rampRateLimit?: number };
    }
  ) => {
    const res = await updateBlock(id, {
      ...data,
      focus: data.focus ?? undefined,
      focusLabel: data.focusLabel ?? undefined,
    });
    if (res.success) {
      toast.success("Block updated");
      router.refresh();
    } else {
      toast.error(res.error || "Failed to update block");
    }
  }, [router]);

  const handleAddMilestone = useCallback(async (data: { name: string; date: string; kind: string; distance?: string; priority?: string; goalTime?: string; notes?: string }) => {
    if (!season) return;
    const res = await createMilestone({ ...data, seasonId: season.id });
    if (res.success) {
      toast.success("Milestone added!");
      router.refresh();
      setShowMilestone(false);
    } else {
      toast.error(res.error || "Failed to add milestone");
    }
  }, [season, router]);

  const handleUpdateMilestone = useCallback(async (id: string, data: { name?: string; date?: string; kind?: string; distance?: string; priority?: string; goalTime?: string; notes?: string }) => {
    const res = await updateMilestone(id, data);
    if (res.success) {
      toast.success("Milestone updated");
      router.refresh();
      setShowMilestone(false);
      setEditMilestone(null);
    } else {
      toast.error(res.error || "Failed to update milestone");
    }
  }, [router]);

  const handleDeleteMilestone = useCallback(async (id: string) => {
    const res = await deleteMilestone(id);
    if (res.success) {
      toast.success("Milestone removed");
      router.refresh();
    } else {
      toast.error(res.error || "Failed to delete milestone");
    }
  }, [router]);

  const handleDismissAlert = useCallback(async (id: string) => {
    const res = await dismissSeasonAlert(id);
    if (res.success) router.refresh();
  }, [router]);

  const handleBlockClick = useCallback((block: BlockHQ) => {
    setSelectedBlock(block);
    setBlockPanelOpen(true);
  }, []);

  const handleEditBlocks = useCallback(() => {
    timelineRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (season === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!season) {
    return (
      <>
        <SeasonEmptyState onCreateManual={() => setShowCreate(true)} onAutoCreate={() => setShowWizard(true)} />
        <AutoCreateWizard open={showWizard} onOpenChange={setShowWizard} onSubmit={handleAutoCreate} />
        <CreateSeasonDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreateManual} />
      </>
    );
  }

  const hasBlocks = season.trainingBlocks.length > 0;

  return (
    <div className="space-y-6">
      <SeasonHeader
        season={season}
        weekStats={season.currentWeekStats ?? null}
        hasBlocks={hasBlocks}
        onAutoCreateBlocks={handleAutoCreateBlocks}
        onEditBlocks={handleEditBlocks}
        onAddMilestone={() => { setEditMilestone(null); setShowMilestone(true); }}
      />

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div ref={timelineRef}>
            {hasBlocks ? (
              <BlocksTimeline
                blocks={season.trainingBlocks}
                seasonStart={new Date(season.startDate)}
                seasonEnd={new Date(season.endDate)}
                onBlockClick={handleBlockClick}
                selectedBlockId={selectedBlock?.id ?? null}
              />
            ) : (
              <SeasonNoBlocks onAutoCreateBlocks={handleAutoCreateBlocks} />
            )}
          </div>
        </div>

        <SeasonIntelligence
          weekStats={season.currentWeekStats ?? null}
          alerts={season.seasonAlerts ?? []}
          milestones={season.raceEvents}
          onDismissAlert={handleDismissAlert}
          onAddMilestone={() => { setEditMilestone(null); setShowMilestone(true); }}
          onEditMilestone={(m) => { setEditMilestone(m); setShowMilestone(true); }}
          onDeleteMilestone={handleDeleteMilestone}
        />
      </div>

      <BlockEditorPanel
        block={selectedBlock}
        open={blockPanelOpen}
        onOpenChange={setBlockPanelOpen}
        onSave={handleSaveBlock}
      />

      <AddMilestoneDialog
        open={showMilestone}
        onOpenChange={setShowMilestone}
        seasonId={season.id}
        editMilestone={editMilestone}
        onSubmit={handleAddMilestone}
        onUpdate={handleUpdateMilestone}
      />
    </div>
  );
}
