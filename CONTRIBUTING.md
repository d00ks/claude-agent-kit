# Contributing

Thanks for thinking about contributing. A few guidelines so PRs land cleanly.

## Before you open a PR

- **Skim the architecture in [README.md](README.md).** The kit is opinionated: vault-as-state, opt-in capability modules, archetype templates, provider-pluggable messaging. PRs that fight those primitives need a strong reason.
- **Open an issue first** for non-trivial changes (new capability modules, new archetypes, breaking API changes, schema changes). Lets us align before you sink time.
- **For typos, doc fixes, small bugs:** just send the PR.

## Branch / commit conventions

- Branch off `main`. Name the branch descriptively (`feat/zapier-module`, `fix/bootstrap-bun-path`, `docs/readme-typo`).
- One logical change per commit. Squashing is fine if the final commits read cleanly.
- Commit messages: imperative present tense, one-line summary + body explaining the *why* if it's not obvious.

## What's in scope vs. out of scope

**In scope:**
- New capability modules (drop a directory with `SKILL.md` into `skills/`)
- New archetype templates (under `templates/<archetype>/`)
- New messaging providers (alongside Telegram + Slack)
- Bug fixes in the scaffolder, bootstrap, restart scripts
- Documentation improvements
- Tests for any of the above

**Out of scope (for now):**
- Hosted / SaaS variants of the kit
- Major rewrites of the vault layout
- Cross-LLM abstraction layers (the kit is Claude-Code-flavored on purpose; other runtimes are welcome as separate projects)

## Module contribution checklist

If you're adding a new capability module:

1. Create `skills/<module-name>/SKILL.md` following the existing pattern (frontmatter with `name` + `description`, sections for triggers / operations / safety rails / vault state / output / out-of-scope).
2. Register it in `src/modules.ts` with a one-line description.
3. If it conflicts with another module (e.g. both expose the same surface via different transport), add to the `MUTUALLY_EXCLUSIVE` list.
4. Update the README's module table.
5. Add a section to the relevant archetype's CLAUDE.md mentioning the module if it's relevant.

## Testing

The kit is a scaffolder, so the primary "test" is generating a vault and inspecting the output:

```bash
rm -rf /tmp/scaffold-test
bun bin/agent-scaffolder.ts install \
  --non-interactive \
  --provider telegram \
  --modules <your-new-module>,inbox-triage \
  --out /tmp/scaffold-test \
  --label test
# Then inspect /tmp/scaffold-test for correctness.
```

If your change affects the rendered templates, generate a vault before + after and diff the output.

For Bash scripts (`bootstrap.sh.tmpl`, `restart.sh.tmpl`): run `shellcheck` if you have it, and verify idempotency (running twice is a no-op).

## Tone

- Direct, technical, terse. Brevity is a feature.
- No emoji-spam in code. Emojis in user-facing output are fine sparingly.
- Don't add comments that just restate what the code does. Comments are for the WHY.
- Don't add features for hypothetical future use. The kit gets used; ship what's needed when it's needed.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [LICENSE](LICENSE)).
