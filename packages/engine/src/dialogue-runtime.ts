import type { DialogueNode, DialogueTree, EntityId } from "@deme/content-schema";
import { applyEffects, evaluateCondition } from "./conditions.js";
import { Emitter, type DialogueResponseOption, type EngineEventMap } from "./events.js";
import type { GameState } from "./game-state.js";

/**
 * Walks a single DialogueTree for one NPC: tracks the current node, filters
 * each node's responses down to those whose `condition` holds against the
 * current GameState, and applies a chosen response's `effects` before
 * advancing. Framework-agnostic — no PixiJS dependency, like RoomController
 * — since a dialogue box is host/UI concern, not this package's.
 *
 * "Multiple NPC actors" (per the issue) means multiple NPCs each running
 * their own tree, one DialogueRuntime instance per active conversation —
 * DialogueTree/DialogueNode have no multi-speaker-within-one-tree concept.
 */
export class DialogueRuntime {
  readonly events = new Emitter<EngineEventMap>();

  private currentNodeId: EntityId | undefined;
  private ended = true;

  constructor(
    private readonly npcId: EntityId,
    private readonly tree: DialogueTree,
    private readonly state: GameState,
  ) {}

  get isEnded(): boolean {
    return this.ended;
  }

  get currentNode(): DialogueNode | undefined {
    return this.currentNodeId === undefined ? undefined : this.nodeById(this.currentNodeId);
  }

  /** Responses at the current node whose `condition` holds against current GameState, in original order. */
  get availableResponses(): DialogueResponseOption[] {
    return this.responsesOf(this.currentNode);
  }

  /** Starts (or restarts) the dialogue at the tree's root node, firing `dialogue-started`. */
  start(): void {
    this.ended = false;
    this.goTo(this.tree.rootNodeId, "dialogue-started");
  }

  /**
   * Chooses a response by its index into `availableResponses` (not the raw,
   * unfiltered `node.responses` index), applies its `effects`, and either
   * advances to `targetNodeId` (firing `dialogue-line`) or ends the dialogue
   * (firing `dialogue-ended`) if it has none. No-op once ended or if `index`
   * is out of range.
   */
  choose(index: number): void {
    if (this.ended) return;
    const response = this.availableResponses[index];
    if (!response) return;

    applyEffects(response.effects, this.state);

    if (response.targetNodeId) {
      this.goTo(response.targetNodeId, "dialogue-line");
    } else {
      this.ended = true;
      this.currentNodeId = undefined;
      this.events.emit("dialogue-ended", { npcId: this.npcId, treeId: this.tree.id });
    }
  }

  private goTo(nodeId: EntityId, eventType: "dialogue-started" | "dialogue-line"): void {
    const node = this.nodeById(nodeId);
    if (!node) {
      throw new Error(`DialogueRuntime: node "${nodeId}" not found in tree "${this.tree.id}"`);
    }
    this.currentNodeId = nodeId;
    this.events.emit(eventType, {
      npcId: this.npcId,
      treeId: this.tree.id,
      node,
      responses: this.responsesOf(node),
    });
  }

  private responsesOf(node: DialogueNode | undefined): DialogueResponseOption[] {
    if (!node) return [];
    return (node.responses ?? []).filter((response) =>
      evaluateCondition(response.condition, this.state),
    );
  }

  private nodeById(id: EntityId): DialogueNode | undefined {
    return this.tree.nodes.find((node) => node.id === id);
  }
}
