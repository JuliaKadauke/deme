import { GameSession, InventoryBar, VERBS } from "@deme/engine";
import { Container, Texture } from "pixi.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildShell,
  onInventorySelect,
  refreshInventoryBar,
  renderDialogue,
  setActiveVerb,
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
