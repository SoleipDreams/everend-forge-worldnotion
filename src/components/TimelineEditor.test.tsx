import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTimelineDocument, type TimelineDocument } from "../visualDocuments/timelineTypes";
import {
  copyCalendar,
  EARTH_CALENDAR,
  GENERIC_CALENDAR,
  toOrdinal,
} from "../visualDocuments/calendar";
import type { VisualDocumentSession } from "../visualDocuments/types";
import { makeEntity, makeVaultFile, makeVaultIndex } from "../test/fixtures";
import type { VaultIndex } from "../domain";
import { TimelineEditor } from "./TimelineEditor";
import { UniverseDraftContext, UniverseDraftRegistry } from "../hooks/useUniverseDraft";
import { AppInteractionContext } from "../hooks/useAppInteraction";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("PointerEvent", MouseEvent);
  SVGElement.prototype.setPointerCapture = vi.fn();
});
vi.mock("../utils/vaultImages", () => ({
  isImagePath: (path: string) => /\.png$/.test(path),
  useVaultImage: () => ({}),
}));
function fixture() {
  const document = createTimelineDocument();
  document.items = [
    {
      id: "event",
      kind: "event",
      title: "Crown falls",
      start: toOrdinal(EARTH_CALENDAR, { year: 2000, month: 2, day: 29 }).toString(),
      precision: "day",
      tags: ["war"],
      reference: "Characters/Mara.md",
    },
    {
      id: "period",
      kind: "period",
      title: "Rebuilding",
      start: toOrdinal(EARTH_CALENDAR, { year: 2000, month: 3, day: 1 }).toString(),
      end: toOrdinal(EARTH_CALENDAR, { year: 2001 }).toString(),
      precision: "month",
      tags: ["peace"],
    },
  ];
  return document;
}
function Harness({
  initial = fixture(),
  onChange = vi.fn(),
  initialSession = {},
  onSession = vi.fn(),
  active = true,
  locale = "en",
  vaultIndex = makeVaultIndex(),
}: {
  initial?: TimelineDocument;
  onChange?: (document: TimelineDocument) => void;
  initialSession?: VisualDocumentSession;
  onSession?: (session: VisualDocumentSession) => void;
  active?: boolean;
  locale?: "en" | "es";
  vaultIndex?: VaultIndex;
}) {
  const [document, setDocument] = useState(initial);
  const [session, setSession] = useState(initialSession);
  return (
    <div className="forge-worldnotion">
      <TimelineEditor
        document={document}
        onChange={(next) => {
          setDocument(next);
          onChange(next);
        }}
        session={session}
        onSessionChange={(next) => {
          setSession(next);
          onSession(next);
        }}
        active={active}
        locale={locale}
        vaultIndex={vaultIndex}
      />
    </div>
  );
}
describe("Timeline authoring", () => {
  it("adds point events and periods with exact ordinal strings", () => {
    const change = vi.fn();
    render(<Harness initial={createTimelineDocument()} onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: /^Event$/ }));
    expect(change.mock.calls[0][0].items[0]).toMatchObject({
      kind: "event",
      precision: "day",
      start: expect.stringMatching(/^-?\d+$/),
    });
    fireEvent.click(screen.getByRole("button", { name: /^Period$/ }));
    const period = change.mock.calls.at(-1)![0].items[1];
    expect(BigInt(period.end) > BigInt(period.start)).toBe(true);
  });
  it("keeps pan, zoom and selection out of authored history", () => {
    const change = vi.fn(),
      session = vi.fn();
    render(<Harness onChange={change} onSession={session} />);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.keyDown(screen.getByRole("button", { name: /^Crown falls:/ }), { key: "Enter" });
    expect(session.mock.calls.at(-1)![0].selectedIds).toEqual(["event"]);
    expect(change).not.toHaveBeenCalled();
  });
  it("zooms dates while keeping cards, period labels and lane spacing readable", () => {
    const initial = fixture(),
      change = vi.fn(),
      session = vi.fn();
    initial.items.push({
      ...initial.items[0],
      id: "nearby",
      title: "A nearby event",
      start: (BigInt(initial.items[0].start) + 86400n).toString(),
    });
    const { container } = render(
      <Harness
        initial={initial}
        onChange={change}
        onSession={session}
        initialSession={{ viewport: { x: 30, y: 180, zoom: 0.19 } }}
      />,
    );
    const content = container.querySelector(".timeline-content")!;
    expect(content.getAttribute("transform")).not.toContain("scale");
    const cards = Array.from(container.querySelectorAll(".timeline-item-card"));
    expect(cards.map((card) => [card.getAttribute("width"), card.getAttribute("height")])).toEqual([
      ["168", "58"],
      ["168", "58"],
    ]);
    expect(
      Math.abs(Number(cards[0].getAttribute("y")) - Number(cards[1].getAttribute("y"))),
    ).toBeGreaterThan(58);
    expect(container.querySelector(".timeline-period-bar")).toHaveAttribute("height", "34");
    expect(container.querySelector(".timeline-period-label")).toHaveAttribute("width", "160");
    const beforeX = Number(cards[1].getAttribute("x"));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(
      Number(container.querySelectorAll(".timeline-item-card")[1].getAttribute("x")),
    ).toBeLessThan(beforeX);
    expect(container.querySelector(".timeline-item-card")).toHaveAttribute("width", "168");
    expect(session.mock.calls.at(-1)![0].viewport.y).toBe(180);
    expect(change).not.toHaveBeenCalled();
  });
  it("fits narrow canvases including fixed card extents without shrinking their text", () => {
    const width = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("timeline-canvas") ? 234 : 0;
      });
    const height = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("timeline-canvas") ? 360 : 0;
      });
    try {
      const initial = fixture(),
        session = vi.fn(),
        change = vi.fn();
      initial.items.push({
        ...initial.items[0],
        id: "second",
        title: "Second event",
        start: initial.items[1].end!,
      });
      const { container } = render(
        <Harness initial={initial} onSession={session} onChange={change} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Fit timeline" }));
      const camera = session.mock.calls.at(-1)![0].viewport;
      expect(camera.zoom).toBe(1);
      const cards = Array.from(container.querySelectorAll(".timeline-item-card"));
      for (const card of cards) {
        const x = Number(card.getAttribute("x")) + camera.x;
        expect(x).toBeGreaterThanOrEqual(12);
        expect(x + Number(card.getAttribute("width"))).toBeLessThanOrEqual(222);
      }
      expect(cards[0]).toHaveAttribute("width", "168");
      expect(container.querySelector(".timeline-content")!.getAttribute("transform")).not.toContain(
        "scale",
      );
      expect(change).not.toHaveBeenCalled();
    } finally {
      width.mockRestore();
      height.mockRestore();
    }
  });
  it("validates impossible dates before changing the document", () => {
    const change = vi.fn();
    render(<Harness onChange={change} initialSession={{ selectedIds: ["event"] }} />);
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply date" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Day");
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "28" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply date" }));
    expect(change.mock.calls[0][0].items[0].start).toBe(
      toOrdinal(EARTH_CALENDAR, { year: 2000, month: 2, day: 28 }).toString(),
    );
  });
  it("preserves event instants and precision when switching a calendar lens", () => {
    const initial = fixture(),
      change = vi.fn();
    render(<Harness initial={initial} onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: /Earth · Gregorian/ }));
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "generic" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply calendar" }));
    const next = change.mock.calls[0][0];
    expect(next.calendar.id).toBe("generic");
    expect(next.items).toEqual(initial.items);
  });
  it("saves filters as an authored view and keeps the current camera local", () => {
    const change = vi.fn();
    render(<Harness onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "2/2" }));
    fireEvent.click(screen.getByLabelText("war"));
    expect(screen.queryByRole("button", { name: /^Rebuilding:/ })).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("New view name"), { target: { value: "War" } });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    expect(change.mock.calls[0][0].views[0]).toMatchObject({
      name: "War",
      tags: ["war"],
      kinds: ["event", "period"],
    });
    expect(change.mock.calls[0][0]).not.toHaveProperty("viewport");
  });
  it("moves a period without losing its duration and blocks end before start", () => {
    const initial = fixture(),
      change = vi.fn();
    render(
      <Harness initial={initial} onChange={change} initialSession={{ selectedIds: ["period"] }} />,
    );
    fireEvent.click(screen.getByTitle("Move one day later"));
    const item = change.mock.calls[0][0].items[1];
    expect(BigInt(item.end) - BigInt(item.start)).toBe(
      BigInt(initial.items[1].end!) - BigInt(initial.items[1].start),
    );
    const endFields = screen.getByRole("group", { name: "End" });
    fireEvent.change(within(endFields).getByLabelText("Year"), { target: { value: "1000" } });
    fireEvent.click(within(endFields).getByRole("button", { name: "Apply date" }));
    expect(screen.getByRole("alert")).toHaveTextContent("End must not be before");
    expect(change).toHaveBeenCalledTimes(1);
  });
  it("commits a pointer drag once and cancels an interrupted drag without data mutation", () => {
    const initial = fixture(),
      change = vi.fn();
    render(<Harness initial={initial} onChange={change} />);
    const canvas = screen.getByRole("img");
    const item = screen.getByRole("button", { name: /^Crown falls:/ });
    fireEvent.pointerDown(item, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: 160, clientY: 100 });
    expect(change).not.toHaveBeenCalled();
    fireEvent.pointerCancel(canvas);
    expect(change).not.toHaveBeenCalled();
    fireEvent.pointerDown(item, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: 160, clientY: 100 });
    fireEvent.pointerUp(canvas);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change.mock.calls[0][0].items[0].start).not.toBe(initial.items[0].start);
  });
  it("prevents native wheel scrolling with a nonpassive listener and keeps zoom local", () => {
    const listener = vi.spyOn(SVGElement.prototype, "addEventListener"),
      change = vi.fn(),
      session = vi.fn();
    try {
      render(<Harness onChange={change} onSession={session} />);
      expect(listener).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });
      const event = new WheelEvent("wheel", {
        deltaY: -80,
        clientX: 200,
        clientY: 120,
        bubbles: true,
        cancelable: true,
      });
      fireEvent(screen.getByRole("img"), event);
      expect(event.defaultPrevented).toBe(true);
      expect(session.mock.calls.at(-1)![0].viewport.zoom).toBeGreaterThan(1);
      expect(change).not.toHaveBeenCalled();
    } finally {
      listener.mockRestore();
    }
  });
  it("does not restore a deleted item when its unfinished drag receives pointerup", () => {
    const change = vi.fn();
    render(<Harness onChange={change} />);
    const canvas = screen.getByRole("img");
    fireEvent.pointerDown(screen.getByRole("button", { name: /^Crown falls:/ }), {
      clientX: 100,
      clientY: 100,
      button: 0,
    });
    fireEvent.pointerMove(canvas, { clientX: 160, clientY: 100 });
    fireEvent.keyDown(canvas, { key: "Delete" });
    fireEvent.pointerUp(canvas);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change.mock.calls[0][0].items.map((item: { id: string }) => item.id)).toEqual([
      "period",
    ]);
    expect(screen.queryByRole("button", { name: /^Crown falls:/ })).not.toBeInTheDocument();
  });
  it.each(["calendar", "undo"] as const)(
    "cancels a pending gesture after an external %s revision",
    (revision) => {
      const initial = fixture(),
        change = vi.fn();
      const rendered = render(<TimelineEditor document={initial} onChange={change} />);
      const canvas = screen.getByRole("img");
      fireEvent.pointerDown(screen.getByRole("button", { name: /^Crown falls:/ }), {
        clientX: 100,
        clientY: 100,
        button: 0,
      });
      fireEvent.pointerMove(canvas, { clientX: 160, clientY: 100 });
      const next = structuredClone(initial);
      if (revision === "calendar") next.calendar = copyCalendar(GENERIC_CALENDAR);
      else next.items[0].title = "Restored through Undo";
      rendered.rerender(<TimelineEditor document={next} onChange={change} />);
      fireEvent.pointerUp(canvas);
      expect(change).not.toHaveBeenCalled();
    },
  );
  it("permits multiple comma-separated tags without eating the comma while typing", () => {
    const change = vi.fn();
    render(<Harness onChange={change} initialSession={{ selectedIds: ["event"] }} />);
    const input = screen.getByLabelText("Tags · comma separated");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "war," } });
    expect(input).toHaveValue("war,");
    fireEvent.change(input, { target: { value: "war, peace" } });
    expect(change.mock.calls.at(-1)![0].items[0].tags).toEqual(["war", "peace"]);
  });
  it("treats era selection as presentation until the displayed year is edited", () => {
    const initial = fixture();
    initial.calendar = copyCalendar(GENERIC_CALENDAR);
    initial.calendar.eras = [{ id: "age", name: "Age", startYear: 100, suffix: "A", resetYear: 1 }];
    initial.items[0].start = toOrdinal(initial.calendar, { year: 110 }).toString();
    const change = vi.fn();
    render(
      <Harness initial={initial} onChange={change} initialSession={{ selectedIds: ["event"] }} />,
    );
    fireEvent.change(screen.getByLabelText("Era"), { target: { value: "age" } });
    expect(screen.getByLabelText("Year")).toHaveValue(11);
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply date" }));
    expect(change.mock.calls[0][0].items[0].start).toBe(
      toOrdinal(initial.calendar, { year: 111 }).toString(),
    );
  });
  it("marks an inactive Suite app inert and ignores canvas keyboard mutations", () => {
    const change = vi.fn();
    const { container } = render(
      <AppInteractionContext.Provider value={false}>
        <Harness onChange={change} initialSession={{ selectedIds: ["event"] }} />
      </AppInteractionContext.Provider>,
    );
    expect(container.querySelector(".timeline-editor")).toHaveAttribute("inert");
    fireEvent.keyDown(screen.getByRole("img"), { key: "Delete" });
    expect(change).not.toHaveBeenCalled();
  });
  it("keeps a visible neighbouring document interactive before it takes focus", () => {
    const neighbourSession = vi.fn(),
      neighbourChange = vi.fn();
    const { container } = render(
      <>
        <Harness />
        <Harness active={false} onSession={neighbourSession} onChange={neighbourChange} />
      </>,
    );
    const neighbour = container.querySelectorAll<HTMLElement>(".timeline-editor")[1];
    expect(neighbour).not.toHaveAttribute("inert");
    fireEvent.pointerDown(within(neighbour).getByRole("button", { name: /^Crown falls:/ }), {
      button: 0,
      pointerId: 1,
      clientX: 200,
      clientY: 100,
    });
    expect(neighbourSession.mock.calls.at(-1)![0].selectedIds).toEqual(["event"]);
    fireEvent.keyDown(within(neighbour).getByRole("img"), { key: "Delete" });
    expect(neighbourChange).not.toHaveBeenCalled();
    fireEvent.click(within(neighbour).getByRole("button", { name: /^Event$/ }));
    expect(neighbourChange.mock.calls.at(-1)![0].items).toHaveLength(3);
  });
  it("uses the same resolution for Markdown paths, canon variants and broken links as the workspace", () => {
    const change = vi.fn();
    const mara = makeEntity({ variants: [{ id: "past", label: "Past" }] });
    render(
      <Harness
        onChange={change}
        initialSession={{ selectedIds: ["event"] }}
        vaultIndex={makeVaultIndex({
          entities: [mara],
          markdownFiles: [mara.file, makeVaultFile("Notes/Idea.md")],
        })}
      />,
    );
    const input = screen.getByLabelText("Canon reference");
    for (const reference of ["Notes/Idea.md", "Characters/Mara.md@past", "mara@past"]) {
      fireEvent.change(input, { target: { value: reference } });
      expect(screen.getByRole("button", { name: "Open linked note" })).toBeEnabled();
      expect(
        screen.queryByText("Reference not found in this universe. It is preserved."),
      ).not.toBeInTheDocument();
    }
    fireEvent.change(input, { target: { value: "mara@missing" } });
    expect(screen.getByRole("button", { name: "Open linked note" })).toBeDisabled();
    expect(
      screen.getByText("Reference not found in this universe. It is preserved."),
    ).toBeInTheDocument();
    expect(change.mock.calls.at(-1)![0].items[0].reference).toBe("mara@missing");
  });
  it("preserves a pending invalid date across closing, remounting and explicit discard", () => {
    const registry = new UniverseDraftRegistry(),
      session = vi.fn(),
      change = vi.fn();
    const rendered = render(
      <UniverseDraftContext.Provider value={registry}>
        <Harness
          onChange={change}
          onSession={session}
          initialSession={{ selectedIds: ["event"] }}
        />
      </UniverseDraftContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "30" } });
    expect(registry.hasDrafts()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close item inspector" }));
    expect(registry.hasDrafts()).toBe(true);
    const stored: VisualDocumentSession = session.mock.calls.at(-1)![0];
    expect(stored.drafts?.["timeline.date:event:start"].value).toMatchObject({ day: 30 });
    rendered.unmount();
    render(
      <UniverseDraftContext.Provider value={registry}>
        <Harness onChange={change} initialSession={stored} />
      </UniverseDraftContext.Provider>,
    );
    expect(registry.hasDrafts()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Review: Crown falls · Start" }));
    expect(screen.getByLabelText("Day")).toHaveValue(30);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByLabelText("Day")).toHaveValue(29);
    expect(registry.hasDrafts()).toBe(false);
    expect(change).not.toHaveBeenCalled();
  });
  it("retains a calendar draft when closed and clears it only on apply", () => {
    const registry = new UniverseDraftRegistry(),
      change = vi.fn();
    render(
      <UniverseDraftContext.Provider value={registry}>
        <Harness onChange={change} />
      </UniverseDraftContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Earth · Gregorian/ }));
    fireEvent.change(screen.getByLabelText("Calendar name"), { target: { value: "Ash calendar" } });
    expect(registry.hasDrafts()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close calendar settings" }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review: Calendar changes" }));
    expect(screen.getByLabelText("Calendar name")).toHaveValue("Ash calendar");
    fireEvent.click(screen.getByRole("button", { name: "Apply calendar" }));
    expect(change.mock.calls[0][0].calendar.name).toBe("Ash calendar");
    expect(registry.hasDrafts()).toBe(false);
  });
  it("blocks calendar lens changes while a date draft still needs a decision", () => {
    const change = vi.fn();
    render(<Harness onChange={change} initialSession={{ selectedIds: ["event"] }} />);
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "28" } });
    fireEvent.click(screen.getByRole("button", { name: /Earth · Gregorian/ }));
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "generic" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply calendar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Apply or discard date drafts");
    expect(change).not.toHaveBeenCalled();
  });
  it("uses Spanish labels while preserving authored values and canonical precision enums", () => {
    const change = vi.fn();
    render(<Harness locale="es" onChange={change} initialSession={{ selectedIds: ["event"] }} />);
    expect(screen.getByRole("button", { name: "Acercar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Encuadrar cronología" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Crown falls");
    fireEvent.change(screen.getByLabelText("Precisión"), { target: { value: "month" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar fecha" }));
    expect(change.mock.calls[0][0].items[0].precision).toBe("month");
    fireEvent.click(screen.getByRole("button", { name: /Earth · Gregorian/ }));
    expect(screen.getByLabelText("Progresión semanal")).toBeInTheDocument();
    expect(screen.getByLabelText("Cada N años")).toBeInTheDocument();
  });
});
