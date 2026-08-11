#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  isDirectory,
  validateContentDir,
  validateEntityShape,
  type ValidationIssue,
} from "./validator.js";

function printUsage(): void {
  console.error("Usage: deme validate <path> [--json]");
  console.error("");
  console.error("  <path>   A content directory (validated fully, including");
  console.error("           cross-file referential integrity) or a single");
  console.error("           *.json content file (validated for shape and");
  console.error("           in-file references only).");
  console.error("  --json   Emit issues as a JSON array instead of text.");
}

function printIssuesText(issues: ValidationIssue[]): void {
  const byFile = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const forFile = byFile.get(issue.file) ?? [];
    forFile.push(issue);
    byFile.set(issue.file, forFile);
  }
  for (const [file, fileIssues] of byFile) {
    console.error(`✗ ${file}`);
    for (const issue of fileIssues) {
      const parts = [`  ${issue.path}: ${issue.message}`];
      if (issue.expected !== undefined) parts.push(`      expected: ${issue.expected}`);
      if (issue.actual !== undefined) parts.push(`      actual:   ${issue.actual}`);
      console.error(parts.join("\n"));
    }
  }
}

function main(argv: string[]): number {
  const [command, target, ...rest] = argv;
  const asJson = rest.includes("--json");

  if (command !== "validate" || !target) {
    printUsage();
    return 1;
  }

  let issues: ValidationIssue[];
  let filesChecked: number;

  if (isDirectory(target)) {
    const report = validateContentDir(target);
    issues = report.issues;
    filesChecked = report.filesChecked;
  } else {
    const data: unknown = JSON.parse(readFileSync(target, "utf-8"));
    issues = validateEntityShape(data, target);
    filesChecked = 1;
  }

  if (asJson) {
    console.log(JSON.stringify({ valid: issues.length === 0, filesChecked, issues }, null, 2));
    return issues.length === 0 ? 0 : 1;
  }

  if (issues.length === 0) {
    console.log(`${target}: valid (${filesChecked} file(s) checked)`);
    return 0;
  }

  printIssuesText(issues);
  const filesWithIssues = new Set(issues.map((i) => i.file)).size;
  console.error(
    `\n${filesChecked} file(s) checked, ${issues.length} error(s) in ${filesWithIssues} file(s)`,
  );
  return 1;
}

process.exit(main(process.argv.slice(2)));
