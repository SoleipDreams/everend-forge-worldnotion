// @vitest-environment jsdom
import { createContext, useContext, useState } from "react";
import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsFrame, useSettingsDraft } from "../SettingsFrame";
import { findSettings, type SettingsHost, type SettingsPage } from "../settingsIntegration";
import { mergeUniverseProfile } from "../universeProfilePersistence";
const pages: SettingsPage[] = [
  {id:"demo.appearance",owner:"demo",group:{en:"General",es:"General"},title:{en:"Appearance",es:"Apariencia"},controls:[{id:"demo.theme",label:{en:"Theme",es:"Tema"},description:{en:"Lighting and color",es:"Iluminación y color"}}]},
  {id:"demo.universe",owner:"demo",group:{en:"Universe",es:"Universo"},title:{en:"Identity",es:"Identidad"},requiresUniverse:true,controls:[{id:"demo.name",label:{en:"Universe name",es:"Nombre del universo"}}]},
];
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
    return (this.closest("[hidden], [inert]") ? [] : [{width:20,height:20}]) as unknown as DOMRectList;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function DraftForm({ save }: {save?: (name:string) => Promise<void>}) {
  const [name,setName] = useState("Demo"), [baseline,setBaseline] = useState("Demo");
  useSettingsDraft("form",{dirty:name!==baseline,save:async()=>{await save?.(name);setBaseline(name);},discard:()=>setName(baseline)});
  return <label><span>Universe name</span><input value={name} onChange={event=>setName(event.target.value)} /></label>;
}
function Harness({close=vi.fn(), save, locale="en", universe=true, navigate=vi.fn()}: {close?:()=>void;save?:(name:string)=>Promise<void>;locale?:"en"|"es";universe?:boolean;navigate?:(id:string,control?:string)=>void}) {
  const [page,setPage]=useState("demo.appearance");
  return <SettingsFrame title="Settings" locale={locale} pages={pages} page={page} onPage={(id,control)=>{navigate(id,control);setPage(id);}} onClose={close} hasUniverse={universe}>
    <div hidden={page!=="demo.appearance"}><label><span>{locale==="es"?"Tema":"Theme"}</span><select defaultValue="dark"><option value="dark">Dark</option></select></label></div>
    <div hidden={page!=="demo.universe"}><DraftForm save={save} /></div>
  </SettingsFrame>;
}
describe("settings center behavior",()=>{
  it("searches names and descriptions across EN/ES, ignoring accents and case",()=>{
    expect(findSettings(pages,"ILUMINACION")).toHaveLength(1);
    expect(findSettings(pages,"universe nombre")[0]?.control.id).toBe("demo.name");
    expect(findSettings(pages,"   ")).toEqual([]);
  });
  it("opens and focuses the exact control from a search result",async()=>{
    const navigate=vi.fn();render(<Harness locale="es" navigate={navigate}/>);
    fireEvent.change(screen.getByRole("searchbox"),{target:{value:"iluminacion"}});
    fireEvent.click(screen.getByRole("button",{name:"Tema"}));
    expect(navigate).toHaveBeenCalledWith("demo.appearance","demo.theme");
    await waitFor(()=>expect(document.activeElement).toBe(screen.getByLabelText("Tema")));
  });
  it("explains search results that require an open universe",()=>{
    render(<Harness locale="es" universe={false}/>);
    fireEvent.change(screen.getByRole("searchbox"),{target:{value:"nombre"}});
    expect(screen.getByText("Requiere un universo abierto")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Nombre del universo"}));
    expect(screen.getByText("Abre un universo para modificar estos ajustes.")).toBeTruthy();
  });
  it("retains nested drafts when searching or changing pages",()=>{
    render(<Harness/>);fireEvent.click(screen.getByRole("button",{name:"Identity"}));
    fireEvent.change(screen.getByLabelText("Universe name"),{target:{value:"Unwritten universe"}});
    fireEvent.change(screen.getByRole("searchbox"),{target:{value:"theme"}});
    fireEvent.click(screen.getByRole("button",{name:"Theme"}));
    fireEvent.click(screen.getByRole("button",{name:"Identity"}));
    expect((screen.getByLabelText("Universe name") as HTMLInputElement).value).toBe("Unwritten universe");
    fireEvent.click(screen.getByRole("button",{name:"Close settings"}));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Keep editing"}));
    expect((screen.getByLabelText("Universe name") as HTMLInputElement).value).toBe("Unwritten universe");
  });
  it("keeps the draft when saving fails, then discards without saving",async()=>{
    const close=vi.fn(),save=vi.fn().mockRejectedValue(new Error("Disk unavailable"));
    render(<Harness close={close} save={save}/>);fireEvent.click(screen.getByRole("button",{name:"Identity"}));
    fireEvent.change(screen.getByLabelText("Universe name"),{target:{value:"New universe"}});
    fireEvent.click(screen.getByRole("button",{name:"Close settings"}));fireEvent.click(screen.getByRole("button",{name:"Save and close"}));
    await screen.findByRole("alert");expect(close).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Universe name") as HTMLInputElement).value).toBe("New universe");
    fireEvent.click(screen.getByRole("button",{name:"Discard and close"}));expect(close).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
  });
  it("saves nested drafts before closing",async()=>{
    const close=vi.fn(),save=vi.fn().mockResolvedValue(undefined);
    render(<Harness close={close} save={save}/>);fireEvent.click(screen.getByRole("button",{name:"Identity"}));
    fireEvent.change(screen.getByLabelText("Universe name"),{target:{value:"Saved universe"}});
    fireEvent.click(screen.getByRole("button",{name:"Close settings"}));
    await act(async()=>fireEvent.click(screen.getByRole("button",{name:"Save and close"})));
    await waitFor(()=>expect(close).toHaveBeenCalledOnce());expect(save).toHaveBeenCalledWith("Saved universe");
  });
  it("renders app-owned panels through a portal without losing React context",()=>{
    const context=createContext("missing"), target=document.createElement("div"),unregister=vi.fn(),register=vi.fn(()=>unregister);
    document.body.append(target);
    const host:SettingsHost={visible:true,page:"demo.appearance",target,open:vi.fn(),register,registerDraft:vi.fn(()=>()=>{}),profileSaved:vi.fn()};
    function Content(){return <span>{useContext(context)}</span>;}
    const result=render(<context.Provider value="Application context"><div inert><SettingsFrame title="Settings" locale="en" pages={pages} page={host.page} onPage={vi.fn()} onClose={vi.fn()} host={host}><Content/></SettingsFrame></div></context.Provider>);
    expect(within(target).getByText("Application context")).toBeTruthy();expect(target.closest("[inert]")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();expect(register).toHaveBeenCalledOnce();
    result.unmount();expect(unregister).toHaveBeenCalledOnce();target.remove();
  });
  it("restores the opening control after the modal closes",async()=>{
    const trigger=document.createElement("button");document.body.append(trigger);trigger.focus();
    const result=render(<SettingsFrame title="Settings" locale="en" pages={pages} page="demo.appearance" onPage={vi.fn()} onClose={vi.fn()}/>);
    expect(document.activeElement).toBe(screen.getByRole("button",{name:"Close settings"}));
    result.unmount();await act(async()=>{});expect(document.activeElement).toBe(trigger);trigger.remove();
  });
  it("restores focus when a retained modal is hidden", async () => {
    const opener = document.createElement("button"); document.body.append(opener); opener.focus();
    const props = { title:"Settings", locale:"en" as const, pages, page:"demo.appearance", onPage:vi.fn(), onClose:vi.fn() };
    const view = render(<SettingsFrame {...props} visible />);
    view.rerender(<SettingsFrame {...props} visible={false} />);
    await act(async () => {});
    expect(document.activeElement).toBe(opener);
    view.unmount(); opener.remove();
  });
});
describe("portable universe profile",()=>{
  it("preserves languages, unknown fields, and metadata not edited by Compendium",()=>{
    const existing={name:"Old",localization:{primaryLocale:"es-PE",locales:["es-PE","en"]},taxonomyVersion:"3.0",custom:{title:"Ámbar"}};
    expect(mergeUniverseProfile(JSON.stringify(existing),{name:"New",icon:{type:"preset",value:"book"}})).toEqual({...existing,name:"New",icon:{type:"preset",value:"book"}});
  });
  it("fails rather than replacing invalid JSON or non-object profiles",()=>{
    for(const source of ["{broken","[]","null","42"])expect(()=>mergeUniverseProfile(source,{name:"New"})).toThrow();
    expect(mergeUniverseProfile(undefined,{name:"New"})).toEqual({name:"New"});
  });
});

