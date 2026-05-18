// Vault tree generator. Mirrors /Users/jarvis/Obsidian/Jarvis/ structure
// with {{placeholder}} slots the agent fills in during onboarding.

import { mkdir, writeFile, copyFile, readdir, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WizardAnswers } from "./wizard.ts";
import { renderTemplate, templateVars } from "./templates.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const TEMPLATES_DIR = join(REPO_ROOT, "src", "templates");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const BOOTSTRAP_DIR = join(REPO_ROOT, "bootstrap");

export interface ScaffoldResult {
  outDir: string;
  provider: string;
  modules: string[];
  filesCreated: number;
}

async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}

async function writeRenderedTemplate(
  templateRelPath: string,
  outAbsPath: string,
  vars: Record<string, string>,
): Promise<void> {
  const tmplPath = join(TEMPLATES_DIR, templateRelPath);
  const raw = await readFile(tmplPath, "utf8");
  const rendered = renderTemplate(raw, vars);
  await ensureDir(dirname(outAbsPath));
  await writeFile(outAbsPath, rendered, "utf8");
}

async function copyDir(src: string, dst: string): Promise<number> {
  if (!existsSync(src)) return 0;
  let count = 0;
  const entries = await readdir(src);
  for (const entry of entries) {
    const s = join(src, entry);
    const d = join(dst, entry);
    const st = await stat(s);
    if (st.isDirectory()) {
      await ensureDir(d);
      count += await copyDir(s, d);
    } else {
      await ensureDir(dirname(d));
      await copyFile(s, d);
      count++;
    }
  }
  return count;
}

export async function scaffold(answers: WizardAnswers): Promise<ScaffoldResult> {
  const { outDir, provider, modules, label, personaName } = answers;

  if (existsSync(outDir)) {
    const entries = await readdir(outDir);
    if (entries.length > 0) {
      throw new Error(`outDir ${outDir} is not empty (${entries.length} entries). Refusing to overwrite.`);
    }
  }

  await ensureDir(outDir);

  const vars = templateVars({ provider, modules, label, personaName });

  // ---------- root templates ----------
  let filesCreated = 0;
  const rootFiles: [string, string][] = [
    ["INDEX.md.tmpl",              "INDEX.md"],
    ["CLAUDE.md.tmpl",             "CLAUDE.md"],
    ["HANDOFF.md.tmpl",            "HANDOFF.md"],
    ["bootstrap.sh.tmpl",          "bootstrap.sh"],
    ["restart.sh.tmpl",            "restart.sh"],
    ["bootstrap-secret.sh.tmpl",   "bootstrap-secret"],
  ];
  for (const [tmpl, out] of rootFiles) {
    await writeRenderedTemplate(tmpl, join(outDir, out), vars);
    filesCreated++;
  }

  // Make shell scripts executable.
  for (const exe of ["bootstrap.sh", "restart.sh", "bootstrap-secret"]) {
    await Bun.spawn(["chmod", "+x", join(outDir, exe)]).exited;
  }

  // ---------- persona dir ----------
  const personaDir = join(outDir, "personas", personaName);
  await ensureDir(join(personaDir, "inbox"));
  await ensureDir(join(personaDir, "processing"));
  await ensureDir(join(personaDir, "notes"));
  await ensureDir(join(personaDir, "memory"));
  await writeRenderedTemplate(
    "personas/persona-CLAUDE.md.tmpl",
    join(personaDir, "CLAUDE.md"),
    vars,
  );
  filesCreated++;

  // ---------- shared dir ----------
  const sharedDir = join(outDir, "shared");
  await ensureDir(join(sharedDir, "inbox"));
  await ensureDir(join(sharedDir, "processing"));
  await ensureDir(join(sharedDir, "memory"));

  const sharedFiles: [string, string][] = [
    ["shared/shared-CLAUDE.md.tmpl",          "shared/CLAUDE.md"],
    ["shared/PRIORITIES.md.tmpl",             "shared/PRIORITIES.md"],
    ["shared/MASTER-INVENTORY.md.tmpl",       "shared/MASTER-INVENTORY.md"],
    ["shared/MEMORY.md.tmpl",                 "shared/MEMORY.md"],
    ["shared/IDEAS.md.tmpl",                  "shared/IDEAS.md"],
    ["shared/memory/active-tasks.md.tmpl",    "shared/memory/active-tasks.md"],
    ["shared/memory/urgent-reminders.md.tmpl","shared/memory/urgent-reminders.md"],
    ["shared/memory/feedback.md.tmpl",        "shared/memory/feedback.md"],
    ["shared/memory/lessons.md.tmpl",         "shared/memory/lessons.md"],
  ];
  for (const [tmpl, out] of sharedFiles) {
    await writeRenderedTemplate(tmpl, join(outDir, out), vars);
    filesCreated++;
  }

  // ---------- projects dir ----------
  await ensureDir(join(outDir, "projects"));

  // ---------- .claude/skills/ — copy chosen modules ----------
  for (const mod of modules) {
    const src = join(SKILLS_DIR, mod);
    const dst = join(outDir, ".claude", "skills", mod);
    const copied = await copyDir(src, dst);
    filesCreated += copied;
  }

  // ---------- .scaffolder-state.json ----------
  // Day-granular scaffoldedAt so same-day re-runs produce byte-identical output
  // (helps determinism testing without losing audit value).
  const state = {
    version: "0.1.0",
    provider,
    modules,
    label,
    personaName,
    scaffoldedAt: new Date().toISOString().slice(0, 10),
  };
  await writeFile(
    join(outDir, ".scaffolder-state.json"),
    JSON.stringify(state, null, 2) + "\n",
    "utf8",
  );
  filesCreated++;

  return { outDir, provider, modules, filesCreated };
}
