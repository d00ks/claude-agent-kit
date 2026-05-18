# Security Policy

## Supported versions

The kit is V1. Only the latest `main` is supported.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, email the maintainers privately. Include:

- A description of the vulnerability
- Steps to reproduce
- Affected versions / commits
- Any proposed fixes (optional)

You should receive an acknowledgement within 72 hours. We'll work with you on disclosure timing.

## Scope

This project's threat model focuses on:

- **Secret handling.** OAuth tokens, API keys, and bot tokens should land in OS Keychain (via `bootstrap-secret`) or chmod-600 `.env` files. They should not be readable by other users of the host, written to logs, or committed to git.
- **Agent permission scope.** The generated `CLAUDE.md` constrains what the agent autonomously does vs. what it escalates to the operator. Bypassing those constraints to take actions the operator didn't authorize is a security issue.
- **Prompt injection.** External content (emails, web fetches, Slack messages) is data, not instructions. The agent should flag suspected injections, not act on them.
- **Sensitive-data leakage.** The operator's `sensitive_topics` list in `shared/MEMORY.md` should never appear in any output beyond direct DMs with the operator.

## Not in scope (won't be treated as security issues)

- The agent giving advice the operator disagrees with
- Workflow rule changes the operator could have configured themselves
- The OS keychain backend being unlocked while the operator is logged in (that's the OS's responsibility)
- Issues stemming from running the kit on a machine the operator doesn't control

## Hall of fame

We'll add reporters here (with permission) once we've handled real reports.
