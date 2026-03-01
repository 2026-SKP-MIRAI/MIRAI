# OMC HUD API Key Scope Indicator — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional HUD element that shows whether the active `ANTHROPIC_API_KEY` comes from the project config, global config, or environment variable.

**Architecture:** New independent element file following the established OMC HUD pattern. Reads config files to determine key scope, renders a short colored label (`key:proj` / `key:global` / `key:env`) next to the model name. Default off for backward compatibility.

**Tech Stack:** TypeScript, Vitest (tests), Node.js `fs` + `os` (config file reading)

**Repo:** `~/sharedfolder/oh-my-claudecode` (fork of `Yeachan-Heo/oh-my-claudecode`)

---

### Task 1: Setup branch

**Files:**
- Repo: `~/sharedfolder/oh-my-claudecode`

**Step 1: Enter repo and create feature branch**

```bash
cd ~/sharedfolder/oh-my-claudecode
git checkout -b feat/hud-apikey-scope
```

**Step 2: Install dependencies**

```bash
npm install
```

Expected: packages installed, no errors.

**Step 3: Run existing tests to verify green baseline**

```bash
npm test -- --run
```

Expected: all tests pass.

**Step 4: Commit (empty, just to mark branch start)**

```bash
git commit --allow-empty -m "chore: start feat/hud-apikey-scope branch"
```

---

### Task 2: Write failing tests for `renderApiKeyScope`

**Files:**
- Create: `src/__tests__/hud/apikey.test.ts`

**Step 1: Create test file**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock os.homedir
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

// Import AFTER mocking
const { renderApiKeyScope, getApiKeyScope } = await import('../../hud/elements/apikey.js');

const MOCK_KEY = 'sk-ant-api03-testkey123';

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = MOCK_KEY;
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(readFileSync).mockReturnValue('{}');
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  vi.clearAllMocks();
});

describe('getApiKeyScope', () => {
  it('returns null when ANTHROPIC_API_KEY is not set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(getApiKeyScope('/some/cwd')).toBeNull();
  });

  it('returns "project" when key matches settings.local.json', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('settings.local.json')
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ env: { ANTHROPIC_API_KEY: MOCK_KEY } })
    );
    expect(getApiKeyScope('/some/cwd')).toBe('project');
  });

  it('returns "project" when key matches settings.json', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('settings.json') && !String(p).includes('local')
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ env: { ANTHROPIC_API_KEY: MOCK_KEY } })
    );
    expect(getApiKeyScope('/some/cwd')).toBe('project');
  });

  it('returns "global" when key matches ~/.claude/settings.json', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('/home/testuser/.claude/settings.json')
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ env: { ANTHROPIC_API_KEY: MOCK_KEY } })
    );
    expect(getApiKeyScope('/some/cwd')).toBe('global');
  });

  it('returns "env" when key is set but not in any config file', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(getApiKeyScope('/some/cwd')).toBe('env');
  });

  it('returns "project" (local) over "global" when both match', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ env: { ANTHROPIC_API_KEY: MOCK_KEY } })
    );
    expect(getApiKeyScope('/some/cwd')).toBe('project');
  });
});

describe('renderApiKeyScope', () => {
  it('returns null when no key is set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(renderApiKeyScope('/some/cwd')).toBeNull();
  });

  it('renders "key:proj" for project scope', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('settings.local.json')
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ env: { ANTHROPIC_API_KEY: MOCK_KEY } })
    );
    const result = renderApiKeyScope('/some/cwd');
    expect(result).not.toBeNull();
    expect(result).toContain('key:proj');
  });

  it('renders "key:global" for global scope', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('/home/testuser/.claude/settings.json')
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ env: { ANTHROPIC_API_KEY: MOCK_KEY } })
    );
    const result = renderApiKeyScope('/some/cwd');
    expect(result).not.toBeNull();
    expect(result).toContain('key:global');
  });

  it('renders "key:env" for env scope', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const result = renderApiKeyScope('/some/cwd');
    expect(result).not.toBeNull();
    expect(result).toContain('key:env');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --run src/__tests__/hud/apikey.test.ts
```

Expected: FAIL with "Cannot find module '../../hud/elements/apikey.js'"

**Step 3: Commit test file**

```bash
git add src/__tests__/hud/apikey.test.ts
git commit -m "test: add failing tests for renderApiKeyScope"
```

---

### Task 3: Implement `src/hud/elements/apikey.ts`

**Files:**
- Create: `src/hud/elements/apikey.ts`

**Step 1: Create implementation file**

```typescript
/**
 * OMC HUD - API Key Scope Element
 *
 * Renders the source scope of the active ANTHROPIC_API_KEY.
 * Shows "key:proj", "key:global", or "key:env" — never the key value itself.
 */

import { cyan, yellow, gray } from '../colors.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

type ApiKeyScope = 'project' | 'global' | 'env';

function readKeyFromConfig(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf8');
    const cfg = JSON.parse(content);
    return cfg?.env?.ANTHROPIC_API_KEY ?? null;
  } catch {
    return null;
  }
}

/**
 * Determine the source scope of the active ANTHROPIC_API_KEY.
 * Returns null if no key is set in the environment.
 */
