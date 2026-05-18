#!/usr/bin/env bash
# install.sh — one-shot installer for claude-agent-kit.
#
# Usage from a fresh machine:
#
#   curl -fsSL https://raw.githubusercontent.com/d00ks/claude-agent-kit/main/install.sh | bash -s -- [flags]
#
# Or with env vars (cloning a fork / private repo, pre-seeding builder vars):
#
#   REPO=owner/repo \
#     curl -fsSL https://raw.githubusercontent.com/d00ks/claude-agent-kit/main/install.sh | bash -s -- --bootstrap
#
# What it does:
#   1. Verify (auto-install) git + bun.
#   2. Clone $REPO into $DEST (default: ~/.claude-agent-kit). Updates if already present.
#   3. `bun install` to fetch scaffolder deps.
#   4. Run `bun bin/agent-scaffolder.ts install <flags-passed-through>`.
#
# Env knobs:
#   REPO=<owner/repo>          which kit to clone (default: d00ks/claude-agent-kit)
#   DEST=<path>                where to clone (default: ~/.claude-agent-kit)
#   BUILDER_NAME=<name>        passed through to scaffolder for managed-service installs
#   BUILDER_TELEGRAM_ID=<id>   passed through to scaffolder for managed-service installs
#   BOOTSTRAP_YES=1            auto-yes for bootstrap.sh prompts (default 1 in this installer)
#
# Flags after `--` get passed verbatim to the scaffolder (e.g. --bootstrap --managed
# --provider telegram --modules ... --out ... --label ...).

set -euo pipefail

# When invoked via `curl URL | bash`, stdin is the piped script, so `read`
# prompts won't see the user's keystrokes. Re-attach to the controlling
# terminal if one exists + is openable. Standard idiom for curl-pipe-bash
# installers that need interactive input. Silently no-ops if there's no
# usable tty (CI runners, sandboxes, etc.) — the mode prompt is skipped
# in that case.
TTY_AVAILABLE=0
if [ -t 0 ]; then
  TTY_AVAILABLE=1
elif [ -e /dev/tty ] && (exec 0</dev/tty) 2>/dev/null; then
  exec 0</dev/tty
  TTY_AVAILABLE=1
fi

REPO="${REPO:-d00ks/claude-agent-kit}"
DEST="${DEST:-$HOME/.claude-agent-kit}"
UNAME="$(uname)"
export BOOTSTRAP_YES="${BOOTSTRAP_YES:-1}"

# ---------- 0. Mode selection (only if no flags + interactive terminal) ----------
# When the user runs `curl URL | bash` with no flags, ask them what they
# want up front so we don't need env vars or flag noise. Skip this if the
# user already passed any args (they know what they're doing) or stdin
# isn't a real terminal (CI / non-interactive contexts).
EXTRA_FLAGS=()
if [ "$#" -eq 0 ] && [ "$TTY_AVAILABLE" = "1" ]; then
  echo "[install.sh] welcome — let's set up a Claude Code agent."
  echo ""
  echo "Modes:"
  echo "  1) open-source      — clean install of the public kit. Best for self-hosting your own agent."
  echo "  2) managed-service  — for builders running this as a service for someone else."
  echo "                        Includes SSH + Tailscale overlay + builder identity baked into the agent."
  echo ""
  printf "Pick a mode [1/2, default 1]: "
  read -r MODE_ANS
  MODE_ANS="${MODE_ANS:-1}"
  case "$MODE_ANS" in
    2|managed|managed-service)
      echo ""
      printf "Repo slug for the managed-service variant (default: jarvbot/agent-scaffolder): "
      read -r REPO_ANS
      REPO="${REPO_ANS:-jarvbot/agent-scaffolder}"
      echo ""
      printf "Your name (you, the builder — shown in the agent's CLAUDE.md): "
      read -r BUILDER_NAME_ANS
      [ -n "$BUILDER_NAME_ANS" ] && export BUILDER_NAME="$BUILDER_NAME_ANS"
      printf "Your Telegram user ID (numeric, e.g. 1234567890): "
      read -r BUILDER_TG_ANS
      [ -n "$BUILDER_TG_ANS" ] && export BUILDER_TELEGRAM_ID="$BUILDER_TG_ANS"
      EXTRA_FLAGS+=(--bootstrap --managed)
      echo ""
      echo "[install.sh] managed-service mode → REPO=$REPO, BUILDER_NAME=${BUILDER_NAME:-?}, BUILDER_TELEGRAM_ID=${BUILDER_TELEGRAM_ID:-?}"
      ;;
    *)
      EXTRA_FLAGS+=(--bootstrap)
      echo ""
      echo "[install.sh] open-source mode → REPO=$REPO"
      ;;
  esac
  echo ""
fi

say() { echo "[install.sh] $*"; }
die() { echo "[install.sh] ✗ $*" >&2; exit 1; }

prompt_yes() {
  if [ "${INSTALL_YES:-1}" = "1" ]; then return 0; fi
  printf "[install.sh] %s [Y/n] " "$1"
  read -r ans
  case "$ans" in n|N|no|NO) return 1 ;; *) return 0 ;; esac
}

# ---------- 1. git ----------
if ! command -v git >/dev/null 2>&1; then
  say "→ git not found, installing"
  case "$UNAME" in
    Darwin)
      if ! xcode-select -p >/dev/null 2>&1; then
        say "macOS Command Line Tools missing — installing (GUI prompt will appear)"
        xcode-select --install 2>/dev/null || true
        die "Accept the macOS CLT prompt + wait for it to finish, then re-run this installer."
      fi
      # CLT ships git
      ;;
    Linux)
      if command -v apt-get >/dev/null 2>&1; then sudo apt-get update -qq && sudo apt-get install -y git
      elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y git
      elif command -v yum >/dev/null 2>&1; then sudo yum install -y git
      elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --noconfirm git
      else die "no supported package manager (apt/dnf/yum/pacman) — install git manually + re-run"
      fi
      ;;
    *) die "unsupported platform: $UNAME — install git manually + re-run" ;;
  esac
fi
say "✓ git: $(git --version)"

# ---------- 2. bun ----------
if ! command -v bun >/dev/null 2>&1; then
  say "→ bun not found, installing via official installer"
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  if ! command -v bun >/dev/null 2>&1; then
    die "bun install completed but binary still not in PATH — open a new shell + re-run, or 'source ~/.bashrc'/'source ~/.zshrc'"
  fi
fi
say "✓ bun: $(bun --version)"

# ---------- 3. clone or update the kit ----------
if [ -d "$DEST/.git" ]; then
  say "→ updating existing clone at $DEST"
  ( cd "$DEST" && git fetch origin && git reset --hard origin/main )
else
  say "→ cloning $REPO into $DEST"
  # Prefer gh repo clone (handles private repo auth) when gh is authed.
  # Falls back to HTTPS git clone for public repos.
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    gh repo clone "$REPO" "$DEST"
  else
    git clone "https://github.com/$REPO.git" "$DEST" || die "git clone failed — if '$REPO' is private, install gh + run 'gh auth login' first, then re-run."
  fi
fi
say "✓ kit at $DEST"

# ---------- 4. fetch scaffolder deps ----------
say "→ bun install (scaffolder deps)"
( cd "$DEST" && bun install --silent )
say "✓ scaffolder deps installed"

# ---------- 5. run the scaffolder with whatever flags came after `--` ----------
say "→ running scaffolder"
echo ""
cd "$DEST"
exec bun bin/agent-scaffolder.ts install "${EXTRA_FLAGS[@]:-}" "$@"
