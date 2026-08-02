/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai candidate verify <candidate.json> --subject <subject-file>`
 *
 * Revalidates candidate identity by hashing the exact bytes of the subject
 * file and comparing them to the candidate's subjectHash field. Exit 0 when
 * they match, 1 otherwise (JSON result to stdout), 2 for usage/IO errors.
 */

import { readFileSync } from "node:fs";
import { computeSubjectHash } from "../../candidates/identity.js";
import { readJsonFile, emitJson, emitSummary } from "../output/json.js";
import { errorMessage, usageError } from "../output/errors.js";

export function candidateVerifyCommand(args: string[]): number {
  let subjectPath: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--subject") {
      const next = args[i + 1];
      if (next === undefined) {
        return usageError("--subject requires a file path");
      }
      if (subjectPath !== undefined) {
        return usageError("--subject given more than once");
      }
      subjectPath = next;
      i += 1;
    } else {
      rest.push(arg);
    }
  }
  const candidatePath = rest[0];
  if (
    candidatePath === undefined ||
    rest.length > 1 ||
    subjectPath === undefined
  ) {
    return usageError(
      "usage: drenyra-ai candidate verify <candidate.json> --subject <subject-file>",
    );
  }
  try {
    const raw = readJsonFile(candidatePath);
    if (typeof raw !== "object" || raw === null) {
      return usageError(
        `${candidatePath} must be an object with a subjectHash field`,
      );
    }
    const expectedHash = (raw as Record<string, unknown>).subjectHash;
    if (typeof expectedHash !== "string" || expectedHash.length === 0) {
      return usageError(
        `${candidatePath} must contain a subjectHash string`,
      );
    }
    const subjectBytes = readFileSync(subjectPath);
    const subjectHash = computeSubjectHash(subjectBytes);
    const valid = subjectHash === expectedHash;
    const output = { valid, subjectHash, expectedHash };
    emitJson(output);
    emitSummary(`candidate verify`, `valid=${valid}`);
    return valid ? 0 : 1;
  } catch (error) {
    console.error(`candidate verify: IO/parse error: ${errorMessage(error)}`);
    return 2;
  }
}
