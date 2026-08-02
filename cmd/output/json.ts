/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * CLI JSON I/O helpers — JSON file reads, pretty stdout emission, and the
 * one-line human-readable stderr summary.
 */

import { readFileSync } from "node:fs";

/** Parses a UTF-8 JSON file into an unknown value (throws on IO/parse errors). */
export function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
}

/** Pretty-prints any JSON-serializable value to stdout (2-space indent). */
export function emitJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/** One-line human summary to stderr: "<label>: <message>". */
export function emitSummary(label: string, message: string): void {
  console.error(`${label}: ${message}`);
}
