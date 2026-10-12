import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GraphView } from "./GraphView";
import { AppInteractionContext } from "../hooks/useAppInteraction";
import type { GraphSettings } from "../editorTypes";
import type { GraphData } from "../utils/graphData";

const mocks = vi.hoisted(() => ({ simulations: [] as Array<{ stop: () => unknown; restart: () => unknown }>, paint: vi.fn(), scale: vi.fn() }));
vi.mock("d3-force", async importOriginal => {
  const d3 = await importOriginal<typeof import("d3-force")>();
  return { ...d3, forceSimulation: (...args: Parameters<typeof d3.forceSimulation>) => {
    const simulation = d3.forceSimulation(...args);
    vi.spyOn(simulation, "stop"); vi.spyOn(simulation, "restart");
    mocks.simulations.push(simulation); return simulation;
  } };
});
const graphData: GraphData = { nodes: [{ id: "a", label: "A", type: "character", degree: 0, group: "", tags: [], aliases: [], kind: "note" }], links: [] };
const settings = { nodeSize: 1, linkDistance: 70, linkForce: .5, repelForce: 160, centerForce: .06, linkThickness: 1, textFadeThreshold: 1 } as GraphSettings;
const callback = vi.fn();
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.simulations.length = 0; mocks.paint.mockClear(); mocks.scale.mockClear();
  const context = new Proxy({ clearRect: mocks.paint, scale: mocks.scale } as Record<string, unknown>, { get: (target, key: string) => target[key] ?? (() => {}) });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  container = document.createElement("div"); container.className = "forge-worldnotion"; document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const render = async (active: boolean) => act(async () => root.render(<AppInteractionContext.Provider value={active}><GraphView graphData={graphData} settings={settings} width={800} height={600} onNodeClick={callback} onOpenLocalGraph={callback} onRevealNode={callback} /></AppInteractionContext.Provider>));
it("suspends hidden simulation and paint without recreating the graph or losing zoom", async () => {
  await render(true);
  const canvas = container.querySelector("canvas")!, simulation = mocks.simulations[0];
  await act(async () => canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -1, clientX: 100, clientY: 100, bubbles: true })));
  const zoom = mocks.scale.mock.calls.at(-1);
  await render(false);
  expect(simulation.stop).toHaveBeenCalled();
  const paints = mocks.paint.mock.calls.length;
  container.setAttribute("data-theme", "hidden"); await act(async () => {});
  expect(mocks.paint.mock.calls.length).toBe(paints);
  await render(true);
  expect(mocks.simulations).toHaveLength(1); expect(container.querySelector("canvas")).toBe(canvas);
  expect(simulation.restart).toHaveBeenCalled(); expect(mocks.scale.mock.calls.at(-1)).toEqual(zoom);
});
it("does no painting when initially mounted inactive", async () => {
  await render(false);
  expect(mocks.simulations[0].stop).toHaveBeenCalled(); expect(mocks.paint).not.toHaveBeenCalled();
  await render(true); expect(mocks.paint).toHaveBeenCalled();
});
