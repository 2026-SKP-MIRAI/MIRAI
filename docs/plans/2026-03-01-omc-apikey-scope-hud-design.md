# OMC HUD API Key Scope Indicator — Design

**Date:** 2026-03-01
**Target repo:** https://github.com/Yeachan-Heo/oh-my-claudecode
**Issue:** #1146

---

## Problem

When working across projects that use different Anthropic API keys, there is no visual
indicator in the OMC HUD showing which key scope is active. Users cannot tell whether
the key in effect comes from the project config, their global config, or a bare
environment variable.

---

## Goal

Add an optional HUD element that displays the source of the active `ANTHROPIC_API_KEY`
as a short label next to the model name:

```
omc │ main │ Sonnet │ key:proj
```

The actual key value is **never** displayed — only the scope label.

---

## Scope Labels

| Source | Label | Color |
|--------|-------|-------|
| `.claude/settings.local.json` (project-local) | `key:proj` | cyan |
| `.claude/settings.json` (project-shared) | `key:proj` | cyan |
| `~/.claude/settings.json` (global) | `key:global` | yellow |
| Environment variable only | `key:env` | gray |
| No key found | _(hidden)_ | — |

---

## Approach

**New independent element** — follows the established OMC HUD pattern (model.ts, git.ts, etc.).

### Files to change

| File | Change |
|------|--------|
| `src/hud/elements/apikey.ts` | **New** — `renderApiKeyScope()` function |
| `src/hud/elements/index.ts` | Add export line |
| `src/hud/types.ts` | Add `apiKeyScope: boolean` to `HudElementConfig`; set `false` in `DEFAULT_HUD_CONFIG` |
| `src/hud/render.ts` | Import + render after `model` element |

### Detection logic (priority order)

1. Read `.claude/settings.local.json` in `cwd` → check `env.ANTHROPIC_API_KEY`
2. Read `.claude/settings.json` in `cwd` → check `env.ANTHROPIC_API_KEY`
3. Read `~/.claude/settings.json` → check `env.ANTHROPIC_API_KEY`
4. Fall back to `env` (key exists in process.env but not in any config file)

Compare each against `process.env.ANTHROPIC_API_KEY`. First match wins.

### Element signature

```ts
export function renderApiKeyScope(cwd: string): string | null
```

Takes `cwd` so it can resolve the project config path correctly (same pattern as `renderCwd`, `renderGitBranch`).

---

## Design Decisions

- **Default off** (`apiKeyScope: false`) — opt-in, non-breaking
- **No key value exposure** — comparison is done in-process, only the scope string is returned
- **Silent failure** — if config files can't be read (permissions, malformed JSON), returns `null` and element is hidden
- **cwd-relative** — uses `cwd` from HUD context, not `process.cwd()`, for correctness in worktree scenarios

---

## Out of Scope

- Per-key hash/fingerprint display
- Key rotation warnings
- Support for `OPENAPI_MCP_HEADERS` authentication variant
