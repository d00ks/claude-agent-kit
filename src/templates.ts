// Tiny {{placeholder}} template engine. Deterministic — same vars in → same string out.
//
// Replaces {{name}} anywhere it appears with vars.name. Missing vars throw —
// catching typos in templates loudly is better than silent empty replacement.
//
// Slots intentionally left empty in vars (operator_name, organization, etc.)
// stay as {{name}} in the output; the AGENT fills them in during onboarding.
// Use `keepSlots` to declare these reserved-for-agent placeholders.

export interface TemplateVarsInput {
  provider: string;
  modules: string[];
  label: string;
  personaName: string;
}

// Slots filled in by the wizard (deterministic, technical).
// Slots in keepSlots stay as {{name}} for the agent to fill in.
export function templateVars(input: TemplateVarsInput): Record<string, string> {
  const vars: Record<string, string> = {
    provider: input.provider,
    provider_label: input.provider === "slack" ? "Slack" : "Telegram",
    modules_list: input.modules.map((m) => `- ${m}`).join("\n"),
    modules_csv: input.modules.join(", "),
    label: input.label,
    persona_name: input.personaName,
    scaffolder_version: "0.1.0",
    scaffolded_date: new Date().toISOString().slice(0, 10),
  };
  return vars;
}

// Placeholders the wizard does NOT fill in — agent fills them during onboarding,
// or they're documentation references (e.g. "{{slots}}" mentioned in prose).
// We pass them through unchanged.
const AGENT_SLOTS = new Set([
  // operator-profile slots — agent fills via onboarding
  "operator_name",
  "operator_role",
  "operator_pronouns",
  "operator_context",
  "operator_telegram_id",
  "organization",
  "organization_short",
  "hierarchy",
  "tasks_list",
  "tone",
  "vocabulary",
  "sensitive_data",
  "sensitive_topics",
  "urgent_rules",
  "defer_rules",
  "delegate_rules",
  "delegate_recipient",
  "delegate_identity",
  "delegate_channel",
  "delegate_timeout",
  "internal_acronyms",
  "timezone",
  "quiet_hours",
  "wedge",
  "morning_brief_time",
  "google_workspace_status",
  "google_account",
  "count_telegram_users",
  // builder slots — set via env var BUILDER_NAME / BUILDER_TELEGRAM_ID at
  // scaffold time when known; otherwise filled by agent during onboarding
  // via a Q like "who set this up for you?"
  "builder_name",
  "builder_telegram_id",
  // install path slots
  "vault_path",
  "vault_path_in_container",
  "date",
  // daily-updated slot
  "today",
  // documentation-reference placeholders that appear in template prose
  "slots",
  "placeholder",
  "name",
  "thing",
  "module-name",
]);

const SLOT_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function renderTemplate(input: string, vars: Record<string, string>): string {
  return input.replace(SLOT_RE, (full, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return vars[name];
    }
    if (AGENT_SLOTS.has(name)) {
      return full; // leave for the agent
    }
    throw new Error(`template references unknown variable '{{${name}}}' (not in vars, not in AGENT_SLOTS)`);
  });
}
