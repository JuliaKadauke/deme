import type {
  DialogueTree,
  EntityId,
  Hook,
  Hotspot,
  Item,
  Npc,
  Script,
  ScriptRef,
} from "@deme/content-schema";
import type { Container } from "pixi.js";
import { applyEffects, evaluateCondition } from "./conditions.js";
import { DialogueRuntime } from "./dialogue-runtime.js";
import { Emitter, type EngineEventMap, type HotspotInteractEvent } from "./events.js";
import type { Point } from "./geometry.js";
import { GameRuntime, type RoomLoader } from "./game-runtime.js";
import { GameState } from "./game-state.js";
import { Inventory } from "./inventory.js";
import type { LuaSandboxLimits } from "./lua-sandbox.js";
import type { TextureLoader } from "./room-scene.js";
import { DEFAULT_SAVE_KEY, loadGameState, saveGameState, type StorageLike } from "./save-load.js";
import { runInteractionScript } from "./script-runtime.js";
import type { Verb } from "./verbs.js";

/** Loads content entities by id. Left up to the host app, same as GameRuntime's `loadRoom`. */
export interface ContentLoaders {
  loadRoom: RoomLoader;
  loadItem: (itemId: EntityId) => Promise<Item>;
  loadNpc: (npcId: EntityId) => Promise<Npc>;
  loadDialogueTree: (treeId: EntityId) => Promise<DialogueTree>;
  /** Resolves a `ScriptRef.scriptId` reference to its shared Script entity. Only called for entries that use `scriptId` rather than inline `source`. */
  loadScript: (scriptId: EntityId) => Promise<Script>;
}

export interface GameSessionOptions {
  /** The container clicks are captured on and the room scene is mounted into — forwarded to GameRuntime. */
  stage: Container;
  loaders: ContentLoaders;
  loadTexture?: TextureLoader;
  playerStart?: Point;
  playerSpeedPxPerSec?: number;
  showHotspotDebug?: boolean;
  /** The room a new game starts in. Ignored if `initialState` is given. */
  startRoomId: EntityId;
  /** Resumes from this GameState instead of starting a new game at `startRoomId`. */
  initialState?: GameState;
  /** Overrides the sandboxed Lua VM's resource limits (instruction budget, call depth, memory) for interaction scripts. See lua-sandbox.ts for defaults. */
  scriptLimits?: Partial<LuaSandboxLimits>;
}

/**
 * Orchestrates a full playthrough: owns GameState, Inventory, and (while a
 * conversation is active) a DialogueRuntime, and wires them into a
 * GameRuntime's `hotspot-interact` events so hotspot clicks can read/mutate
 * state and trigger dialogue — the piece GameRuntime's README explicitly
 * left out ("No dialogue, inventory, or scripting lives here yet").
 *
 * Resolution order for a hotspot click (see `handleHotspotInteract`):
 * 1. An inventory item is selected → "use selected item on this hotspot".
 * 2. Verb is `pick-up` and the hotspot has a not-yet-carried, portable item
 *    → pick it up (falls through to 4 if there's no such item).
 * 3. Verb is `talk` and the hotspot has an NPC with a dialogue tree → start it.
 * 4. Otherwise → resolve `hotspot.interactions` for the click's hook: the
 *    first entry whose `condition` holds against current GameState has its
 *    `effects` applied, then its `source`/`scriptId` Lua (if any) is run
 *    through the sandboxed VM in lua-sandbox.ts/script-runtime.ts — see
 *    "Scripting" below.
 *
 * ### Scripting
 *
 * Once a `ScriptRef` entry's `condition` matches and `effects` are applied,
 * its Lua `source` (inline) or the Script entity `scriptId` resolves to (via
 * `loaders.loadScript`) is run in a fresh sandboxed VM (`runInteractionScript`),
 * with the whitelisted game-state API bound to this session's `state` and
 * `inventory`/`runtime`. A script that throws (a bug, or adversarial content
 * hitting a sandbox limit) fires `script-error` instead of propagating —
 * one bad script aborts only itself, never the session.
 */
export class GameSession {
  readonly events = new Emitter<EngineEventMap>();
  readonly runtime: GameRuntime;
  readonly state: GameState;
  readonly inventory: Inventory;

  private readonly loaders: ContentLoaders;
  private readonly scriptLimits: Partial<LuaSandboxLimits> | undefined;
  private activeDialogue: DialogueRuntime | undefined;
  private dialogueNpcId: EntityId | undefined;

