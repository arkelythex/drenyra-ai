/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * `drenyra-ai project` command-layer tests (SDD-100 Option B).
 *
 * Command behavior only: parse/emit shape across the 15 canonical states,
 * separated UNKNOWN recovery shape, deny pass-through, exit codes 0/1/2,
 * error paths, and CLI wiring (dispatch, help, doctor inventory). Projection
 * semantics (transition matrix, nextAction mapping, denial precedence,
 * determinism, immutability, fail-closed) are pinned by the slice-A suite at
 * projection/__tests__/ and are NOT re-tested here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectCommand } from "../commands/project.js";
import { AccountingMissionStatus } from "../../missions/index.js";
import {
  projectMission,
  type MissionProjectionRequest,
  type MissionProjectionSnapshot,
} from "../../projection/index.js";
import { DOCTOR_CLI_COMMANDS } from "../commands/doctor.js";

const { mockFindById, mockHydrateError, mockProjectMission, DENY_PROBE_STATUS } =
  vi.hoisted(() => ({
    mockFindById: vi.fn<(...args: unknown[]) => unknown>(),
    mockHydrateError: vi.fn<() => Error | undefined>(),
    mockProjectMission: vi.fn<(snapshot: unknown, request?: unknown) => unknown>(),
    DENY_PROBE_STATUS: "UNSUPPORTED_STATUS_DENY_PROBE",
  }));

vi.mock("../adapters/file-mission-store.js", () => ({
  DEFAULT_STORE_PATH: "./drenyra-missions.json",
  MissionFileStore: class {
    public readonly filePath: string;
    constructor(filePath: string) {
      this.filePath = filePath;
    }
    async hydrate(): Promise<{ missions: { findById: typeof mockFindById } }> {
      const failure = mockHydrateError();
      if (failure !== undefined) {
        throw failure;
      }
      return { missions: { findById: mockFindById } };
    }
  },
}));

vi.mock("../../projection/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../projection/index.js")>();
  mockProjectMission.mockImplementation(
    (snapshot: unknown, request?: unknown) => {
      const status =
        typeof snapshot === "object" && snapshot !== null
          ? (snapshot as { status?: string }).status
          : undefined;
      if (status === DENY_PROBE_STATUS) {
        return {
          deny: {
            code: "UNSUPPORTED_STATUS",
            cause: "unsupported-status-value",
            continuation: "provide-supported-status",
          },
        };
      }
      return actual.projectMission(
        snapshot as MissionProjectionSnapshot,
        request as MissionProjectionRequest | undefined,
      );
    },
  );
  return { ...actual, projectMission: mockProjectMission };
});

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mockFindById.mockReset();
  mockHydrateError.mockReset();
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

/** Parses the last JSON object written to stdout by the command under test. */
function parseLastStdout(): unknown {
  const calls = vi.mocked(console.log).mock.calls;
  const last = calls[calls.length - 1];
  if (last === undefined) {
    throw new Error("no console.log output captured");
  }
  return JSON.parse(String(last[0])) as unknown;
}

