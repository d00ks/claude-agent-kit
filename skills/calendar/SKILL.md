---
name: calendar
description: Read, create, move, and cancel calendar events for the operator. Detect conflicts before confirming. Use when the operator asks about availability, wants to add or move an event, asks "what's on my calendar today/this week", or when scheduling needs a calendar slot.
---

# Calendar management

Owns the operator's calendar surface — read state, write changes, surface conflicts.

## When this triggers

- Operator asks: "what's on my calendar", "am I free at X", "schedule something with Y", "move my Z meeting".
- Other modules (scheduling, meeting-prep, follow-up-tracking) call into this skill to read availability or write events.

## Operations

| Operation | Behavior |
|---|---|
| `read(range)` | List events in a time range. Default: today. |
| `available(slot)` | Yes/no + conflicts if any. |
| `create(event)` | Add a new event. Check conflicts first; surface them before committing. |
| `move(event, slot)` | Reschedule. Confirm with operator before propagating if attendees > self. |
| `cancel(event)` | Cancel. Confirm with operator if attendees > self. |

## Required external creds

- Google Calendar OAuth (default for most operators): `bootstrap-secret <label>_gcal_oauth_token <value>`
- O365 / Outlook: `bootstrap-secret <label>_o365_oauth_token <value>`

The agent picks the provider based on what's available in Keychain. Both? Operator's primary first.

## Required vault state

- `timezone` — agent uses operator's TZ for all reads/writes. Falls back to system TZ if unset.

## Conflict-detection rule

Before confirming a `create` or `move`, scan the target window. If any existing event overlaps:
- Surface the conflict to the operator: "you've got X at <time>, want me to move it / move the new one / leave both"
- Don't autoresolve. Conflicts go back to the operator unless the operator's explicit rule says otherwise.

## Output

- Reads return a structured list:
  ```
  Today (Mon May 16):
    09:00–10:00  Team standup
    13:00–14:30  Client review (Acme) · @ Zoom
  ```
- Writes confirm: "✓ Added <event> · <time>" or "✗ Conflict with <other event>; what do you want?"

## Out of scope

- **Sending invites on the operator's behalf** beyond what the calendar provider handles natively.
- **Cross-account merging** (e.g., personal + work calendars). V1 = one calendar account per install.
- **Recurring-event editing** beyond create/cancel-series. V1.1 adds modify-occurrence.
