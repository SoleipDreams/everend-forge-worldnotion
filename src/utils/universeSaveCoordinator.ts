/** Tracks writes and debounced autosaves before the Suite changes universes. */
export class UniverseSaveCoordinator {
  private pending = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; save: () => Promise<unknown> }
  >();
  private running = new Map<string, Promise<unknown>>();
  private failed = new Set<string>();

  run<T>(key: string, save: () => Promise<T>): Promise<T> {
    const previous = this.running.get(key);
    const operation = (previous ? previous.catch(() => undefined) : Promise.resolve())
      .then(save)
      .then(
        (result) => {
          if (result === false) this.failed.add(key);
          else this.failed.delete(key);
          return result;
        },
        (error: unknown) => {
          this.failed.add(key);
          throw error;
        },
      );
    this.running.set(key, operation);
    void operation
      .finally(() => {
        if (this.running.get(key) === operation) this.running.delete(key);
      })
      .catch(() => undefined);
    return operation;
  }

  schedule(key: string, save: () => Promise<unknown>, delay: number): () => void {
    this.cancel(key);
    const pending = {
      save,
      timer: setTimeout(() => {
        if (this.pending.get(key) !== pending) return;
        this.pending.delete(key);
        void this.run(key, save).catch(() => undefined);
      }, delay),
    };
    this.pending.set(key, pending);
    return () => {
      if (this.pending.get(key) === pending) this.cancel(key);
    };
  }

  cancel(key: string) {
    const pending = this.pending.get(key);
    if (pending) clearTimeout(pending.timer);
    this.pending.delete(key);
  }

  cancelPending() {
    for (const key of this.pending.keys()) this.cancel(key);
  }

  /** Explicit discard acknowledges only this document's settled failure. */
  async discard(key: string): Promise<void> {
    this.cancel(key);
    // An initiated write cannot be cancelled. Wait for its outcome so a late
    // rejection cannot reintroduce the discarded document's failure.
    while (this.running.has(key)) {
      await Promise.allSettled([this.running.get(key)!]);
      this.cancel(key);
    }
    this.failed.delete(key);
  }

  async canSwitch(hasDrafts: () => boolean): Promise<boolean> {
    // A write can enqueue another autosave while completing. Drain to stability.
    while (this.pending.size || this.running.size) {
      for (const [key, pending] of this.pending) {
        clearTimeout(pending.timer);
        this.pending.delete(key);
        void this.run(key, pending.save).catch(() => undefined);
      }
      await Promise.allSettled(this.running.values());
    }
    return this.failed.size === 0 && !hasDrafts();
  }
}
