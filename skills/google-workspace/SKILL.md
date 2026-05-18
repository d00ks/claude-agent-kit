---
name: google-workspace
description: Read, label, search, and draft (never auto-send) across the operator's Google Workspace — Gmail, Drive, Sheets, Docs, Calendar — by shelling out to the `gog` CLI. Use when the operator wants their agent to access Google services: email triage, draft replies, search a Drive folder, append a row to a Sheet, read a Doc, list upcoming calendar events. Underpins the inbox-triage / calendar / scheduling / comms-drafts skills for any operator on Google.
---

# Google Workspace bridge

The Google-side bridge for everything the agent does in the operator's Google account. `gog` (gogcli) is the single binary that handles OAuth, refresh tokens, and the full Google API surface — Gmail, Drive, Sheets, Docs, Calendar, Tasks, Contacts, Slides, Forms, Keep, YouTube, plus admin surfaces. This skill teaches the agent how to detect, install, authorize, and call `gog` safely.

## When this triggers

- Operator wants to set up Gmail / Drive / Calendar / Sheets access: "give me email access", "connect my Google account", "set up Workspace".
- Other skills need Google-side data: inbox-triage searches Gmail, calendar reads events, comms-drafts writes Gmail drafts, light-research pulls a Drive doc.
- Agent's onboarding interview asks the Google-access Q and operator says yes.

## Bootstrap (install-time, one-time per operator)

Run during onboarding when the operator agrees to Workspace access:

1. **Detect `gog`:** `command -v gog`. If absent, install:
   - **macOS (Homebrew):** `brew install gogcli/tap/gog` (single static binary, no Python deps).
   - **Linux:** download the static binary release from the gogcli GitHub releases page and drop into `/usr/local/bin/gog`.
   - **Container installs:** add to Dockerfile — see "Container bootstrap" below.
