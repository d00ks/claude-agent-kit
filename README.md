# claude-agent-kit

Interview-driven scaffolder that takes you through ~5 questions and outputs a working personal-agent system on top of Claude Code: a vault-shaped working directory, a persona CLAUDE.md tuned to one of several archetypes, capability-module skills the agent reads at runtime, a heartbeat cron, and a messaging-plugin bot config (Telegram or Slack).

The output is a long-running Claude Code session that runs as the operator's personal agent — answering their messages, draining their inbox, drafting replies, prepping meetings, doing light research, the whole executive-assistant shape — calibrated to **their** preferences over time.

## Why

Personal agents are increasingly viable, but the path from "interesting idea" to "running agent that survives a restart and remembers what your operator told it last week" is a lot of glue. This kit codifies the glue:

- **Vault-as-state** — every operator preference, every triage rule, every memory note lives in a markdown tree the agent reads/writes. Survives session death, machine moves, model swaps. Inspectable by humans.
- **Opt-in capability modules** — pick what the agent does (inbox triage, calendar, scheduling, follow-ups, comms drafts, Google Workspace bridge, etc.). Each module is a `SKILL.md` the agent reads at runtime.
- **Archetype templates** — start from an Executive Assistant or a Financial Advisor template; extend or fork for your shape.
- **Provider-pluggable** — Telegram or Slack out of the box (via the official Anthropic plugins). Swap the messaging surface without rewriting the agent.
- **Boring infra** — launchd plist for persistence, tmux for live debug, Keychain for secrets, plain markdown for memory.

## Quick start

Requires macOS or Linux. The bootstrap script auto-installs missing prereqs (Claude Code CLI, Bun, tmux, optionally `gh` and Obsidian).

```bash
# 1. Clone this repo
git clone https://github.com/d00ks/claude-agent-kit.git
cd claude-agent-kit
bun install

# 2. Generate a vault
bun bin/agent-scaffolder.ts install
#   → walks you through 5 Qs (provider, modules, output dir, label, persona name)

# 3. Bootstrap the vault you just generated
cd <output-dir>
BOOTSTRAP_YES=1 ./bootstrap.sh
#   → auto-installs prereqs, clones the messaging plugin, writes a launchd plist
#   → drops you instructions on the bot-token and OAuth steps next

# 4. Message your bot on Telegram (or Slack) — the agent walks the operator
#    through onboarding from there
```

Non-interactive scaffold (for CI / scripting):

```bash
bun bin/agent-scaffolder.ts install \
  --non-interactive \
  --provider telegram \
  --modules inbox-triage,calendar,scheduling,google-workspace-mcp \
  --out ~/Obsidian/my-agent \
  --label my-agent
```

## Capability modules

Each module is a directory under `skills/` with a `SKILL.md`. The scaffolder copies selected modules into the generated install's `.claude/skills/`. The agent reads them at runtime to know what it can do.

| Module | Description |
|---|---|
| `inbox-triage` | Urgent / defer / delegate routing. Includes vacation-mode toggle. |
| `calendar` | Read, create, move, cancel events. Conflict detection. |
| `scheduling` | Multi-party scheduling with time-zone math. |
| `follow-up-tracking` | Lightweight CRM — last-contact + next-action per relationship. |
| `meeting-prep` | Pre-meeting context bundles 30 min before each meeting. |
| `comms-drafts` | Draft replies in the operator's voice. Drafts only (V1). |
| `light-research` | Web / doc fetch + summarize. |
| `google-workspace` | Gmail / Drive / Sheets / Docs / Calendar via the `gog` CLI. Requires a GCP project. |
| `google-workspace-mcp` | Gmail / Drive / Calendar via Anthropic's hosted MCP. 60-second OAuth, zero GCP setup. Mutually exclusive with `google-workspace`. |

Planned (V1.1): `travel`, `expenses`, `send-on-behalf comms`.

Modules are deliberately atomic. Add your own by dropping a directory with a `SKILL.md` into `skills/`.

