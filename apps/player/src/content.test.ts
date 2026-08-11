import { describe, expect, it } from "vitest";
import { DEMO_START_ROOM_ID, demoContentLoaders, resolveDemoAssetUrl } from "./content.js";

describe("demoContentLoaders", () => {
  it("loads the start room with its hotspots and npcs", async () => {
    const room = await demoContentLoaders.loadRoom(DEMO_START_ROOM_ID);
    expect(room.id).toBe("study");
    expect(room.hotspots.map((h) => h.id)).toEqual(
      expect.arrayContaining(["shelf", "desk", "door", "jeeves-spot", "aria-spot"]),
    );
    expect(room.npcIds).toEqual(expect.arrayContaining(["jeeves", "aria"]));
  });

  it("loads the epilogue room reached by the door script", async () => {
    const room = await demoContentLoaders.loadRoom("freedom");
    expect(room.id).toBe("freedom");
  });

  it("loads both puzzle items", async () => {
    const brassKey = await demoContentLoaders.loadItem("brass-key");
    const doorKey = await demoContentLoaders.loadItem("door-key");
    expect(brassKey.name).toBe("Brass Key");
    expect(doorKey.name).toBe("Heavy Door Key");
  });

  it("loads both NPCs with dialogue trees", async () => {
    const jeeves = await demoContentLoaders.loadNpc("jeeves");
    const aria = await demoContentLoaders.loadNpc("aria");
    expect(jeeves.dialogueTreeId).toBe("jeeves-intro");
    expect(aria.dialogueTreeId).toBe("aria-intro");

    const jeevesTree = await demoContentLoaders.loadDialogueTree(jeeves.dialogueTreeId!);
    const ariaTree = await demoContentLoaders.loadDialogueTree(aria.dialogueTreeId!);
    expect(jeevesTree.nodes.map((n) => n.id)).toEqual(ariaTree.nodes.map((n) => n.id));
  });

  it("loads the Lua-scripted puzzle chain: unlock the desk, then open the door", async () => {
    const unlockDesk = await demoContentLoaders.loadScript("unlock-desk");
    const openDoor = await demoContentLoaders.loadScript("open-door");
    expect(unlockDesk.source).toContain('giveItem("door-key")');
    expect(openDoor.source).toContain('gotoRoom("freedom")');
  });

  it("rejects unknown ids", async () => {
    await expect(demoContentLoaders.loadRoom("nope")).rejects.toThrow(/unknown room id/);
  });

  it("resolves content-relative asset paths to bundled URLs", () => {
    expect(resolveDemoAssetUrl("assets/rooms/study/background.png")).toEqual(expect.any(String));
    expect(() => resolveDemoAssetUrl("assets/does-not-exist.png")).toThrow(/no bundled asset/);
  });
});
