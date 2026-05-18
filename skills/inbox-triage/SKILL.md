---
name: inbox-triage
description: Triage the operator's inbox into urgent / defer / delegate buckets. Folds in the vacation-triage feature (toggle on/off, urgent → escalate, defer → auto-reply, delegate → forward to delegate with timeout re-escalation). Use when the operator asks "what's in my inbox", "is anything urgent", "deal with my email", or when the agent needs to surface critical incoming items.
---

# Inbox triage

Sort incoming messages into three buckets so the operator only sees what needs them.

## When this triggers

- Operator asks: "what's in my inbox", "anything urgent", "triage my email", "while I'm away…"
- Vacation mode toggled on — agent actively triages incoming items and acts.
- Scheduled sweep (cron / heartbeat) — agent surveys inbox and surfaces tier-1 items.

## Buckets

| Bucket | Definition | Agent action |
|---|---|---|
| **Urgent** | Revenue-impacting, customer escalation, press, legal, supplier outage, fraud/chargeback, family emergency, or anything matching the operator's `urgent_rules` in `shared/MEMORY.md` | Escalate to operator via messaging plugin. No auto-action. |
| **Defer** | Normal correspondence, can wait for normal inbox check. Matches `defer_rules`. | If vacation mode: auto-reply with "currently away, will respond after X" (no return date — toggle-based). Queue for operator's return. |
| **Delegate** | Matches `delegate_rules`. Has a clear recipient in `delegate_recipient`. | Forward to delegate (DM via messaging plugin OR email with `[DELEGATED]` subject tag — per operator config). Track timeout: if not actioned within `delegate_timeout`, re-escalate to operator. |

## Required vault state

- `shared/MEMORY.md` populated with:
  - `urgent_rules` (operator's definition)
  - `defer_rules` (default: everything not urgent or delegate-able)
  - `delegate_rules` + `delegate_recipient` + `delegate_timeout`
  - `sensitive_data` (never include in auto-replies or delegate forwards)

If any of those slots are still `{{placeholder}}`, ask the operator during onboarding before acting. Don't guess.

## Required external creds

- Email read access (Gmail OAuth / Workspace IMAP / O365). Set via `bootstrap-secret <label>_gmail_oauth_token <value>`.
- Optionally: Slack / messaging access for delegate-forwards if not using email.

## Output

When triaging on demand, return a structured summary:

```
🟠 Urgent (N):
  - <from> · <subject> · <one-line why>
🟡 Defer (N):
  - <from> · <subject>
🟢 Delegate (N) → <recipient>:
  - <from> · <subject>
```

When acting automatically (vacation mode), write a daily summary to `shared/memory/YYYY-MM-DD.md`:
- urgent items (with `[escalated to <operator>]` tag)
- defer items count (`auto-replied: N`)
- delegate items count + recipient (`forwarded to <recipient>: N`)

## Out of scope

- **Sending on the operator's behalf** beyond auto-replies and delegate forwards (V1 = drafts only for new outbound).
- **Inferring rules** the operator hasn't stated — ask, don't guess.
- **Reading attachments** — V1 surfaces them but doesn't open binary content.

## Notes

This module folds in the "vacation triage" feature from the original design. Toggle the whole module on/off via operator message: "vacation mode on" / "vacation mode off". Toggle is NOT date-bound — operator says when it starts and ends.
