"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNotificationCenter, markNotificationRead, markAllNotificationsRead, type NotificationItem } from "@/lib/actions/notifications";

type LoadState = "idle" | "loading" | "error";

const toneConfig = {
  info: { icon: Info, className: "text-sky-400" },
  warning: { icon: AlertTriangle, className: "text-amber-400" },
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationCenter() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [status, setStatus] = useState<LoadState>("idle");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setStatus("loading");
      const result = await getNotificationCenter();
      if (!active) return;
      if (!result.success) {
        setStatus("error");
        return;
      }
      setItems(result.items ?? []);
      setStatus("idle");
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const unreadCount = items.filter((i) => i.dbId && i.read === false).length;
  const hasUnread = unreadCount > 0;

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">Notifications</div>
        <DropdownMenuSeparator />
        {status === "loading" ? (
          <div className="space-y-2 px-3 py-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ) : status === "error" ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            Unable to load notifications right now.
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">All caught up.</div>
        ) : (
          items.map((item) => {
            const Icon = toneConfig[item.tone].icon;
            const iconClass = toneConfig[item.tone].className;
            const content = (
              <div className="flex items-start gap-2">
                <div className={cn("mt-0.5 rounded-full bg-muted/40 p-1", iconClass)}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-foreground">{item.title}</div>
                  <div className="text-[11px] text-muted-foreground">{item.description}</div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {formatTimestamp(item.createdAt)}
                  </div>
                </div>
                <Badge variant={item.tone === "warning" ? "warning" : "info"} className="ml-auto h-4 px-1 text-[9px]">
                  {item.tone === "warning" ? "Warn" : "Info"}
                </Badge>
              </div>
            );

            const handleClick = () => {
              if (item.dbId) markNotificationRead(item.dbId);
            };
            return item.href ? (
              <DropdownMenuItem key={item.id} asChild>
                <Link href={item.href} className="cursor-pointer" onClick={handleClick}>
                  {content}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={item.id} className="cursor-default">
                {content}
              </DropdownMenuItem>
            );
          })
        )}
        {hasUnread && items.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleMarkAllRead} className="cursor-pointer">
              Mark all as read
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/calendar">Open calendar</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