  constructor(options: GameSessionOptions) {
    this.loaders = options.loaders;
    this.scriptLimits = options.scriptLimits;
    this.state = options.initialState ?? new GameState({ currentRoomId: options.startRoomId });
    this.inventory = new Inventory(this.state);

    this.runtime = new GameRuntime({
      stage: options.stage,
      loadRoom: options.loaders.loadRoom,
      loadTexture: options.loadTexture,
      playerStart: options.playerStart,
      playerSpeedPxPerSec: options.playerSpeedPxPerSec,
      showHotspotDebug: options.showHotspotDebug,
    });

    this.forwardRuntimeEvents();
    this.forwardInventoryEvents();
  }

  /** Loads the current room (new-game start room, or a resumed `initialState`'s room) and starts rendering. */
  async start(): Promise<void> {
    await this.runtime.loadRoom(this.state.currentRoomId);
  }

  setVerb(verb: Verb): void {
    this.runtime.setVerb(verb);
  }

  /** Advances player movement. Call from the host's render loop, same as GameRuntime#update. */
  update(deltaMs: number): void {
    this.runtime.update(deltaMs);
  }

  /** Resolves the Item entities for the player's current inventory, e.g. to feed an InventoryBar. */
  carriedItems(): Promise<Item[]> {
    return Promise.all(this.inventory.itemIds.map((itemId) => this.loaders.loadItem(itemId)));
  }

  selectInventoryItem(itemId: EntityId): void {
    this.inventory.select(itemId);
  }

  deselectInventoryItem(): void {
    this.inventory.deselect();
  }

  /** Uses the currently selected inventory item on another inventory item (e.g. combining two items). No-op if nothing is selected. */
  async useSelectedItemOnItem(targetItemId: EntityId): Promise<void> {
    const gesture = this.inventory.useSelectedOn({ kind: "item", itemId: targetItemId });
    if (!gesture) return;
    const resolved = await this.resolveItemCombination(gesture.itemId, targetItemId);
    this.events.emit("item-used", { itemId: gesture.itemId, target: gesture.target, resolved });
  }

  /** Selects a response by its index into the active dialogue's `availableResponses`. No-op if no dialogue is active. */
  chooseDialogueResponse(index: number): void {
    this.activeDialogue?.choose(index);
  }

  get activeDialogueNpcId(): EntityId | undefined {
    return this.activeDialogue && !this.activeDialogue.isEnded ? this.dialogueNpcId : undefined;
  }

  save(storage: StorageLike, key: string = DEFAULT_SAVE_KEY): void {
    saveGameState(storage, this.state, key);
    this.events.emit("game-saved", { key });
  }

  /** Restores GameState from storage (in place — existing `state`/`inventory` references stay valid) and reloads the current room. No-op if nothing is saved under `key`. */
  async load(storage: StorageLike, key: string = DEFAULT_SAVE_KEY): Promise<void> {
    const loaded = loadGameState(storage, key);
    if (!loaded) return;

    this.inventory.deselect();
    this.activeDialogue = undefined;
    this.dialogueNpcId = undefined;
    this.state.restoreFrom(loaded);

    await this.runtime.loadRoom(this.state.currentRoomId);
    this.events.emit("game-loaded", { key });
  }

  destroy(): void {
    this.runtime.destroy();
  }

  private forwardRuntimeEvents(): void {
    this.runtime.events.on("room-loaded", (event) => {
      this.state.currentRoomId = event.room.id;
      this.events.emit("room-loaded", event);
    });
    this.runtime.events.on("room-exit", (event) => this.events.emit("room-exit", event));
    this.runtime.events.on("player-walk", (event) => this.events.emit("player-walk", event));
    this.runtime.events.on("hotspot-hover", (event) => this.events.emit("hotspot-hover", event));
    this.runtime.events.on("hotspot-interact", (event) => {
      this.events.emit("hotspot-interact", event);
      void this.handleHotspotInteract(event);
    });
  }

  private forwardInventoryEvents(): void {
    const types = [
      "item-added",
      "item-removed",
      "item-selected",
      "item-deselected",
      "item-use-requested",
    ] as const;
    for (const type of types) {
      this.inventory.events.on(type, (event) => this.events.emit(type, event));
    }
  }

