import { createEngine } from "@deme/engine";

export function renderShell(root: HTMLElement): void {
  const engine = createEngine();
  root.textContent = `deme player shell — engine v${engine.version}`;
}
