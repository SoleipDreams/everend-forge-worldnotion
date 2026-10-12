import { afterEach, describe, expect, it, vi } from "vitest";
import { UniverseSaveCoordinator } from "./universeSaveCoordinator";

afterEach(() => vi.useRealTimers());

describe("universe switch save barrier", () => {
  it("acknowledges an explicit discard only for its failed document", async () => {
    const saves = new UniverseSaveCoordinator();
    await saves.run("note:A.md", async () => false);
    await expect(
      saves.run("note:B.md", async () => {
        throw new Error("Access denied");
      }),
    ).rejects.toThrow("Access denied");
    await saves.discard("note:A.md");
    expect(await saves.canSwitch(() => false)).toBe(false);
    await saves.discard("note:B.md");
    expect(await saves.canSwitch(() => false)).toBe(true);
  });

  it("waits for the discarded write's late failure and cancels its pending autosave", async () => {
    vi.useFakeTimers();
    const saves = new UniverseSaveCoordinator();
    let finish!: (result: boolean) => void;
    const write = saves.run(
      "note:A.md",
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    const pending = vi.fn(async () => false);
    saves.schedule("note:A.md", pending, 300);
    let discarded = false;
    const discard = saves.discard("note:A.md").then(() => {
      discarded = true;
    });
    await Promise.resolve();
    expect(discarded).toBe(false);
    finish(false);
    await write;
    await discard;
    expect(discarded).toBe(true);
    expect(await saves.canSwitch(() => false)).toBe(true);
    expect(pending).not.toHaveBeenCalled();
  });
  it("flushes the newest inspector debounce before checking manual drafts", async () => {
    vi.useFakeTimers();
    const saves = new UniverseSaveCoordinator();
    const discarded = vi.fn(async () => true);
    let dirty = true;
    saves.schedule("note", discarded, 300);
    const latest = vi.fn(async () => {
      dirty = false;
      return true;
    });
    saves.schedule("note", latest, 300);
    expect(await saves.canSwitch(() => dirty)).toBe(true);
    expect(discarded).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it("waits for an initiated save and retains a draft written during it", async () => {
    const saves = new UniverseSaveCoordinator();
    let finish!: () => void;
    const writing = saves.run(
      "note",
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await Promise.resolve();
    let checked = false;
    const switchAttempt = saves.canSwitch(() => {
      checked = true;
      return true;
    });
    expect(checked).toBe(false);
    finish();
    await writing;
    expect(await switchAttempt).toBe(false);
  });

  it("blocks absorbed failures and conflicts until a successful retry", async () => {
    const saves = new UniverseSaveCoordinator();
    await saves.run("note", async () => false);
    expect(await saves.canSwitch(() => false)).toBe(false);
    await saves.run("note", async () => true);
    expect(await saves.canSwitch(() => false)).toBe(true);
    await expect(
      saves.run("appearance", async () => {
        throw new Error("Disk unavailable");
      }),
    ).rejects.toThrow();
    expect(await saves.canSwitch(() => false)).toBe(false);
  });
});
