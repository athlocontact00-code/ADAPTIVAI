"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type HealthData = {
  ok: boolean;
  build?: { commit?: string; env: string };
  db?: { ok: boolean; latencyMs?: number };
  stripe?: { ok: boolean; mode: string };
  time?: string;
  urls?: { nextAuthUrl: string; appUrl: string };
};

export default function StatusPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (_e) {
      setData({ ok: false });
      toast.error("Failed to load health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const copyDiagnostics = () => {
    if (!data) return;
    const raw = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(raw).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Copy failed")
    );
  };

  return (
    <div className="container max-w-2xl py-8">
      <Card className="border-white/[0.08] bg-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Status & Health
            <Button variant="ghost" size="icon" onClick={fetchHealth} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant={data?.ok ? "default" : "destructive"}>
                  App {data?.ok ? "OK" : "Error"}
                </Badge>
                <Badge variant={data?.db?.ok ? "default" : "destructive"}>
                  DB {data?.db?.ok ? "OK" : "Error"}
                  {typeof data?.db?.latencyMs === "number" && ` · ${data.db.latencyMs}ms`}
                </Badge>
                <Badge variant={data?.stripe?.ok ? "default" : "secondary"}>
                  Stripe {data?.stripe?.ok ? "OK" : "—"} {data?.stripe?.mode ? `(${data.stripe.mode})` : ""}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                {data?.urls && (
                  <>
                    <p>NEXTAUTH_URL: {data.urls.nextAuthUrl}</p>
                    <p>APP_URL: {data.urls.appUrl}</p>
                  </>
                )}
                {data?.build && (
                  <p>Env: {data.build.env}{data.build.commit ? ` · ${data.build.commit.slice(0, 7)}` : ""}</p>
                )}
                {data?.time && <p>Time: {data.time}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={copyDiagnostics} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy diagnostics
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