export function getApiKeyScope(cwd: string): ApiKeyScope | null {
  const current = process.env.ANTHROPIC_API_KEY;
  if (!current) return null;

  // 1. Project-local: .claude/settings.local.json
  const localConfig = join(cwd, '.claude', 'settings.local.json');
  if (readKeyFromConfig(localConfig) === current) return 'project';

  // 2. Project-shared: .claude/settings.json
  const projectConfig = join(cwd, '.claude', 'settings.json');
  if (readKeyFromConfig(projectConfig) === current) return 'project';

  // 3. Global: ~/.claude/settings.json
  const globalConfig = join(homedir(), '.claude', 'settings.json');
  if (readKeyFromConfig(globalConfig) === current) return 'global';

  // 4. Environment variable only
  return 'env';
}

/**
 * Render API key scope element.
 */
export function renderApiKeyScope(cwd: string): string | null {
  const scope = getApiKeyScope(cwd);
  if (!scope) return null;

  switch (scope) {
    case 'project': return cyan('key:proj');
    case 'global':  return yellow('key:global');
    case 'env':     return gray('key:env');
  }
}
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- --run src/__tests__/hud/apikey.test.ts
```

Expected: all tests PASS.

**Step 3: Commit**

```bash
git add src/hud/elements/apikey.ts
git commit -m "feat: add renderApiKeyScope element"
```

---

### Task 4: Export from `elements/index.ts`

**Files:**
- Modify: `src/hud/elements/index.ts`

**Step 1: Add export line** (after the `renderModel` export line)

```typescript
export { renderApiKeyScope, getApiKeyScope } from './apikey.js';
```

**Step 2: Run all tests**

```bash
npm test -- --run
```

Expected: all pass.

**Step 3: Commit**

```bash
git add src/hud/elements/index.ts
git commit -m "feat: export renderApiKeyScope from elements index"
```

---

### Task 5: Add `apiKeyScope` to types

**Files:**
- Modify: `src/hud/types.ts`

**Step 1: Add field to `HudElementConfig` interface** (after the `modelFormat` line, around line 284)

```typescript
apiKeyScope: boolean;  // Show API key source (project/global/env)
```

**Step 2: Add default to `DEFAULT_HUD_CONFIG`** (after `modelFormat: 'short'` line)

```typescript
apiKeyScope: false,   // Disabled by default for backward compatibility
```

**Step 3: Add to every preset in `PRESET_CONFIGS`**

For ALL presets (`minimal`, `analytics`, `focused`, `full`, `opencode`, `dense`), add:
```typescript
apiKeyScope: false,
```

Exception: in the `full` preset, set `apiKeyScope: true` (full preset shows everything).

**Step 4: Update defaults test** — add to `src/__tests__/hud/defaults.test.ts`:

```typescript
it('should have apiKeyScope disabled by default for backward compatibility', () => {
  expect(DEFAULT_HUD_CONFIG.elements.apiKeyScope).toBe(false);
});
```

**Step 5: Run all tests**

```bash
npm test -- --run
```

Expected: all pass (TypeScript will catch missing fields in presets).

**Step 6: Commit**

```bash
git add src/hud/types.ts src/__tests__/hud/defaults.test.ts
git commit -m "feat: add apiKeyScope field to HudElementConfig and defaults"
```

---

### Task 6: Wire into `render.ts`

**Files:**
- Modify: `src/hud/render.ts`

**Step 1: Add import** (after the `renderModel` import line ~line 24)

```typescript
import { renderApiKeyScope } from './elements/apikey.js';
```

**Step 2: Add rendering block** — after the model element block (~line 175):

```typescript
// API key scope
if (enabledElements.apiKeyScope) {
  const apiKeyElement = renderApiKeyScope(context.cwd);
  if (apiKeyElement) gitElements.push(apiKeyElement);
}
```

**Step 3: Run all tests**

```bash
npm test -- --run
```

Expected: all pass.

**Step 4: Build to catch TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/hud/render.ts
git commit -m "feat: wire apiKeyScope element into HUD render pipeline"
```

---

### Task 7: Manual local test

**Step 1: Build**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds.

**Step 2: Test with echo**

```bash
echo '{"transcript_path":"/tmp/test","cwd":"'$(pwd)'","model":{"id":"claude-sonnet-4-6","display_name":"Sonnet"},"context_window":{"context_window_size":200000}}' | node dist/hud/index.js
```

Expected: HUD output includes `key:proj` (since we're in the OMC repo which may have a settings file, or `key:env` if not).

---

### Task 8: Push and open PR

**Step 1: Push branch**

```bash
git push -u origin feat/hud-apikey-scope
```

**Step 2: Open PR via GitHub CLI**

```bash
gh pr create \
  --repo Yeachan-Heo/oh-my-claudecode \
  --head BbChip0103:feat/hud-apikey-scope \
  --base main \
  --title "feat(hud): add API key scope indicator element" \
  --body "$(cat <<'EOF'
## Summary

Adds an optional HUD element that displays the source scope of the active `ANTHROPIC_API_KEY`:

- `key:proj` (cyan) — key comes from `.claude/settings.local.json` or `.claude/settings.json`
- `key:global` (yellow) — key comes from `~/.claude/settings.json`
- `key:env` (gray) — key is set as a plain environment variable

The element appears next to the model name and is **disabled by default** for backward compatibility. Enable via HUD config: `apiKeyScope: true`.

The actual key value is never displayed — only the scope label.

Closes #1146

## Changes

- `src/hud/elements/apikey.ts` — new element with `getApiKeyScope()` + `renderApiKeyScope()`
- `src/hud/elements/index.ts` — export
- `src/hud/types.ts` — `HudElementConfig.apiKeyScope` field + defaults
- `src/hud/render.ts` — wired after model element
- `src/__tests__/hud/apikey.test.ts` — full test coverage

## Test

```bash
npm test -- --run
```
EOF
)"
```

Expected: PR URL printed.
