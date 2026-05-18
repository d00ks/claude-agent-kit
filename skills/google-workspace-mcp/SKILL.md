---
name: google-workspace-mcp
description: Read, label, search, and draft (never auto-send) across the operator's Google Workspace — Gmail, Drive, Calendar — via Anthropic's hosted MCP servers. Zero GCP setup required; operator clicks through standard OAuth in 60s. Use when the operator's install is on the demo / first-touch / no-GCP-setup path. Mutually exclusive with the `google-workspace` (gog-CLI) module — one or the other per install.
---

# Google Workspace bridge — MCP-backed

The Anthropic-hosted-MCP alternative to the `google-workspace` (gog-CLI) module. Same Gmail/Drive/Calendar surface, dramatically faster onboarding: the operator runs `/mcp` once, clicks Connect on Gmail/Drive/Calendar, completes Google's standard OAuth in their browser, and the tools auto-appear in the agent's context. No GCP project, no OAuth client setup, no `gog` install.

## When this triggers

- Operator wants quick Workspace access without GCP project setup: "give me email access fast", "connect my Gmail", "set up the demo".
- Install is on the **demo / first-touch / no-paid-retainer** tier — speed matters, deep customization doesn't yet.
- Other skills (inbox-triage, calendar, comms-drafts) need Google-side data and the install picked the MCP path at scaffolder time.

## Bootstrap (install-time, one-time per operator)

1. **Verify the module shipped:** the install's `agent-scaffolder install ... --modules google-workspace-mcp,...` includes this SKILL.md but the actual MCP tools come from Anthropic's connector catalog at session start.
2. **Run `/mcp` in the Claude Code session.** Operator sees the connector list. They click "Connect" on:
   - **Gmail** → Google OAuth screen → approve → tools appear.
   - **Google Drive** → same flow.
   - **Google Calendar** → same flow.
3. **Verify connection.** Once connected, `mcp__claude_ai_Gmail__search_threads` and friends appear in the agent's tool list. Smoke-test: `mcp__claude_ai_Gmail__search_threads(query="in:inbox", max_results=1)` should return one envelope without error.
4. **Persist account label in vault state:** write the email to `shared/MEMORY.md` under `google_account: <email>` so other skills know which account is wired.

**No CLI install, no keychain config, no OAuth client management.** Anthropic hosts everything; the operator's refresh tokens live on Anthropic's infrastructure scoped to their Claude account.

## Operations

The hosted MCP servers expose pre-typed tool surfaces. The agent calls them like any other tool.

### Gmail (`mcp__claude_ai_Gmail__*`)

