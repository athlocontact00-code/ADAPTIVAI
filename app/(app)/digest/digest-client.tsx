"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface DigestItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  subject: string | null;
  text: string | null;
  data: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

export function DigestClient({ digests }: { digests: DigestItem[] }) {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  const selected = useMemo(
    () => (selectedId ? digests.find((d) => d.id === selectedId) : null),
    [selectedId, digests]
  );

  if (digests.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No digests yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your first weekly digest will appear here after the first full week of training.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {selected ? (
        <DigestDetail digest={selected} />
      ) : (
        <div className="grid gap-3">
          {digests.map((d) => (
            <Link
              key={d.id}
              href={`/digest?id=${d.id}`}
              className="block"
            >
              <Card className="border border-border/50 hover:border-border transition-colors cursor-pointer">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {d.subject || "Weekly digest"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.weekStart).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {" – "}
                        {new Date(d.weekEnd).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">View →</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DigestDetail({ digest }: { digest: DigestItem }) {
  let parsedData: {
    totalHours?: number;
    totalTSS?: number;
    compliancePercent?: number;
    avgReadiness?: number;
    avgEnjoyment?: number;
    bullets?: string[];
  } | null = null;
  try {
    parsedData = digest.data ? JSON.parse(digest.data) : null;
  } catch {
    // ignore
  }

  const bullets = parsedData?.bullets ?? (digest.text ? digest.text.split("\n").filter(Boolean) : []);

  return (
    <Card>
      <CardContent className="py-5 px-5">
        <Link
          href="/digest"
          className="text-xs text-muted-foreground hover:text-foreground mb-4 inline-block"
        >
          ← Back to list
        </Link>
        <h2 className="text-lg font-semibold mb-1">
          {digest.subject || "Weekly digest"}
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          {new Date(digest.weekStart).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
          {" – "}
          {new Date(digest.weekEnd).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>

        {parsedData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {typeof parsedData.totalHours === "number" && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                <p className="text-xs text-muted-foreground">Hours</p>
                <p className="text-sm font-semibold">{parsedData.totalHours.toFixed(1)}h</p>
              </div>
            )}
            {typeof parsedData.totalTSS === "number" && parsedData.totalTSS > 0 && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                <p className="text-xs text-muted-foreground">TSS</p>
                <p className="text-sm font-semibold">{parsedData.totalTSS}</p>
              </div>
            )}
            {typeof parsedData.compliancePercent === "number" && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                <p className="text-xs text-muted-foreground">Compliance</p>
                <p className="text-sm font-semibold">{parsedData.compliancePercent}%</p>
              </div>
            )}
            {typeof parsedData.avgReadiness === "number" && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
                <p className="text-xs text-muted-foreground">Readiness</p>
                <p className="text-sm font-semibold">{parsedData.avgReadiness}/100</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          {bullets.length > 0 ? (
            bullets.map((b, i) => (
              <p key={i} className="text-sm text-foreground">
                • {b.trim()}
              </p>
            ))
          ) : digest.text ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">{digest.text}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