describe("drenyra-ai project: 15-state shape table and deny pass-through (T-PB-003)", () => {
  const ALL_15_STATES = [
    "DRAFT",
    "QUEUED",
    "RUNNING",
    "BLOCKED",
    "AWAITING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "REVISION_REQUESTED",
    "COMPLETED",
    "FAILED",
    "UNKNOWN",
    "RECOVERING",
    "WAITING_FOR_EVIDENCE",
    "BLOCKED_BY_GATE",
    "RETRYING",
  ] as const;

  it.each(ALL_15_STATES)(
    "projects %s at shape level: exit 0, status passthrough, array eligibility, action present",
    async (status) => {
      const missionId = `mission-${status}`;
      mockFindById.mockResolvedValue({ id: missionId, status });
      const code = await projectCommand([missionId, "--store", "/tmp/any.json"]);
      expect(code).toBe(0);
      const output = parseLastStdout() as {
        projection: {
          status: string;
          eligibleTransitions: unknown[];
          nextAction?: string;
        };
      };
      expect(output.projection.status).toBe(status);
      expect(Array.isArray(output.projection.eligibleTransitions)).toBe(true);
      expect(output.projection.nextAction).toBeDefined();
    },
  );

  it("keeps UNKNOWN recovery targets labeled and separated, never ordinary eligibility", async () => {
    mockFindById.mockResolvedValue({ id: "mission-unknown", status: "UNKNOWN" });
    const code = await projectCommand(["mission-unknown", "--store", "/tmp/any.json"]);
    expect(code).toBe(0);
    const output = parseLastStdout() as {
      projection: {
        status: string;
        eligibleTransitions: string[];
        recoveryTransitions?: string[];
      };
    };
    expect(output.projection.status).toBe("UNKNOWN");
    expect(output.projection.recoveryTransitions).toEqual([
      "RUNNING",
      "FAILED",
      "COMPLETED",
    ]);
    expect(output.projection.eligibleTransitions).toEqual([]);
  });

  it("emits no deny when the command requests no continuation", async () => {
    mockFindById.mockResolvedValue({ id: "mission-q", status: "QUEUED" });
    const code = await projectCommand(["mission-q", "--store", "/tmp/any.json"]);
    expect(code).toBe(0);
    const output = parseLastStdout() as { projection: { deny?: unknown } };
    expect(output.projection.deny).toBeUndefined();
  });

  it("passes a library-returned deny through unchanged with no partial projection", async () => {
    mockFindById.mockResolvedValue({ id: "mission-denied", status: DENY_PROBE_STATUS });
    const code = await projectCommand(["mission-denied", "--store", "/tmp/any.json"]);
    expect(code).toBe(0);
    const output = parseLastStdout() as {
      projection: {
        deny: { code: string; cause: string; continuation: string };
        status?: unknown;
        eligibleTransitions?: unknown;
        nextAction?: unknown;
      };
    };
    // The emitted projection is exactly the library's denial-only result: no
    // synthesis, no suppression, no translation, and no fabricated fields.
    expect(output.projection).toEqual({
      deny: {
        code: "UNSUPPORTED_STATUS",
        cause: "unsupported-status-value",
        continuation: "provide-supported-status",
      },
    });
    expect(output.projection.status).toBeUndefined();
    expect(output.projection.eligibleTransitions).toBeUndefined();
    expect(output.projection.nextAction).toBeUndefined();
  });
});

describe("drenyra-ai project: happy path (T-PB-001)", () => {
  it("emits { missionId, projection } JSON with exit 0 for a QUEUED mission", async () => {
    const missionId = "mission-123";
    mockFindById.mockResolvedValue({ id: missionId, status: "QUEUED" });
    const code = await projectCommand([missionId, "--store", "/tmp/any.json"]);
    expect(code).toBe(0);
    const output = parseLastStdout() as {
      missionId: string;
      projection: { status: string };
    };
    expect(output.missionId).toBe(missionId);
    expect(output.projection.status).toBe("QUEUED");
    expect(vi.mocked(console.log).mock.calls).toHaveLength(1);
  });

  it("emits the projection exactly as the library returns it, without reshaping", async () => {
    const missionId = "mission-456";
    mockFindById.mockResolvedValue({ id: missionId, status: "RUNNING" });
    const code = await projectCommand([missionId, "--store", "/tmp/any.json"]);
    expect(code).toBe(0);
    const output = parseLastStdout() as {
      missionId: string;
      projection: unknown;
    };
    expect(output).toEqual({
      missionId,
      projection: projectMission({ status: AccountingMissionStatus.RUNNING }),
    });
  });
});

describe("drenyra-ai project: CLI wiring (T-PB-004)", () => {
  it("resolves project through COMMANDS and dispatches through main()", async () => {
    const cli = await import("../cli.js");
    expect(cli.COMMANDS.project.run).toBe(projectCommand);
    mockFindById.mockResolvedValue({ id: "mission-wired", status: "QUEUED" });
    const code = await cli.main(["project", "mission-wired", "--store", "/tmp/any.json"]);
    expect(code).toBe(0);
    const output = parseLastStdout() as { missionId: string };
    expect(output.missionId).toBe("mission-wired");
  });

  it("documents the exact syntax in helpText, never project run", async () => {
    const cli = await import("../cli.js");
    const help = cli.helpText();
    expect(help).toContain("project <missionId> [--store <file>]");
    expect(help).not.toContain("project run");
  });

  it("lists the exact syntax in the unknown-command expected commands string", async () => {
    const cli = await import("../cli.js");
    const code = await cli.main(["not-a-real-command"]);
    expect(code).toBe(2);
    const stderr = vi
      .mocked(console.error)
      .mock.calls.map((call) => String(call[0]))
      .join("\n");
    expect(stderr).toContain("project <missionId> [--store <file>]");
  });

  it("reports project in the doctor CLI inventory", () => {
    expect(DOCTOR_CLI_COMMANDS).toContain("project");
  });
});

