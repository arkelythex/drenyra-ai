/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents; no float is ever used for money; sequence/version/index numbers are JSON integers, never floats.
 */
/**
 * MissionFileStore adapter tests — hydrate contract for a missing store file.
 *
 * A fresh mission run starts with no store on disk; hydrate() must treat that
 * as an empty store instead of failing (regression: the file loader wrapped the
 * native ENOENT into a plain Error, so the empty-store branch never ran and
 * mission start exited 2).
 */

import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MissionFileStore } from "../adapters/file-mission-store.js";

describe("MissionFileStore hydrate", () => {
  let dir: string;
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts a nonexistent store path and produces empty stores", async () => {
    dir = mkdtempSync(join(tmpdir(), "drenyra-store-test-"));
    const storePath = join(dir, "missing-store.json");
    const store = new MissionFileStore(storePath);

    const stores = await store.hydrate();

    expect(await stores.missions.list()).toEqual([]);
    expect(stores.events.all()).toEqual([]);
    expect(stores.idempotency.all()).toEqual([]);
  });

  it("still fails closed on an unparseable existing store file", async () => {
    dir = mkdtempSync(join(tmpdir(), "drenyra-store-test-"));
    const storePath = join(dir, "corrupt-store.json");
    writeFileSync(storePath, "{not json", "utf-8");
    const store = new MissionFileStore(storePath);

    await expect(store.hydrate()).rejects.toThrow(
      /cannot parse mission store/,
    );
  });
});
