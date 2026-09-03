import { GameSession, InventoryBar, VERBS } from "@deme/engine";
import { Container, Texture } from "pixi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildShell,
  hideHotspotTooltip,
  onInventorySelect,
  refreshInventoryBar,
  renderDialogue,
  resolveShowHotspotDebug,
  setActiveVerb,
  showHotspotTooltip,
  showMessage,
} from "./app.js";
import { DEMO_START_ROOM_ID, demoContentLoaders } from "./content.js";

function makeSession(): GameSession {
  return new GameSession({
    stage: new Container(),
    loaders: demoContentLoaders,
    loadTexture: async () => Texture.WHITE,
    startRoomId: DEMO_START_ROOM_ID,
  });
}

describe("buildShell", () => {
  it("renders a button for every verb plus save/load, with dialogue and toast hidden", () => {
    const root = document.createElement("div");
    const shell = buildShell(root);

    expect([...shell.verbButtons.keys()]).toEqual(VERBS);
    expect(shell.saveButton.textContent).toBe("Save");
    expect(shell.loadButton.textContent).toBe("Load");
    expect(shell.dialogueBox.hidden).toBe(true);
    expect(shell.messageToast.hidden).toBe(true);
  });

  it("clears any previous content from root", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>stale</p>";
    buildShell(root);
    expect(root.textContent).not.toContain("stale");
  });
});

describe("resolveShowHotspotDebug", () => {
  it("is false with no debug param, so hotspot overlays stay off by default", () => {
    expect(resolveShowHotspotDebug("")).toBe(false);
    expect(resolveShowHotspotDebug("?foo=bar")).toBe(false);
  });

  it("is true when ?debug is present, with or without a value", () => {
    expect(resolveShowHotspotDebug("?debug")).toBe(true);
    expect(resolveShowHotspotDebug("?debug=1")).toBe(true);
    expect(resolveShowHotspotDebug("?foo=bar&debug")).toBe(true);
  });
});

describe("setActiveVerb", () => {
  it("marks only the selected verb's button active", () => {
    const shell = buildShell(document.createElement("div"));
    setActiveVerb(shell, "talk");
    for (const [verb, button] of shell.verbButtons) {
      expect(button.classList.contains("active")).toBe(verb === "talk");
    }
  });
});

describe("showMessage", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the message and auto-hides it", () => {
    const shell = buildShell(document.createElement("div"));
    showMessage(shell, "Picked up Brass Key.");
    expect(shell.messageToast.hidden).toBe(false);
    expect(shell.messageToast.textContent).toBe("Picked up Brass Key.");
    expect(shell.messageToast.classList.contains("is-error")).toBe(false);

    vi.advanceTimersByTime(5000);
    expect(shell.messageToast.hidden).toBe(true);
  });

  it("flags script errors distinctly", () => {
    const shell = buildShell(document.createElement("div"));
    showMessage(shell, "Script error: boom", true);
    expect(shell.messageToast.classList.contains("is-error")).toBe(true);
  });
});

describe("renderDialogue", () => {
  it("renders the line and a button per response that chooses it on click", () => {
    const shell = buildShell(document.createElement("div"));
    const session = makeSession();
    const chooseSpy = vi.spyOn(session, "chooseDialogueResponse");

    renderDialogue(shell, session, {
      text: "Good evening.",
      responses: [{ text: "Hello." }, { text: "Never mind." }],
    });

    expect(shell.dialogueBox.hidden).toBe(false);
    expect(shell.dialogueLine.textContent).toBe("Good evening.");
    const buttons = shell.dialogueResponses.querySelectorAll("button");
    expect(buttons).toHaveLength(2);

    (buttons[1] as HTMLButtonElement).click();
    expect(chooseSpy).toHaveBeenCalledWith(1);
  });
});

describe("hotspot tooltip", () => {
  it("shows the hotspot's name as text on hover-in, and hides on hover-out", () => {
    const shell = buildShell(document.createElement("div"));
    expect(shell.hotspotTooltip.hidden).toBe(true);

    showHotspotTooltip(shell, "Brass Key", { x: 10, y: 20 });
    expect(shell.hotspotTooltip.hidden).toBe(false);
    expect(shell.hotspotTooltip.textContent).toBe("Brass Key");

    hideHotspotTooltip(shell);
    expect(shell.hotspotTooltip.hidden).toBe(true);
  });

  it("never uses innerHTML for the hotspot name, even if it contains markup", () => {
    const shell = buildShell(document.createElement("div"));
    showHotspotTooltip(shell, "<img src=x onerror=alert(1)>", { x: 0, y: 0 });

    expect(shell.hotspotTooltip.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(shell.hotspotTooltip.querySelector("img")).toBeNull();
  });
});

describe("inventory wiring", () => {
  it("onInventorySelect toggles selection on repeat clicks", () => {
    const session = makeSession();
    session.inventory.add("brass-key");

    onInventorySelect(session, "brass-key");
    expect(session.inventory.selectedItemId).toBe("brass-key");

    onInventorySelect(session, "brass-key");
    expect(session.inventory.selectedItemId).toBeUndefined();
  });

  it("refreshInventoryBar reflects carried items in the InventoryBar", async () => {
    const session = makeSession();
    session.inventory.add("brass-key");
    const inventoryBar = new InventoryBar();

    await refreshInventoryBar(session, inventoryBar);

    expect(inventoryBar.slot("brass-key")).toBeDefined();
  });
});
