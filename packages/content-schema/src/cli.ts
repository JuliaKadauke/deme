#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { validateEntity } from "./validator.js";

const filePath = process.argv[2];
const schemaName = process.argv[3];

if (!filePath) {
  console.error("Usage: deme-validate-content <file.json> [schemaName]");
  process.exit(1);
}

const data: unknown = JSON.parse(readFileSync(filePath, "utf-8"));
const result = validateEntity(data, schemaName);

if (result.valid) {
  console.log(`${filePath}: valid`);
} else {
  console.error(`${filePath}: invalid`);
  for (const error of result.errors) {
    console.error(`  ${error}`);
  }
  process.exit(1);
}
