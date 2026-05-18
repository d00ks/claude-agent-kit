---
name: follow-up-tracking
description: Lightweight CRM. Tracks last-contact date and next-action per relationship. Surfaces stale follow-ups proactively. Use when the operator asks "who haven't I talked to in a while", when an inbound message comes from a tracked person, or on a weekly sweep to keep the relationship state fresh.
---

# Follow-up tracking

Lightweight relationship CRM. NOT a full Salesforce — just enough to keep the operator from dropping balls.

## When this triggers

- Operator asks: "who haven't I followed up with", "what's pending with X", "did Y ever get back".
- Inbound message from a tracked person → agent surfaces context ("last spoke 3 weeks ago about Z").
- Weekly heartbeat sweep → surface anything overdue based on the next-action date.

## Data shape

Stored at `shared/follow-ups.md` (markdown table, easy to edit by hand):

```
| Name | Org | Last contact | Next action | Due | Notes |
|------|-----|--------------|-------------|-----|-------|
| Jane Doe | Acme | 2026-05-10 | Send pricing pdf | 2026-05-17 | Cold from intro. Interested in tier 2. |
```

## Operations

| Op | Behavior |
|---|---|
| `add(name, org, next_action, due, notes)` | Add a new tracked relationship. |
| `update(name, last_contact?, next_action?, due?, notes?)` | Update fields. `last_contact` auto-updates on inbound/outbound. |
| `due_within(window)` | List follow-ups due within a window (today / this week / overdue). |
| `find(query)` | Look up by name fragment / org. |

## Auto-update from messaging

On inbound or outbound message to/from a tracked person, agent updates `last_contact` automatically. Operator does NOT need to mark it manually.

## Required vault state

None beyond `shared/follow-ups.md` (created on first use).

## Required external creds

None — pure vault state. Tracks people across whatever messaging surface the agent already has access to.

## Output

Weekly sweep:

```
📌 Follow-ups this week:

OVERDUE (2):
  Jane Doe (Acme)        · pricing pdf · was due Fri
  Bob Smith (Beta Co)    · intro warmup · was due 5/14

DUE THIS WEEK (3):
  Carol Lee (Gamma)      · Q2 demo · due Tue
  Dan Kim (Delta)        · contract redline · due Wed
  Eve Park (Epsilon)     · NDA · due Thu

NO ACTION OWED:
  (12 people tracked, last contact within window, no pending action)
```

## Out of scope

- **Pulling activity from external CRM** (HubSpot, Salesforce). V1.1 if a client has one.
- **Sentiment / health scoring.** Just timing + state.
- **Sending the follow-up** — that's `comms-drafts` job. This skill just surfaces what's owed.
