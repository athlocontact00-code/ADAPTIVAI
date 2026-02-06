import { randomUUID } from "crypto";

export type LogLevel = "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export function createRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "non_serializable" });
  }
}

export function log(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const line = safeJson(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logInfo(message: string, context: LogContext = {}) {
  log("info", message, context);
}

export function logWarn(message: string, context: LogContext = {}) {
  log("warn", message, context);
}

export function logError(message: string, context: LogContext = {}) {
  log("error", message, context);
}
