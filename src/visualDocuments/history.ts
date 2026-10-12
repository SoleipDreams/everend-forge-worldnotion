type Change = { before: string; after: string; label?: string; at: number };

/** Raw snapshots share the normal tab save/conflict contract; no second persistence. */
export class VisualDocumentHistory {
  private past: Change[] = [];
  private future: Change[] = [];
  record(before: string, after: string, label?: string, at = Date.now()) {
    if (before === after) return;
    const last = this.past.at(-1);
    if (last && last.after !== before) this.past = [];
    if (last && last.after === before && label && last.label === label && at - last.at < 500) {
      last.after = after;
      last.at = at;
    } else this.past.push({ before, after, label, at });
    if (this.past.length > 100) this.past.shift();
    this.future = [];
  }
  undo(current: string): string | undefined {
    const change = this.past.at(-1);
    if (!change || change.after !== current) return undefined;
    this.past.pop();
    this.future.push(change);
    return change.before;
  }
  redo(current: string): string | undefined {
    const change = this.future.at(-1);
    if (!change || change.before !== current) return undefined;
    this.future.pop();
    this.past.push(change);
    return change.after;
  }
}