2. **OAuth credentials (one-time setup, then shared across installs):**
   - `gog auth credentials` reads/writes the OAuth client ID + secret used for the consent flow. The install operator registers a single OAuth client in GCP Console (https://console.cloud.google.com → APIs & Services → Credentials → OAuth client ID → "Desktop app") and reuses its `client.json` across installs.
   - Each install per operator pulls that client; the operator's own Google account does the consent flow against it.
3. **Authorize the operator's account:** `gog auth add <operator-google-email>`. This opens the default browser, runs Google's OAuth consent screen, prompts the operator to approve the requested scopes (Gmail readonly + modify + compose, Drive readonly, Sheets read/write, Calendar read/write — let `gog auth services` print the default scope list at install time so the operator sees what they're approving), and writes the refresh token to the OS keyring.
4. **Verify:** `gog auth list` (should show the email) and `gog --account=<email> gmail search "in:inbox" --max 1 --json` (should return one message envelope without error).
5. **Persist account label in vault state:** write the email to `shared/MEMORY.md` under `google_account: <email>` so other skills know which account to pass via `--account`.

If `gog auth doctor` flags any issue (keyring locked, refresh token expired, scope mismatch), walk the operator through the fix it prints — don't paper over auth errors with retries.

## Operations

All commands shell out to `gog` with `--json` (or `--results-only` for clean payloads) so the agent can parse cleanly. Always pass `--account=<operator-email>` unless the install pins a single account.

### Gmail

| Operation | Command | Notes |
|---|---|---|
| List unread | `gog gmail search "is:unread" --max 20 --json` | Use Gmail query syntax (https://support.google.com/mail/answer/7190). |
| List by query | `gog gmail search "<query>" --max <n> --json` | e.g. `from:client@x.com is:unread`. |
| Get one message | `gog gmail get <messageId> --json` | Full body. Truncate before surfacing — see safety rails. |
| Get metadata only | `gog gmail get <messageId> --format metadata --json` | Headers only, no body. Prefer this for triage. |
| Label add | `gog gmail messages modify <messageId> --add-labels=<labelName> --json` | Use for triage (`urgent`, `defer`, `delegate`, `processed`). Create labels with `gog gmail labels create <name>` if missing. |
| Label remove | `gog gmail messages modify <messageId> --remove-labels=<labelName> --json` | |
| Archive | `gog gmail archive <messageId>` | Removes from inbox; doesn't delete. |
| Mark read | `gog gmail mark-read <messageId>` | |
| Trash | `gog gmail trash <messageId>` | Confirm with operator first unless rule says auto-trash. |
| Draft reply | `gog gmail drafts create --thread=<threadId> --to=... --subject=... --body=...` | NEVER send. Agent surfaces the draft ID + summary to the operator; operator clicks send via Gmail web/mobile. |
| Forward (HITL) | `gog gmail forward --to=<addr> <messageId>` | Only on operator confirmation — this DOES send. Pair with explicit user click on the messaging surface. |

### Drive

| Operation | Command |
|---|---|
| List recent | `gog drive ls --max 20 --json` |
| Search | `gog drive search "<query>" --json` |
| Get metadata | `gog drive get <fileId> --json` |
| Download text content | `gog drive get <fileId> --download --json` (or the equivalent — verify with `gog drive get --help`) |

### Sheets (shared pattern with hunt.py)

| Operation | Command |
|---|---|
| Read range | `gog sheets get <spreadsheetId> --range="<A1>" --json` |
| Append rows | `gog sheets append <spreadsheetId> --range="<A1>" --values='<json>'` |
| Update cells | `gog sheets update <spreadsheetId> --range="<A1>" --values='<json>'` |

### Docs

| Operation | Command |
|---|---|
| Read doc | `gog docs get <docId> --json` |
| Append text | `gog docs append <docId> --text="..."` (verify command name with `gog docs --help`) |

### Calendar

The `calendar` skill is the operator-facing surface; this skill provides the `gog` plumbing. The calendar skill should call:

| Operation | Command |
|---|---|
| List today's events | `gog calendar events list --time-min=<rfc3339> --time-max=<rfc3339> --json` |
| Create event | `gog calendar events create --summary=... --start=... --end=... --json` |
| Move/update event | `gog calendar events update <eventId> --start=... --end=...` |
| Cancel event | `gog calendar events delete <eventId>` |

## Safety rails (non-negotiable)

These are the rules the agent MUST follow when this skill is in use.

1. **NEVER auto-send email.** Every outbound message goes through `drafts create` and waits for an operator click. The only command that sends — `gog gmail send` — is forbidden unless the operator triggers it interactively in this same turn. Add the `--gmail-no-send` flag to every `gog` invocation as defense-in-depth; that flag at the CLI level blocks send operations even if the agent calls one by mistake.
2. **Never dump full email bodies into the messaging surface (Slack, Telegram).** If the operator is on a multi-viewer surface (Slack channel, group chat), surface only: sender, subject, 1-line snippet (≤100 chars), Gmail web URL via `gog gmail url <threadId>`. Full bodies stay inside the agent's reasoning context — never in the chat transcript.
3. **No `gog auth remove` without explicit operator confirmation.** Revoking auth orphans every Google operation; never do it as cleanup.
4. **No scope upgrades silently.** If a new feature needs a broader scope than the install was authorized with, `gog` will fail loudly — surface the error to the operator and re-run `gog auth add` so they re-consent.
5. **No bulk destructive operations without confirmation.** `gog gmail batch trash` on >5 messages, `gog drive` deletes, `gog sheets` clear — always confirm before executing.
6. **Token never leaves the keyring.** The refresh token lives in the OS keyring (Keychain on macOS, Secret Service on Linux). Agent never reads it, never writes it to files, never echoes it.

## Required external creds

- OAuth client (registered once by the install operator): `gog auth credentials` configures this. A single `client.json` can be reused across all scaffolder installs of the same template.
- Operator's Google account: authorized via `gog auth add <email>`. Refresh token stored in keyring.

## Required vault state

- `shared/MEMORY.md` populated with:
  - `google_account: <operator-email>` — set during bootstrap step 5.
  - Optional `google_account_alias: <short-name>` if `gog auth alias` was configured.

## Container bootstrap

When the install runs inside a container (db-financial-advisor pattern), `gog` and the OAuth flow need extra plumbing:

1. Install `gog` in the Dockerfile:
   ```dockerfile
   # macOS host, Apple Silicon container — use the static linux binary
   RUN curl -L -o /usr/local/bin/gog https://github.com/<gogcli-repo>/releases/latest/download/gog-linux-arm64 \
       && chmod +x /usr/local/bin/gog
   ```
   (Verify the exact release URL at build time; if the project doesn't publish prebuilt linux binaries, install Go and `go install` it, or use a multi-stage build.)
2. The OS keyring inside a Linux container doesn't have a native macOS Keychain. Two options:
   - **File-backed keyring** (simplest for V1): set `--keyring=file` and let `gog` write tokens to a file inside `/vault/.gog/` (which lives on the bind mount and survives container rebuilds).
   - **Pass-through to host keyring** via a mounted socket: not portable; skip for V1.
3. OAuth's localhost-callback flow needs the operator's browser to redirect to `http://localhost:<port>`. If the container can't bind to the host's loopback, use `gog`'s out-of-band flow (operator copies a code from the browser into the terminal) — check `gog auth add --help` for the OOB flag.

## Onboarding-interview Q (add to install CLAUDE.md)

Add this Q to the install's onboarding interview after the operator picks the agent's name and before the archetype-specific Qs:

> **Q: Do you use Google Workspace (Gmail, Drive, Calendar, Sheets)?**
> - If yes: "I'll need to set up access — that's a one-time browser OAuth approval. Want me to walk you through it now or later?"
> - If now: run the bootstrap flow above.
> - If later: note it in `shared/MEMORY.md` as `google_workspace: pending` and re-offer next time the operator asks for an inbox/calendar/Drive operation.
> - If no (Microsoft 365 instead, or none): note `google_workspace: declined` and don't re-offer.

## Output

Reads return structured summaries the operator can scan:

```
📧 Unread inbox (5 newest):
  1. <from-name> <from-email>  ·  <subject>  ·  <1-line snippet>  ·  <relative-time>
     ↳ open: <gog gmail url>
  ...
```

Writes confirm with the operation ID:

```
✓ Drafted reply to <thread> · draft id <id>
  Open in Gmail to review + send: <url>
```

Errors surface verbatim from `gog` — don't swallow or paraphrase:

```
✗ gog auth error: refresh token expired for <email>
  Run: gog auth add <email>
```

## Out of scope (V1)

- **Sending mail directly** — drafts only. Send flips on in V1.1 with a confirmed HITL pattern.
- **Workspace admin operations** (`gog admin`) — domain admin surface is out for V1; the agent is operator-personal, not workspace-admin.
- **Bulk migrations** (Gmail-to-Gmail, Drive folder moves) — out for V1.
- **Tracking opens / read receipts** (`gog gmail track`) — out for V1 (privacy-sensitive, requires operator consent).
- **YouTube / Ads / Analytics / Search Console** surfaces — `gog` supports them but they're irrelevant to the EA archetype's wedge. Add to V1.1 if the operator needs them.

## Notes

- `gog` is a single static binary distributed via Homebrew tap and direct GitHub releases. No Python, no node, no other runtime deps. That makes it the right primitive for client installs.
- `gog`'s `--account` flag picks which authorized account to use when multiple are stored. With one account per install (V1), this is set once in the vault state and reused.
- `gog auth doctor` is your first stop when anything Google fails. It's verbose but accurate.
- The `--gmail-no-send` flag should be wrapped into a shell alias at install time so the agent never accidentally sends. Add to the install's `bin/gog-safe`:
  ```sh
  #!/usr/bin/env sh
  exec /usr/local/bin/gog --gmail-no-send "$@"
  ```
  Then the install's CLAUDE.md instructs the agent to call `gog-safe` instead of `gog`. Operator can still call `gog` directly for the rare send case.
