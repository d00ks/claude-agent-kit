#!/usr/bin/env bun
// Agent Scaffolder CLI entrypoint.
//
// Usage:
//   agent-scaffolder install                    # interactive wizard
//   agent-scaffolder install --out ~/foo --provider telegram --modules inbox-triage,calendar
//   agent-scaffolder version
//   agent-scaffolder list-modules

import { parseArgs } from "node:util";
import { join } from "node:path";
import { confirm } from "@inquirer/prompts";
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
  console.log("  --bootstrap              After scaffold, auto-run ./bootstrap.sh in the new vault");
  console.log("  --managed                After bootstrap, auto-run ./bootstrap-managed.sh (SSH + Tailscale overlay)");
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
    bootstrap: { type: "boolean", default: false },
    managed: { type: "boolean", default: false },
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

const nonInteractive = !!flags["non-interactive"];
const answers = await runWizard(presets, { nonInteractive });
const result = await scaffold(answers);

console.log("");
console.log(`✓ scaffold complete: ${result.outDir}`);
console.log(`  provider:        ${result.provider}`);
console.log(`  modules:         ${result.modules.join(", ") || "(none)"}`);
console.log(`  files created:   ${result.filesCreated}`);
console.log("");

// Optionally chain into bootstrap.sh + bootstrap-managed.sh so the install
// is one command instead of three. Flags --bootstrap / --managed force-yes;
// interactive mode prompts the user.
async function shouldChain(question: string, flagValue: boolean): Promise<boolean> {
  if (flagValue) return true;
  if (nonInteractive) return false;
  return await confirm({ message: question, default: true });
}

const doBootstrap = await shouldChain(
  "Run ./bootstrap.sh now to install prereqs + the messaging plugin?",
  !!flags.bootstrap,
);

let doManaged = false;
if (doBootstrap) {
  doManaged = await shouldChain(
    "Also run ./bootstrap-managed.sh (SSH + Tailscale-guest overlay for managed-service installs)?",
    !!flags.managed,
  );
}

if (doBootstrap) {
  console.log("");
  console.log("▶ running bootstrap.sh");
  const env = { ...process.env, BOOTSTRAP_YES: process.env.BOOTSTRAP_YES ?? "1" };
  const proc = Bun.spawnSync(["bash", "./bootstrap.sh"], {
    cwd: result.outDir,
    stdio: ["inherit", "inherit", "inherit"],
    env,
  });
  if (proc.exitCode !== 0) {
    console.error(`✗ bootstrap.sh exited with ${proc.exitCode}`);
    process.exit(proc.exitCode ?? 1);
  }
}

if (doManaged) {
  const managedScript = join(result.outDir, "bootstrap-managed.sh");
  if (!(await Bun.file(managedScript).exists())) {
    console.log("");
    console.log("✗ bootstrap-managed.sh not found in this install — skipping the managed-service overlay.");
    console.log("  (Public builds of the kit omit this; only the internal/managed variant ships it.)");
  } else {
    console.log("");
    console.log("▶ running bootstrap-managed.sh");
    const env = { ...process.env, BOOTSTRAP_YES: process.env.BOOTSTRAP_YES ?? "1" };
    const proc = Bun.spawnSync(["bash", "./bootstrap-managed.sh"], {
      cwd: result.outDir,
      stdio: ["inherit", "inherit", "inherit"],
      env,
    });
    if (proc.exitCode !== 0) {
      console.error(`✗ bootstrap-managed.sh exited with ${proc.exitCode}`);
      process.exit(proc.exitCode ?? 1);
    }
  }
}

console.log("");
console.log("Next steps:");
console.log(`  1. cd ${result.outDir}`);
if (!doBootstrap) console.log(`  2. Run: ./bootstrap.sh`);
console.log(`  ${doBootstrap ? "2" : "3"}. Message the agent via ${result.provider} to start onboarding`);
console.log("");