describe("drenyra-ai project: error paths and exit codes (T-PB-002)", () => {
  it("exits 1 with structured MISSION_NOT_FOUND JSON when the mission is absent", async () => {
    mockFindById.mockResolvedValue(undefined);
    const code = await projectCommand(["mission-999", "--store", "/tmp/any.json"]);
    expect(code).toBe(1);
    const output = parseLastStdout() as {
      error: { code: string; message: string; statusCode: number };
    };
    expect(output.error.code).toBe("MISSION_NOT_FOUND");
    expect(output.error.message).toBe("Mission mission-999 not found");
    expect(output.error.statusCode).toBe(404);
  });

  it.each([
    { label: "no mission ID", args: ["--store", "/tmp/any.json"] },
    { label: "extra positional", args: ["mission-1", "extra", "--store", "/tmp/any.json"] },
    { label: "--demo flag", args: ["mission-1", "--demo", "--store", "/tmp/any.json"] },
    { label: "unknown flag", args: ["mission-1", "--snapshot", "--store", "/tmp/any.json"] },
    { label: "requested-continuation flag", args: ["mission-1", "--continue-to", "RUNNING", "--store", "/tmp/any.json"] },
    { label: "missing --store value", args: ["mission-1", "--store"] },
  ])("exits 2 with usage text and no projection JSON for $label", async ({ args }) => {
    const code = await projectCommand(args as string[]);
    expect(code).toBe(2);
    expect(vi.mocked(console.log).mock.calls).toHaveLength(0);
    expect(vi.mocked(console.error).mock.calls.length).toBeGreaterThan(0);
  });

  it("exits 2 with error text and no projection JSON on store I/O failure", async () => {
    mockHydrateError.mockReturnValue(
      new Error("EISDIR: illegal operation on a directory, read"),
    );
    const code = await projectCommand(["mission-1", "--store", "/tmp/not-a-file"]);
    expect(code).toBe(2);
    expect(vi.mocked(console.log).mock.calls).toHaveLength(0);
    expect(
      vi
        .mocked(console.error)
        .mock.calls.some((call) => String(call[0]).includes("IO/parse error")),
    ).toBe(true);
  });

  it("exits 2 with error text and no projection JSON on malformed store data", async () => {
    mockHydrateError.mockReturnValue(
      new Error("cannot parse mission store /tmp/bad.json: Unexpected token"),
    );
    const code = await projectCommand(["mission-1", "--store", "/tmp/bad.json"]);
    expect(code).toBe(2);
    expect(vi.mocked(console.log).mock.calls).toHaveLength(0);
    expect(
      vi
        .mocked(console.error)
        .mock.calls.some((call) => String(call[0]).includes("IO/parse error")),
    ).toBe(true);
  });

  it("is read-only: emits only stdout JSON plus an optional stderr summary, never mutates", async () => {
    const missionId = "mission-ro";
    mockFindById.mockResolvedValue({ id: missionId, status: "QUEUED" });
    const code = await projectCommand([missionId, "--store", "/tmp/any.json"]);
    expect(code).toBe(0);
    // Exactly one stdout emission (the wrapper JSON) and only the summary on stderr.
    expect(vi.mocked(console.log).mock.calls).toHaveLength(1);
    const stderr = vi
      .mocked(console.error)
      .mock.calls.map((call) => String(call[0]))
      .join("\n");
    expect(stderr).toContain("project:");
    const output = parseLastStdout() as { missionId: string; projection: unknown };
    expect(Object.keys(output).sort()).toEqual(["missionId", "projection"]);
  });
});
