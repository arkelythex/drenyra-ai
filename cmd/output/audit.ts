/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * Structured audit log — zero-dependency JSONL emitter for operational events.
 *
 * Every event is emitted as exactly one JSON object on one line (JSONL), so the
 * stream is filterable with jq on any field:
 *
 *   jq 'select(.ruc == "20123456789" and .period == "202507")' audit.jsonl
 *
 * The four tenant-boundary fields — mission_id, ruc, period, user_id — are
 * ALWAYS present on every event. Missing context fails closed to "unknown"
 * (never omitted, never empty), so a tenant-scoped query never breaks on a
 * partially-populated event. `company_id` is emitted when the caller provides
 * it, and `ruc` is derived from it when it has the eleven-digit RUC shape
 * (see `inferRuc`); an explicit `ruc` always wins.
 *
 * Sink resolution (first match wins):
 *   1. DRENYRA_AUDIT_LOG=<path> — append JSONL to that file (synchronous
 *      append; CLI-scale volume, no stream lifecycle to leak).
 *   2. otherwise — stderr. stdout is reserved for command JSON results
 *      (emitJson); mixing audit lines into stdout would break
 *      `drenyra-ai mission start ... | jq`.
 *
 * Level filter: DRENYRA_AUDIT_LEVEL=debug|info|warn|error (default: info).
 *
 * Deliberately dependency-free: the package ships "library modules use
 * node:crypto only" and a pino/winston dependency would contradict that
 * identity. JSON.stringify is sufficient for CLI-scale audit volume.
 */

import { appendFileSync } from "node:fs";

export type AuditLevel = "debug" | "info" | "warn" | "error";

/** Numeric precedence used for level filtering. */
export const AUDIT_LEVEL_ORDER: Readonly<Record<AuditLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export const AUDIT_LEVELS: readonly AuditLevel[] = [
  "debug",
  "info",
  "warn",
  "error",
];

/** Tenant-boundary context attached to every event (all optional; fail-closed to "unknown"). */
export interface AuditContext {
  readonly mission_id?: string;
  readonly ruc?: string;
  readonly period?: string;
  readonly user_id?: string;
  readonly company_id?: string;
}

/** One JSONL audit event. */
export interface AuditEvent extends AuditContext {
  readonly timestamp: string;
  readonly level: AuditLevel;
  readonly event: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface AuditSink {
  write(line: string): void;
}

export interface AuditLogger {
  /** Effective level; events below it are dropped. */
  readonly level: AuditLevel;
  /** Returns a new logger with merged (immutable) context. */
  child(context: AuditContext): AuditLogger;
  debug(
    event: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): void;
  info(
    event: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): void;
  warn(
    event: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): void;
  error(
    event: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): void;
}

export interface AuditLoggerOptions {
  /** Overrides DRENYRA_AUDIT_LEVEL. */
  readonly level?: AuditLevel;
  /** Overrides the default stderr/file sink (used by tests). */
  readonly sink?: AuditSink;
  /** Context merged into every event emitted by this logger. */
  readonly context?: AuditContext;
}

const FALLBACK = "unknown";

/** Exactly eleven ASCII digits: the Peruvian RUC shape. */
const RUC_SHAPE = /^[0-9]{11}$/;

/**
 * Derives the audit `ruc` field from a company id: the company id IS the RUC
 * when it has the eleven-digit shape; anything else fails closed to "unknown".
 */
export function inferRuc(companyId: string): string {
  return RUC_SHAPE.test(companyId) ? companyId : FALLBACK;
}

/**
 * Returns a JSON-safe copy of the details payload. Non-serializable values
 * (BigInt, cyclic references) must never break the audit log: they fall back
 * to a stable textual rendering.
 */
function stringifyDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (details === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(details)) as Record<string, unknown>;
  } catch {
    return { unserializable: String(details) };
  }
}

function resolveSink(): AuditSink {
  const path = process.env.DRENYRA_AUDIT_LOG;
  if (path !== undefined && path.length > 0) {
    return {
      write(line: string): void {
        appendFileSync(path, `${line}\n`);
      },
    };
  }
  return {
    write(line: string): void {
      process.stderr.write(`${line}\n`);
    },
  };
}

function resolveLevel(): AuditLevel {
  const raw = process.env.DRENYRA_AUDIT_LEVEL;
  if (raw !== undefined && (AUDIT_LEVELS as readonly string[]).includes(raw)) {
    return raw as AuditLevel;
  }
  return "info";
}

/** Creates an audit logger; options override environment-derived defaults. */
export function createAuditLogger(options: AuditLoggerOptions = {}): AuditLogger {
  const level = options.level ?? resolveLevel();
  const sink = options.sink ?? resolveSink();
  const baseContext: AuditContext = options.context ?? {};

  function emit(
    eventLevel: AuditLevel,
    event: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): void {
    if (AUDIT_LEVEL_ORDER[eventLevel] < AUDIT_LEVEL_ORDER[level]) {
      return;
    }
    const ruc =
      baseContext.ruc ??
      (baseContext.company_id !== undefined
        ? inferRuc(baseContext.company_id)
        : FALLBACK);
    const eventRecord: AuditEvent = {
      timestamp: new Date().toISOString(),
      level: eventLevel,
      event,
      message,
      mission_id: baseContext.mission_id ?? FALLBACK,
      ruc,
      period: baseContext.period ?? FALLBACK,
      user_id: baseContext.user_id ?? FALLBACK,
      ...(baseContext.company_id !== undefined
        ? { company_id: baseContext.company_id }
        : {}),
      ...(details !== undefined ? { details: stringifyDetails(details) } : {}),
        };
        try {
          sink.write(JSON.stringify(eventRecord));
        } catch {
          // Fail-open: an audit transport failure (for example an unwritable
          // DRENYRA_AUDIT_LOG path) must NEVER change the outcome of the
          // business operation being recorded. The audit log is advisory;
          // command JSON results, exit codes, and receipts stay authoritative.
        }
      }
    
      return {
    level,
    child(context: AuditContext): AuditLogger {
      return createAuditLogger({
        level,
        sink,
        context: { ...baseContext, ...context },
      });
    },
    debug(event, message, details) {
      emit("debug", event, message, details);
    },
    info(event, message, details) {
      emit("info", event, message, details);
    },
    warn(event, message, details) {
      emit("warn", event, message, details);
    },
    error(event, message, details) {
      emit("error", event, message, details);
    },
  };
}
