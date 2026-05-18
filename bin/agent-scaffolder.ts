#!/usr/bin/env bun
// Agent Scaffolder CLI entrypoint.
//
// Usage:
//   agent-scaffolder install                    # interactive wizard
//   agent-scaffolder install --out ~/foo --provider telegram --modules inbox-triage,calendar
//   agent-scaffolder version
//   agent-scaffolder list-modules

import { parseArgs } from "node:util";
import { runWizard, type WizardAnswers } from "../src/wizard.ts";
import { scaffold } from "../src/scaffold.ts";
import { listModules } from "../src/modules.ts";

const PKG_VERSION = "0.1.0";

const COMMANDS = {
  install: "Run the interactive wizard and emit a vault",
  version: "Print the scaffolder version",
  "list-modules": "Print available capability modules",
  help: "Show this help",
} as const;

function printHelp() {
  console.log(`agent-scaffolder ${PKG_VERSION}`);
  console.log("");
  console.log("Usage: agent-scaffolder <command> [options]");
  console.log("");
  console.log("Commands:");
  for (const [name, desc] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(16)} ${desc}`);
  }
  console.log("");
  console.log("install options:");
  console.log("  --out <path>             Target directory for the vault (skips prompt)");
  console.log("  --provider <name>        telegram | slack (skips prompt)");
  console.log("  --modules <a,b,c>        Comma-separated module list (skips prompt)");
  console.log("  --label <slug>           Install label for Keychain namespacing");
  console.log("  --non-interactive        Fail if any required answer is missing instead of prompting");
}

const argv = process.argv.slice(2);
const command = argv[0] ?? "help";

if (command === "version" || command === "--version" || command === "-v") {
  console.log(PKG_VERSION);
  process.exit(0);
}

if (command === "help" || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

if (command === "list-modules") {
  for (const m of listModules()) {
    const status = m.v1 ? "✓" : "·";
    console.log(`  ${status} ${m.name.padEnd(22)} ${m.description}`);
  }
  console.log("");
  console.log("  ✓ ships in V1   · planned for V1.1");
  process.exit(0);
}

if (command !== "install") {
  console.error(`unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

const { values: flags } = parseArgs({
  args: argv.slice(1),
  options: {
    out: { type: "string" },
    provider: { type: "string" },
    modules: { type: "string" },
    label: { type: "string" },
    "non-interactive": { type: "boolean", default: false },
  },
  strict: false,
});

const presets: Partial<WizardAnswers> = {};
if (typeof flags.out === "string") presets.outDir = flags.out;
if (typeof flags.provider === "string") {
  if (flags.provider !== "telegram" && flags.provider !== "slack") {
    console.error(`--provider must be 'telegram' or 'slack'; got '${flags.provider}'`);
    process.exit(2);
  }
  presets.provider = flags.provider;
}
if (typeof flags.modules === "string") {
  presets.modules = flags.modules.split(",").map((s) => s.trim()).filter(Boolean);
}
if (typeof flags.label === "string") presets.label = flags.label;

const answers = await runWizard(presets, { nonInteractive: !!flags["non-interactive"] });
const result = await scaffold(answers);

console.log("");
console.log(`✓ scaffold complete: ${result.outDir}`);
console.log(`  provider:        ${result.provider}`);
console.log(`  modules:         ${result.modules.join(", ") || "(none)"}`);
console.log(`  files created:   ${result.filesCreated}`);
console.log("");
console.log("Next steps:");
console.log(`  1. cd ${result.outDir}`);
console.log(`  2. Review the generated INDEX.md + CLAUDE.md + persona docs`);
console.log(`  3. Run: ./bootstrap.sh`);
console.log(`  4. Message the agent via ${result.provider} to start onboarding`);
console.log("");
