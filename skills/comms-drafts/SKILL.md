---
name: comms-drafts
description: Draft outbound replies and new messages in the operator's voice. NEVER sends in V1 — surfaces a draft for operator approval. Use when the operator says "draft a reply to X", "write Y back about Z", when other skills (scheduling, follow-up-tracking) need an outbound, or when triage flags a delegate-forward.
---

# Stakeholder comms — drafts

Drafts only in V1. Send happens after operator approval, via the destination plugin (email / Slack / etc.).

## When this triggers

- Operator asks: "draft a reply to X", "write Y about Z", "say no nicely to A".
- Other skills request a draft (scheduling proposal, follow-up nudge, delegate-forward, vacation auto-reply).
- Triage flags an item that needs a response — agent drafts proactively but doesn't send.

## Voice rules

- Match the operator's `tone` from `shared/MEMORY.md`.
- Use the operator's `internal_acronyms` correctly.
- Never reveal `sensitive_data` items in drafts.
- Match the original message's register — if they wrote 3 sentences, you write 3 sentences.
- Don't pad. No "Hope this finds you well!" unless the operator's tone is that flavor.
- No "Best regards / Sincerely" unless the operator routinely signs that way.

## Operations

| Op | Behavior |
|---|---|
| `reply(thread, intent)` | Draft a reply to a specific thread, with the operator's stated intent. |
| `new(recipient, intent)` | Draft a new outbound message. |
| `say_no(thread, reason)` | Polite decline. Short. Doesn't apologize twice. |
| `nudge(thread)` | Polite follow-up on a stale thread. |
| `forward(thread, recipient, note)` | Forward with a one-line note. Used by triage's delegate path. |

## Output

Always:

```
Draft to <recipient> (re: <subject>):

> <draft body>

[Approve & send] [Edit] [Cancel]
```

If the operator picks Edit, agent regenerates with their fixes.
If Approve, agent routes through the destination plugin's send.

## Required external creds

- Whichever destination plugin's send capability. Set via `bootstrap-secret`.

## Required vault state

- `tone`, `internal_acronyms`, `sensitive_data` populated in `shared/MEMORY.md`.

## Out of scope

- **Auto-send** without approval. V1 = drafts only. V1.1 may add auto-send for trusted scenarios (e.g., calendar invite acceptance).
- **Translation** — V1 assumes operator and counterparty share a language. V1.1 may add explicit translation.
- **Heavy reformatting** (markdown → branded HTML) — V1 outputs plain text / markdown.
