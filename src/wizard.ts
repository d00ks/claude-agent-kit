// Interactive bootstrap-essentials wizard.
//
// Per design: NO client-specific info collected here. The agent's own onboarding
// interview captures operator name, organization, hierarchy, tone, vocabulary,
// sensitive-data list, etc. after first boot.

import { select, checkbox, input, confirm } from "@inquirer/prompts";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { v1Modules, validateModules } from "./modules.ts";

export type Provider = "telegram" | "slack";

export interface WizardAnswers {
  outDir: string;
  provider: Provider;
  modules: string[];
  label: string;          // install label for Keychain namespacing (kebab-case)
  personaName: string;    // local-token slug for the persona dir; not the operator's real name
}

export interface WizardOpts {
  nonInteractive: boolean;
}

const DEFAULT_OUT_DIR = `${homedir()}/Obsidian/Agent`;
const DEFAULT_PERSONA = "operator";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export async function runWizard(
  presets: Partial<WizardAnswers>,
  opts: WizardOpts,
): Promise<WizardAnswers> {
  // ---------- 1. provider ----------
  let provider: Provider;
  if (presets.provider) {
    provider = presets.provider;
  } else if (opts.nonInteractive) {
    throw new Error("--provider required in non-interactive mode");
  } else {
    provider = await select<Provider>({
      message: "Messaging provider for the agent",
      choices: [
        { name: "telegram (default — anthropics/claude-plugins-official; override via TELEGRAM_PLUGIN_SLUG)", value: "telegram" },
        { name: "slack    (anthropics/claude-plugins-official; override via SLACK_PLUGIN_SLUG)", value: "slack" },
      ],
      default: "telegram",
    });
  }

  // ---------- 2. modules ----------
  let modules: string[];
  if (presets.modules && presets.modules.length > 0) {
    const v = validateModules(presets.modules);
    if (v.unknown.length > 0) {
      throw new Error(`unknown / non-V1 modules: ${v.unknown.join(", ")}`);
    }
    if (v.conflicts.length > 0) {
      throw new Error(`module conflict: ${v.conflicts.join("; ")}`);
    }
    modules = v.ok;
  } else if (opts.nonInteractive) {
    throw new Error("--modules required in non-interactive mode");
  } else {
    while (true) {
      modules = await checkbox<string>({
        message: "Capability modules to ship (multi-select)",
        choices: v1Modules().map((m) => ({
          name: `${m.name.padEnd(22)} ${m.description}`,
          value: m.name,
          checked: m.name !== "google-workspace" && m.name !== "google-workspace-mcp",
        })),
      });
      const v = validateModules(modules);
      if (v.conflicts.length === 0) break;
      console.log("");
      for (const c of v.conflicts) console.log(`  ⚠ ${c}`);
      console.log("");
      console.log("  google-workspace      = gog-CLI path (full power, requires a GCP project)");
      console.log("  google-workspace-mcp  = Anthropic-hosted MCP path (60s OAuth, zero GCP setup)");
      console.log("  Re-select with exactly one.");
      console.log("");
    }
  }

  // ---------- 3. output dir ----------
  let outDir: string;
  if (presets.outDir) {
    outDir = resolve(presets.outDir);
  } else if (opts.nonInteractive) {
    throw new Error("--out required in non-interactive mode");
  } else {
    const raw = await input({
      message: "Target directory for the generated vault",
      default: DEFAULT_OUT_DIR,
    });
    outDir = resolve(raw);
  }

  // ---------- 4. install label (for Keychain namespacing) ----------
  let label: string;
  if (presets.label) {
    label = slugify(presets.label);
  } else if (opts.nonInteractive) {
    throw new Error("--label required in non-interactive mode");
  } else {
    const raw = await input({
      message:
        "Install label (used to namespace Keychain entries, e.g. 'healthmerch-bil')",
      default: outDir.split("/").pop() || "agent",
      validate: (v: string) =>
        v.length > 0 && /^[a-z0-9-]+$/i.test(v) || "use letters / digits / hyphens",
    });
    label = slugify(raw);
  }

  // ---------- 5. persona name (local slug, not operator's real name) ----------
  // Kept generic for V1; the agent renames its own persona dir during onboarding
  // if the operator wants a personalized handle. Default works for most installs.
  const personaName = presets.personaName ?? DEFAULT_PERSONA;

  // ---------- confirm ----------
  if (!opts.nonInteractive) {
    console.log("");
    console.log("Review:");
    console.log(`  outDir:    ${outDir}`);
    console.log(`  provider:  ${provider}`);
    console.log(`  modules:   ${modules.join(", ")}`);
    console.log(`  label:     ${label}`);
    console.log(`  persona:   ${personaName} (agent will rename via onboarding)`);
    console.log("");
    const ok = await confirm({ message: "Generate?", default: true });
    if (!ok) {
      console.log("aborted.");
      process.exit(0);
    }
  }

  return { outDir, provider, modules, label, personaName };
}
