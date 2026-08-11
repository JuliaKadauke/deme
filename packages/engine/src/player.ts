import type { PolygonPoints } from "@deme/content-schema";
import { clampToPolygon, type Point } from "./geometry.js";

export interface PlayerOptions {
  /** Pixels per second the character walks. */
  speedPxPerSec?: number;
  /** The room's walk box. Click-to-walk targets are clamped into it. Omit for no movement. */
  walkBox?: PolygonPoints;
}

const DEFAULT_SPEED_PX_PER_SEC = 160;

/** Player-character position and walk-box-constrained click-to-walk movement. */
export class Player {
  x: number;
  y: number;
  readonly speedPxPerSec: number;
  private walkBox: PolygonPoints | undefined;
  private target: Point | undefined;

  constructor(start: Point, options: PlayerOptions = {}) {
    this.x = start.x;
    this.y = start.y;
    this.speedPxPerSec = options.speedPxPerSec ?? DEFAULT_SPEED_PX_PER_SEC;
    this.walkBox = options.walkBox;
  }

  get position(): Point {
    return { x: this.x, y: this.y };
  }

  get isWalking(): boolean {
    return this.target !== undefined;
  }

  setWalkBox(walkBox: PolygonPoints | undefined): void {
    this.walkBox = walkBox;
  }

  /** Commands the character to walk toward `point`, clamped into the walk box. Returns the clamped target. */
  walkTo(point: Point): Point {
    const target = this.walkBox ? clampToPolygon(point, this.walkBox) : point;
    this.target = target;
    return target;
  }

  stop(): void {
    this.target = undefined;
  }

  /** Advances position toward the current target by `deltaMs` of movement at `speedPxPerSec`. */
  update(deltaMs: number): void {
    if (!this.target) return;

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const distance = Math.hypot(dx, dy);
    const step = (this.speedPxPerSec * deltaMs) / 1000;

    if (distance <= step || distance === 0) {
      this.x = this.target.x;
      this.y = this.target.y;
      this.target = undefined;
    } else {
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }
  }
}
