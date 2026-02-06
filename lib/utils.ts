import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getDateKey(date: Date): string {
  return formatLocalDateInput(date);
}

export function formatLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function parseDateToLocalNoon(input: string | Date): Date {
  if (input instanceof Date) {
    const d = new Date(input);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  // Handle date-only strings safely (YYYY-MM-DD)
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(input);
  if (m) {
    const [y, mo, da] = input.split("-").map((n) => parseInt(n, 10));
    return new Date(y, mo - 1, da, 12, 0, 0, 0);
  }

  // Fallback: parse as Date, then normalize to local noon
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    // Last resort: return now at local noon
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    return now;
  }
  d.setHours(12, 0, 0, 0);
  return d;
}
