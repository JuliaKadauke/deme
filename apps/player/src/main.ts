import { boot } from "./app.js";

const root = document.querySelector<HTMLDivElement>("#app");
if (root) {
  void boot(root);
}
