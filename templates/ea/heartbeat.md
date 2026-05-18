# Heartbeat — {{persona_name}}

What you do on every `/loop` tick. Default cadence: every 30 min during {{operator_name}}'s work hours, every 2h outside. Adjust per operator preference from onboarding Q7.

## The check

In order, every tick:

### 1. Re-orient
- Read `personas/{{persona_name}}/CLAUDE.md` (your instructions, may have shifted).
- Read `shared/memory/active-tasks.md` — anything in-flight.
- Read today's `shared/memory/YYYY-MM-DD.md` if it exists.

### 2. Drain `personas/{{persona_name}}/inbox/` (and `processing/` first)
- Three-state file movement: `inbox/file.md` → `mv` to `processing/file.md` → do the work → delete or move to `notes/`.
- If `processing/` is non-empty at session start, those are resumed tasks; finish before draining fresh inbox.

### 3. Inbox sweep (Gmail or whatever's wired)
- Pull unread since last tick: `gog gmail search "is:unread newer_than:1h" --max 50 --json --account={{google_account}}`.
- For each: classify via `urgent_rules` / `defer_rules` / `delegate_rules` from `shared/MEMORY.md`.
- Urgent → flag for surface (step 7). Defer → label `defer` via `gog gmail messages modify`. Delegate → label `delegate` + draft forward to `{{delegate_identity}}`.
- If vacation mode is on, auto-reply to defer/delegate per the rules in `personas/{{persona_name}}/CLAUDE.md` § Vacation mode.

### 4. Calendar check
- Pull events for the next 2 hours: `gog calendar events list --time-min=<now> --time-max=<now+2h> --json --account={{google_account}}`.
- For each event without a prep brief in `data/meetings/`: generate one (last comms with attendees + agenda + relationship state). Surface 30 min before the meeting.
- Conflicts: if a new event landed since last tick that overlaps an existing one, flag for surface.

### 5. Follow-ups
- Check `personas/{{persona_name}}/data/follow-ups.md` for anything due today or overdue.
- "Owes me a reply > 3 days" → draft a polite nudge, queue for {{operator_name}}'s review.
- "I owe X by Y" overdue → flag for surface.

### 6. Memory log
- Anything actioned this tick → today's `shared/memory/YYYY-MM-DD.md` with timestamp.
- Skip if nothing happened — don't pad the log.

### 7. Surface (only when actionable)
- **Silent if nothing meaningful.** Heartbeat noise erodes trust faster than missed updates.
- Otherwise, post a Telegram message to {{operator_name}}. Keep it terse — single line for one item, bullet list for multiple. Format:
  ```
  ☀ Morning · {{date}}
  • 3 urgent emails (Acme contract, BoD intro, legal Q on the NDA)
  • Meeting at 10am: prep brief at personas/{{persona_name}}/data/meetings/...
  • Follow-up overdue: Sarah owes you the deck review (5 days)
  ```

## Cadence preferences (filled during onboarding)

- **Default:** every 30 min during work hours, every 2h outside.
- **Morning brief:** {{morning_brief_time}} — bundle overnight news + today's calendar.
- **Quiet hours:** {{quiet_hours}} — never surface during these unless explicitly urgent.
- **Mute toggle:** if {{operator_name}} says "mute" → set `shared/memory/heartbeat-muted.md` with the toggle date; resume on "unmute".

## What counts as "surface-worthy"

| Signal | Action |
|---|---|
| Urgent email (matches `urgent_rules`) | Surface |
| Meeting in < 30 min without a prep brief | Surface |
| Calendar conflict on a new event | Surface |
| Follow-up overdue > 1 business day | Surface |
| Delegate timeout exceeded | Surface (re-escalate) |
| New events on calendar (non-urgent) | Don't surface — visible in morning brief |
| Routine email (defer-classified) | Don't surface — handled silently |
| Bulk newsletters, promo, automated | Don't surface — auto-archive instead |

## What's specific to {{operator_name}} (filled during onboarding)

- Their wedge: {{wedge}}
- Urgent rules: {{urgent_rules}}
- Delegate identity + channel: {{delegate_identity}} via {{delegate_channel}}
- Sensitive topics (never in surface output): {{sensitive_topics}}
- Their primary calendar: {{google_account}}

## If nothing's actionable

Reply `HEARTBEAT_OK` and stop. Don't post to Telegram. Don't write to memory beyond a timestamp if nothing happened.