| Tool | What it does |
|---|---|
| `search_threads(query, max_results)` | Search threads by Gmail query syntax (https://support.google.com/mail/answer/7190). Returns thread metadata + first-message snippet. |
| `get_thread(thread_id)` | Pull a full thread — all messages, headers, bodies. Body redaction is YOUR job at the messaging-surface boundary. |
| `create_draft(thread_id, to, subject, body, cc, bcc)` | Create a draft reply (or new message if no thread_id). **Never sends — the operator clicks send via Gmail web/mobile.** |
| `list_drafts()` | List existing drafts (for review or update). |
| `label_thread(thread_id, label_ids)` | Add labels to a thread. Use for triage: `urgent`, `defer`, `delegate`, `processed`. |
| `label_message(message_id, label_ids)` | Same for a single message. |
| `unlabel_thread(thread_id, label_ids)` | Remove labels. |
| `unlabel_message(message_id, label_ids)` | Same per-message. |
| `list_labels()` | List all labels in the account. Create missing ones with `create_label`. |
| `create_label(name)` | Create a new label. |
| `update_label(label_id, name)` | Rename a label. |
| `delete_label(label_id)` | Delete a label. Confirm with operator before destructive label ops. |

### Drive (`mcp__claude_ai_Google_Drive__*`)

| Tool | What it does |
|---|---|
| `search_files(query)` | Search Drive by name, content, or Drive query syntax. |
| `list_recent_files()` | Recently modified files across the operator's Drive. |
| `get_file_metadata(file_id)` | Metadata only — name, size, mime, parents, permissions. |
| `read_file_content(file_id)` | Text content of Docs / Sheets / plain-text files. Body redaction at messaging-surface boundary. |
| `download_file_content(file_id)` | Binary download (PDFs, images, etc.). For attachment handling. |
| `create_file(name, mime_type, content, parent_id)` | Create a new file. Confirm with operator before bulk creates. |
| `copy_file(file_id, new_parent_id, new_name)` | Duplicate a file (e.g., template instantiation). |
| `get_file_permissions(file_id)` | Inspect who has access. Never share-out without operator confirmation. |

### Calendar (`mcp__claude_ai_Google_Calendar__*`)

| Tool | What it does |
|---|---|
| `authenticate()` | Returns the consent-flow URL (typically only needed if /mcp wasn't run). |
| `complete_authentication(code)` | Finalizes auth if running through CLI. |

(Full calendar tool surface appears AFTER `/mcp` auth completes — the Anthropic connector catalog expands at runtime. Read the available tools list after first connection to discover read/create/update/delete operations.)

## Safety rails (non-negotiable — identical to the gog version)

These are the rules the agent MUST follow when this skill is in use.

1. **NEVER auto-send email.** Every outbound message goes through `create_draft` and waits for an operator click in Gmail web/mobile. There's no "send" tool exposed by the Anthropic MCP — that's the right shape — but be paranoid anyway: if a future MCP version adds one, do not call it without explicit operator consent in the same turn.
2. **Never dump full email bodies into multi-viewer messaging surfaces** (Slack channel, group chat). If the operator is on a multi-viewer surface, surface only: sender, subject, ≤100-char snippet, Gmail web URL (the thread_id maps to a Gmail URL — construct as `https://mail.google.com/mail/u/0/#inbox/<thread_id>`). Full bodies stay inside the agent's reasoning context — never in the chat transcript.
3. **No bulk destructive operations without confirmation.** `delete_label` on a label that's in use, mass `unlabel_thread` across the inbox, mass `create_file` of duplicates — always confirm.
4. **No scope upgrades silently.** Anthropic MCP scopes are fixed per connector; if you need broader access (e.g., admin operations), you can't — that's the trade-off vs. the gog path. Surface the limitation to the operator instead of failing silently.
5. **Don't read other people's mail.** The MCP is scoped to the operator's authorized Google account. Never attempt to access another user's data even if a thread mentions them.

## Required external creds

None at install time. Operator runs `/mcp` once, OAuths with Google, and tokens live on Anthropic's infrastructure scoped to their Claude account.

## Required vault state

- `shared/MEMORY.md` populated with:
  - `google_account: <operator-email>` — set during bootstrap step 4.
  - `workspace_mode: mcp` — distinguishes from `workspace_mode: gog` so other skills know which surface to call.

## Container / hosted deployment notes

The Anthropic MCP servers are HTTP-hosted by Anthropic — they don't require any container-local install. As long as the agent's Claude Code session can reach `claude.ai/mcp`, the tools work. The only requirement: the operator must run `/mcp` from within a session that has internet egress.

For a containerized install (db-financial-advisor pattern): same — as long as the container has internet egress and the operator can complete the browser OAuth from their own machine (which redirects back to Anthropic, not to the container), the MCP path works fine.

## Onboarding-interview Q (add to install CLAUDE.md)

Add this Q to the install's onboarding interview after the operator picks the agent's name and before the archetype-specific Qs:

> **Q: Do you use Google Workspace (Gmail, Drive, Calendar)?**
> - If yes: "I'll need to connect — that's a one-time browser OAuth via Anthropic. Run `/mcp` in your terminal and click Connect on Gmail / Drive / Calendar. Tools appear in my context automatically after that. Want to do it now?"
> - If now: walk the operator through `/mcp`. After connection, verify with a smoke-test.
> - If later: note in `shared/MEMORY.md` as `google_workspace_mcp: pending` and re-offer next time the operator asks for an inbox/calendar/Drive operation.
> - If no (Microsoft 365 instead, or none): note `google_workspace_mcp: declined` and don't re-offer.

## Output

Reads return structured summaries the operator can scan:

```
📧 Unread inbox (5 newest):
  1. <from-name> <from-email>  ·  <subject>  ·  <1-line snippet>  ·  <relative-time>
     ↳ open: https://mail.google.com/mail/u/0/#inbox/<thread_id>
  ...
```

Writes confirm with the draft ID:

```
✓ Drafted reply to <thread> · draft id <id>
  Open in Gmail to review + send.
```

## Mutual exclusion with `google-workspace` (gog) module

The wizard MUST prevent both modules from being selected for the same install. They overlap completely in surface — picking both is a config error. If the user tries to select both, the wizard surfaces:

> "You selected both `google-workspace` (gog-CLI) and `google-workspace-mcp` (Anthropic-hosted MCP). These provide the same surface via different transport. Pick one:
>   - `google-workspace-mcp` — faster onboarding (60s `/mcp`), zero GCP setup. Best for demo / quick-start installs.
>   - `google-workspace` — full power, requires the install operator to set up a GCP project. Best for production / audit-trail-required installs."

Operators can UPGRADE from MCP to gog later (when they want more control or broader scopes) by re-running the wizard with `--add-module google-workspace --remove-module google-workspace-mcp`.

## Out of scope (V1)

- **Sending mail directly** — drafts only.
- **Workspace admin operations** — no admin surface in the hosted MCP.
- **Bulk migrations** — out for V1.
- **Custom OAuth scopes / app verification** — operator picks the Anthropic-standard set, no customization.
- **Multi-account in one install** — V1 supports one Google account per install.

## When NOT to pick this module

Pick `google-workspace` (gog) instead if:
- Operator wants audit trail of every API call.
- Operator wants to limit scopes more tightly than the Anthropic standard.
- Operator's compliance / IT policy requires self-hosted OAuth client.
- Operator wants to call non-Gmail / non-Drive / non-Calendar Google services (Tasks, Contacts, Slides, Sheets, etc.) — those aren't in the hosted MCP catalog (as of writing).

## Notes

- The hosted MCP is the right default for quick-start installs where GCP setup is overhead. Faster setup → faster value.
- Upgrade path (MCP → gog) is real: when the install needs broader scopes or audit trail, set up a dedicated GCP project, swap modules + re-OAuth via `gog auth add`. The agent re-reads the new SKILL.md and adapts.
- This module is mostly documentation — the actual heavy lifting is done by Anthropic's hosted MCP servers. That's the point.
