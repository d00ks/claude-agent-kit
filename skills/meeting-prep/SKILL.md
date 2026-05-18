---
name: meeting-prep
description: Lightweight pre-meeting brief — bundles recent comms, relationship state, and agenda before a meeting. Triggered automatically the morning of (or hour before) a calendar event, or on demand. Use when the operator asks "what's the X meeting about", "remind me where I left off with Y", or as a proactive surface ahead of scheduled events.
---

# Meeting prep + briefs

Lightweight, not a full research dossier. Goal: the operator walks into the meeting knowing who, what, where they left off.

## When this triggers

- 30 min before any calendar event (configurable per operator).
- Morning sweep — bundle today's meetings into one daily brief.
- Operator asks: "what's the call with X about", "remind me about Y".

## Brief structure (per meeting)

```
📅 <event title> · <time> · <location>

Attendees: <names + roles>

Last time you spoke:
  · 2026-05-10 — they asked about Z, you said you'd send tier-2 pricing.

Pending from `follow-up-tracking`:
  · Send pricing pdf (due Fri 5/17 — overdue)

Recent comms (last 14d):
  · 5/14 — they emailed about NDA
  · 5/10 — you replied with tier matrix

Agenda (if shared in invite or thread):
  · Q2 plans
  · Pricing confirmation
  · Next-step timing

Suggested questions:
  · Did they get the NDA signed?
  · Confirm tier 2 vs tier 3 fit?
```

## Operations

| Op | Behavior |
|---|---|
| `brief(event_id_or_name)` | Generate the brief for a single meeting. |
| `today()` | Generate briefs for every meeting today. Single message. |
| `next_hour()` | Same, scoped to the next 60 min. |

## Data sources

- `calendar` skill for event + attendees + time.
- `follow-up-tracking` for relationship state.
- Messaging plugin for recent comms (Gmail thread, Slack DMs).
- `shared/follow-ups.md` for "last topic discussed" context.

## Required external creds

- Whatever `calendar` + the messaging plugin use.
- Optionally: notes / docs read access if operator wants the agent to pull from a shared workspace doc tied to the meeting.

## Required vault state

- `shared/follow-ups.md` (auto-created by `follow-up-tracking`).
- `meeting_prep_lead_time` in `shared/MEMORY.md` — minutes before the meeting to surface the brief. Default: 30.

## Out of scope

- **Deep research** — go to `light-research` skill for "tell me everything about Acme."
- **Auto-drafting agenda items** — agenda comes from invite / thread, not invented.
- **Recording / transcripts** — V1.1+ if a client wants meeting capture.
