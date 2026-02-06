"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface HowItWorksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HowItWorksDialog({ open, onOpenChange }: HowItWorksDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How It Works</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-3">
          <p>The AI Coach uses a rules-based engine that:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Analyzes your profile and goals</li>
            <li>Reviews last 2 weeks of training</li>
            <li>Creates polarized structure</li>
            <li>Respects +15% load limit</li>
            <li>Avoids back-to-back hard days</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
