import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemasDir = path.join(here, "..", "schemas");

export function loadSchema(name: string): object {
  const file = path.join(schemasDir, `${name}.schema.json`);
  return JSON.parse(readFileSync(file, "utf-8"));
}
