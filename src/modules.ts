// Capability modules. Each module corresponds to a directory under ./skills/
// that gets copied into the scaffolded install's .claude/skills/.

export interface ModuleDef {
  name: string;
  description: string;
  v1: boolean; // ships in V1
}

export const MODULES: readonly ModuleDef[] = [
  { name: "inbox-triage",         description: "urgent / defer / delegate routing (folds in vacation-triage)",    v1: true  },
  { name: "calendar",             description: "event create / move / cancel, conflict detection",                v1: true  },
  { name: "scheduling",           description: "meeting scheduling, time-zone aware",                             v1: true  },
  { name: "follow-up-tracking",   description: "lightweight CRM, last-contact + next-action",                     v1: true  },
  { name: "meeting-prep",         description: "lightweight pre-meeting briefs",                                  v1: true  },
  { name: "comms-drafts",         description: "drafted replies (no send in V1)",                                 v1: true  },
  { name: "light-research",       description: "web/doc fetch + summarize",                                       v1: true  },
  { name: "google-workspace",     description: "Gmail/Drive/Sheets/Docs/Cal via gog CLI (self-hosted OAuth path)",  v1: true  },
  { name: "google-workspace-mcp", description: "Gmail/Drive/Cal via Anthropic-hosted MCP (60s OAuth path)",          v1: true  },
  { name: "travel",               description: "flight / hotel / transit (V1.1)",                                  v1: false },
  { name: "expenses",             description: "receipt → expense report (V1.1)",                                  v1: false },
];

// Modules that are mutually exclusive — picking both makes no sense.
// Pairs are bidirectional: [a, b] means can't pick a if b is picked and vice versa.
const MUTUALLY_EXCLUSIVE: readonly (readonly [string, string])[] = [
  ["google-workspace", "google-workspace-mcp"],
];

export function listModules(): readonly ModuleDef[] {
  return MODULES;
}

export function v1Modules(): readonly ModuleDef[] {
  return MODULES.filter((m) => m.v1);
}

export function findModule(name: string): ModuleDef | undefined {
  return MODULES.find((m) => m.name === name);
}

export function validateModules(names: string[]): { ok: string[]; unknown: string[]; conflicts: string[] } {
  const ok: string[] = [];
  const unknown: string[] = [];
  const conflicts: string[] = [];
  for (const n of names) {
    const m = findModule(n);
    if (!m) { unknown.push(n); continue; }
    if (!m.v1) { unknown.push(`${n} (V1.1, not yet shippable)`); continue; }
    ok.push(n);
  }
  // Detect mutually-exclusive pairs both being present.
  const picked = new Set(ok);
  for (const [a, b] of MUTUALLY_EXCLUSIVE) {
    if (picked.has(a) && picked.has(b)) {
      conflicts.push(`${a} + ${b} are mutually exclusive — pick one`);
    }
  }
  return { ok, unknown, conflicts };
}
