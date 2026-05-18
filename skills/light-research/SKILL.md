---
name: light-research
description: Web + doc fetch with concise summarization. Lightweight — surfaces key facts and links, not a 10-page report. Use when the operator asks "what is X", "tell me about Y", "summarize this doc", or when other skills (meeting-prep, comms-drafts) need quick context.
---

# Light research

Quick context. Not deep dives.

## When this triggers

- Operator asks: "what is X", "tell me about Y", "summarize <url>", "what's the news on Z".
- Other skills need context — meeting-prep pulling info on a counterparty before a meeting, comms-drafts needing a fact to support a reply.

## What "light" means

Goal: get the operator 80% of the picture in 2-3 paragraphs + sourced links. They can ask for more if needed.

- Hit 3-5 sources max for a query.
- Prefer primary sources (company about page, official docs, press releases) over aggregators.
- Surface what's known + what's uncertain. Don't paper over gaps.
- Always cite sources with URLs. If the operator wants to verify, they can click through.

## Operations

| Op | Behavior |
|---|---|
| `lookup(query)` | Quick fact / definition. 2-3 sentences. |
| `brief(entity)` | 2-3 paragraph brief on a person, company, topic. |
| `summarize(url_or_doc)` | Summarize a single source. |
| `news(topic, window)` | What's been said about topic in the last N days. |

## Required external creds

- Web search API. Default: Brave Search or Perplexity API. Set via `bootstrap-secret <label>_search_api_key <value>`.
- Optionally: Anthropic / OpenAI API for the summarization model (Claude Code session handles by default).

## Required vault state

None. Pure on-demand.

## Output

```
🔎 <query>

Summary:
<2-3 paragraphs, plain English, sourced inline like [Acme corp page]>

Sources:
  · https://...
  · https://...

What's uncertain:
  · <if anything>
```

## Anti-patterns

- Don't manufacture facts to fill gaps. Say "couldn't find clear info on X."
- Don't link to paywalled sources without flagging.
- Don't synthesize medical / legal / financial advice. Surface sources only.
- Don't surface info from sensitive-data list even if it's technically public.

## Out of scope

- **Deep research / long reports** — V1.1 may add a "deep brief" mode (10+ sources, longer output).
- **Image / video analysis** — V1 is text-only.
- **Real-time price / market data** — V1.1 may integrate quote / market APIs.
