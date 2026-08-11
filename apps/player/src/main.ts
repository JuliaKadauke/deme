import { renderShell } from "./app.js";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  renderShell(root);
}
