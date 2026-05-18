---
name: scheduling
description: Schedule meetings between the operator and one or more counterparties. Time-zone aware. Uses the calendar skill to find availability; drafts an outbound proposal the operator approves before sending. Use when someone asks for a meeting, when the operator says "set up a call with X", or when follow-up tracking surfaces a "next action: meet" item.
---

# Meeting scheduling

Orchestrates meeting requests across the operator's calendar and counterparties.

## When this triggers

- Inbound message asks for a meeting / call.
- Operator says: "set up a call with X", "find time with Y next week".
- Follow-up tracking surfaces a "schedule meeting" next-action.

## Flow

1. **Parse the ask** — who, why, when (range), how (in-person / Zoom / call), duration.
2. **Find candidate slots** — via the `calendar` skill, list 3-5 free 30-min (or specified duration) windows in the requested range, in the operator's timezone.
3. **Translate to counterparty timezone(s)** — show the same slots in their TZ too. Avoid the "wait, what time is that for you?" loop.
4. **Draft the outbound proposal** — short, conversational, embedded in a `comms-drafts` skill output. Operator approves before sending.
5. **On acceptance** — call `calendar.create()` with the agreed slot. Send the invite via the calendar provider's native flow.

## Required external creds

- Whatever the `calendar` skill uses.
- For meetings with timezone-distant counterparties, no extra creds — pull TZ data from operator-provided context ("they're in London") or message metadata.

## Required vault state

- Operator's `timezone`.
- Optional: `meeting_defaults` in `shared/MEMORY.md` — default duration (30 min?), default location (Zoom link?), buffer time (15 min before/after?).

## Defaults the agent should apply unless told otherwise

- Duration: 30 minutes
- Location: operator's Zoom personal room (if a Zoom link is in `shared/MEMORY.md`)
- Buffer: skip back-to-back if avoidable
- Don't propose pre-9am or post-6pm operator-local unless the counterparty explicitly asks
- Don't propose Fridays after 3pm operator-local unless asked

## Output

Operator-facing draft:

```
Proposed (your TZ → their TZ):
  Tue May 20  10:00–10:30 → 15:00–15:30 BST
  Wed May 21  14:00–14:30 → 19:00–19:30 BST
  Thu May 22  09:30–10:00 → 14:30–15:00 BST

Draft to send:
> Hey {{name}}, suggesting a few times for a quick call:
> · Tue May 20, 10am ET / 3pm BST
> · Wed May 21, 2pm ET / 7pm BST
> · Thu May 22, 9:30am ET / 2:30pm BST
> Which works? — {{operator_name}}

[Approve & send] [Edit] [Cancel]
```

## Out of scope

- **Auto-sending without approval** in V1 (drafts only). V1.1 may add "auto-confirm for trusted counterparties".
- **Multi-party scheduling with non-shared calendars** (e.g., 5 attendees, none on the operator's calendar service). V1 = operator + 1 or 2 attendees max.
- **Custom availability rules** (e.g., "only Tuesdays" or "after my therapy slot"). Operator drops those in `shared/MEMORY.md` and the agent reads them.