## Archetypes

`templates/<archetype>/CLAUDE.md` provides a persona-shaped starting point.

| Archetype | Who it fits |
|---|---|
| `ea` | Executive Assistant. Inbox triage + calendar + scheduling + follow-ups + meeting prep + drafts. Built for busy operators (founders, execs, owner-operators) drowning in low-leverage admin. |
| `financial-advisor` | Read-only financial advisory. Portfolio analysis, market research, position sizing math, comms drafts to advisors/brokers. **Never trades, never moves money.** |

Pick one at scaffold time; the persona CLAUDE.md gets templated into your install. Extend or fork for your own shape.

## Architecture

```
your-vault/
├── CLAUDE.md                    # root instructions for the agent
├── INDEX.md                     # vault map
├── HANDOFF.md                   # operator runbook
├── bootstrap.sh                 # one-shot setup
├── restart.sh                   # kill + relaunch the agent
├── bootstrap-secret             # write secrets to Keychain
├── start.sh                     # generated by bootstrap; launchd uses this
├── personas/
│   └── <persona-name>/
│       ├── CLAUDE.md            # archetype-templated persona instructions
│       ├── inbox/               # tasks others drop for this persona
│       ├── processing/          # in-flight tasks
│       ├── notes/               # archived briefs + design sketches
│       └── memory/YYYY-MM-DD.md # daily log
├── shared/
│   ├── CLAUDE.md                # shared rules across all personas
│   ├── PRIORITIES.md            # active priority stack
│   ├── MASTER-INVENTORY.md      # full project inventory
│   ├── MEMORY.md                # canonical operator preferences (sensitive_topics, urgent_rules, etc.)
│   └── memory/
│       ├── active-tasks.md      # current work
│       ├── lessons.md           # mistakes to not repeat
│       └── feedback.md          # operator corrections
├── projects/                    # operator's own scoped projects
└── .claude/
    ├── skills/<module>/SKILL.md # selected capability modules
    └── plugins/<provider>/      # messaging plugin
```

The agent reads its own state at the start of every session, drains its inbox + processing dirs, runs the appropriate skills, writes its memory log, and re-arms its `/loop` heartbeat. Restart-survivable because state lives on disk.

## How agents adapt over time

The agent treats operator corrections + preferences as first-class data:

- **Memory hygiene** is hard rule #1 — every state change (decision, blocker, pivot, operator feedback) gets logged to `shared/memory/YYYY-MM-DD.md` the same turn.
- **Workflow rules** (triage thresholds, escalation criteria, routing logic, delegate rules, sensitive-topic list) live in `shared/MEMORY.md`. Operator says "don't surface that kind of thing again" → agent edits `shared/MEMORY.md` directly, no human-in-the-loop required.
- **Onboarding** is conversational + iterative. The agent asks the operator about themselves over the first few sessions and fills in `{{placeholders}}` in its own CLAUDE.md as it learns.

Read the generated `HANDOFF.md` for the full operator runbook.

## Status

V1 — usable but rough edges. The kit's been tested as a personal-agent runtime for the author's own stack + as a productized "AI Operator Setup" engagement. Public release is to share the architecture + invite contributors who want a vault-shape pattern for their own agents.

Not a self-serve SaaS. Not a hosted service. A runtime + scaffolder + a small library of modules.

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues + PRs welcome; the bar is "works, ships, has tests where they're meaningful, doesn't regress the boring-infra ethos."

## Security

See [SECURITY.md](SECURITY.md) for the disclosure policy. Found a vulnerability? Don't open a public issue — email per the policy.

## Acknowledgements

Built on top of [Claude Code](https://docs.claude.com/en/docs/agents-and-tools/claude-code/overview) and Anthropic's [official plugins](https://github.com/anthropics/claude-plugins-official). The Google Workspace bridge uses [gogcli](https://github.com/gogcli). The `google-workspace-mcp` module uses Anthropic's hosted connector catalog (Gmail / Drive / Calendar).
