"use client";

import {
  Eye,
  EyeOff,
  BarChart3,
  Shield,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PrivacySettingsSection() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>AI Privacy Controls</CardTitle>
            <CardDescription>
              Control what the AI Coach can see and learn from
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Diary Visibility Levels</h4>
          
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
              <Eye className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-600">Full AI Access</p>
                <p className="text-xs text-muted-foreground">
                  AI can read everything including your notes. Best for personalized coaching.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
              <BarChart3 className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-600">Metrics Only</p>
                <p className="text-xs text-muted-foreground">
                  AI sees your mood, stress, and other scores, but not your written notes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <EyeOff className="h-4 w-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-600">Hidden</p>
                <p className="text-xs text-muted-foreground">
                  This entry is completely private. AI will not see or learn from it.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• AI only learns from entries you&apos;ve allowed</p>
              <p>• Raw diary text is never stored in AI memory</p>
              <p>• You can change visibility anytime from the diary</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