  private async handleHotspotInteract(event: HotspotInteractEvent): Promise<void> {
    const { roomId, hotspot, verb, hook } = event;

    if (this.inventory.selectedItemId !== undefined) {
      await this.useSelectedItemOnHotspot(roomId, hotspot);
      return;
    }

    if (verb === "pick-up") {
      await this.tryPickUp(roomId, hotspot, hook);
      return;
    }

    if (verb === "talk" && hotspot.targetNpcId) {
      await this.tryStartDialogue(hotspot.targetNpcId);
      return;
    }

    await this.resolveHotspotInteractions(hotspot, hook);
  }

  private async useSelectedItemOnHotspot(roomId: EntityId, hotspot: Hotspot): Promise<void> {
    const gesture = this.inventory.useSelectedOn({ kind: "hotspot", roomId, hotspot });
    if (!gesture) return;
    const resolved = await this.resolveHotspotInteractions(hotspot, "on-use");
    this.events.emit("item-used", { itemId: gesture.itemId, target: gesture.target, resolved });
  }

  private async tryPickUp(roomId: EntityId, hotspot: Hotspot, hook: Hook): Promise<void> {
    const itemId = hotspot.targetItemId;
    if (itemId && !this.state.hasItem(itemId)) {
      const item = await this.loaders.loadItem(itemId);
      if (item.portable !== false) {
        this.inventory.add(itemId);
        this.events.emit("item-picked-up", { itemId, roomId, hotspotId: hotspot.id });
        return;
      }
    }
    await this.resolveHotspotInteractions(hotspot, hook);
  }

  private async tryStartDialogue(npcId: EntityId): Promise<void> {
    const npc = await this.loaders.loadNpc(npcId);
    if (!npc.dialogueTreeId) return;

    const tree = await this.loaders.loadDialogueTree(npc.dialogueTreeId);
    const runtime = new DialogueRuntime(npcId, tree, this.state);
    runtime.events.on("dialogue-started", (event) => this.events.emit("dialogue-started", event));
    runtime.events.on("dialogue-line", (event) => this.events.emit("dialogue-line", event));
    runtime.events.on("dialogue-ended", (event) => {
      this.events.emit("dialogue-ended", event);
      this.activeDialogue = undefined;
      this.dialogueNpcId = undefined;
    });

    this.activeDialogue = runtime;
    this.dialogueNpcId = npcId;
    runtime.start();
  }

  /** Applies the first `hook`-matching interaction whose condition holds (effects, then Lua). Returns whether one was found. */
  private async resolveHotspotInteractions(hotspot: Hotspot, hook: Hook): Promise<boolean> {
    const entry = (hotspot.interactions ?? []).find(
      (ref) => ref.hook === hook && evaluateCondition(ref.condition, this.state),
    );
    if (!entry) return false;
    applyEffects(entry.effects, this.state);
    await this.runScriptRef(entry);
    return true;
  }

  private async resolveItemCombination(itemId: EntityId, targetItemId: EntityId): Promise<boolean> {
    const item = await this.loaders.loadItem(itemId);
    if (!(item.combinesWithItemIds ?? []).includes(targetItemId)) return false;

    const entry = (item.interactions ?? []).find(
      (ref) => ref.hook === "on-combine" && evaluateCondition(ref.condition, this.state),
    );
    if (!entry) return false;
    applyEffects(entry.effects, this.state);
    await this.runScriptRef(entry);
    return true;
  }

  /**
   * Runs a matched ScriptRef's Lua, if it has any (`source` inline, or
   * `scriptId` resolved via `loaders.loadScript`) — a no-op for entries that
   * are pure `condition`/`effects` gates. Failures (sandbox limits,
   * authoring bugs, an undefined whitelist function) fire `script-error`
   * instead of throwing, so one bad script can't take down the session.
   */
  private async runScriptRef(ref: ScriptRef): Promise<void> {
    try {
      const source = ref.scriptId
        ? (await this.loaders.loadScript(ref.scriptId)).source
        : ref.source;
      if (!source) return;

      await runInteractionScript(
        source,
        this.state,
        {
          giveItem: (itemId) => this.inventory.add(itemId),
          removeItem: (itemId) => this.inventory.remove(itemId),
          changeRoom: (roomId) => void this.runtime.loadRoom(roomId),
          describe: (text) => this.events.emit("script-message", { text }),
        },
        this.scriptLimits,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.events.emit("script-error", { hook: ref.hook, message });
    }
  }
}
