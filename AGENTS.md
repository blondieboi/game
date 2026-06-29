# AGENTS.md — Character Workshop

## Project Overview

A static browser-based game where players create a custom character (CSS-based creator), then explore a 3D Three.js world with rolling terrain, collect gems by solving adaptive math/reading challenges, and buy items from a shop. All UI text is in Swedish.

**Tech stack:** Vanilla JS (ES6+), HTML5, CSS3, Three.js r128 (CDN-loaded). **No build step**, no package manager, no bundler. Open `index.html` directly in a browser.

---

## 1. Commands

There is no build system, package manager, or test framework. The only commands are:

- **Run locally:** `python3 -m http.server 8765` (or any static server), then open `http://localhost:8765`. Alternatively open `index.html` directly (JS uses regular `<script>` tags, not ES modules).
- **Verify JS syntax:** `node -c js/<file>.js` for each file.
- **Verify all files:** `for f in js/*.js; do node -c "$f"; done`
- **Check for top-level var conflicts:** `rg "^(const|let|var) \w+ =" js/`
- **No tests exist.** Do not create test infrastructure unless explicitly asked.

---

## 2. Code Style

### 2.1 Module System — Global Scope

Files do **not** use ES modules, CommonJS, or IIFEs. All scripts share a single global namespace via `<script>` tags loaded in order:

```
state.js → save.js → world.js → game.js → creator.js → main.js
```

- Functions are declared with `function name() {}` at the top level (hoisted, accessible across files).
- Shared state lives in `state.js` as `var` declarations (mutable globals).
- Shared DOM queries that multiple files need **must** be declared once in `state.js` using `var`, not duplicated with `const` in individual files. Picking the wrong declaration (`const` in two files) causes a `SyntaxError: Identifier has already been declared` at parse time, breaking the entire script.

### 2.2 Variable Declaration

- **`var`** at top level for shared/global state (e.g., `characterState`, `resources`, `gameUI`, shared DOM refs). This is required because `const`/`let` at the top level of a regular `<script>` collide when the same name is declared in another file.
- **`const`** inside functions for DOM queries, configuration, and values that don't reassign.
- **`let`** inside functions for loop counters and values that reassign.
- Never use `const` or `let` at the top level for a name that might also appear in another file. When in doubt, use `var` at the top level.

### 2.3 Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Functions | camelCase | `startGame()`, `closeMathPanel()` |
| Variables | camelCase | `characterState`, `mathPanel` |
| Constants (truly invariant) | SCREAMING_SNAKE_CASE | `SAVE_KEY`, `MOUSE_SENSITIVITY` |
| CSS class names | kebab-case | `".step-dots"`, `".new-character-btn"` |
| File names | kebab-case | `world.js`, `styles.css` |
| HTML IDs | kebab-case | `"game-canvas"`, `"pause-quit"` |
| Three.js objects | camelCase | `skinMat`, `headGeom`, `badgeMesh` |

### 2.4 Functions

- Use `function name() {}` declarations for anything that needs to be hoisted or called across files.
- Use `const name = () => {}` for short inline callbacks and event handlers.
- Prefer named functions over anonymous ones for readability.

### 2.5 Formatting

- 2-space indentation.
- Semicolons required.
- Single quotes for strings in JS (`'hello'`), double quotes in HTML.
- No trailing whitespace.
- One blank line between function/block definitions.
- Opening braces on same line: `function foo() {`

### 2.6 Imports

No import/export system exists. All external code is loaded via CDN `<script>` tag (Three.js → `window.THREE`). Do not add any import/export syntax; the game must remain loadable from `file://` protocol.

### 2.7 Error Handling

- Use try/catch for operations that can fail (e.g., `JSON.parse`, `localStorage` access).
- Prefer bare `catch {}` or `catch (e) {}` (silent) for non-critical failures like save errors. The user should not see error toasts for recoverable issues.
- Use guard clauses (`if (!x) return;`) at the top of functions to validate preconditions.
- Do not throw custom errors.
- Do not `.catch()` promises (there are no promises in this codebase).

### 2.8 DOM Interaction

- Query elements once at the top of each file using `document.querySelector()` / `document.querySelectorAll()`.
- If multiple files need the same DOM element reference, declare it in `state.js` as `var`.
- Use `element.hidden = true/false` for show/hide (not class toggling).
- Use `[hidden]` attribute selector in CSS.
- Avoid creating DOM elements via strings (`innerHTML += ...`). Use `document.createElement()` + `.textContent` / `.appendChild()` for dynamic content.

### 2.9 Three.js Conventions

- Engine version is pinned to r128 (`https://unpkg.com/three@0.128.0/build/three.min.js`). Do not change without explicit request.
- Use native/procedural Three.js geometry for player character avatars; do not reintroduce external avatar model loading without explicit request.
- Use `MeshToonMaterial` with a `gradientMap` (4-step grayscale) for player character avatar parts.
- Use `MeshStandardMaterial` for environment/world objects (trees, buildings, terrain).
- Helper functions (`sphere()`, `box()`, `ellipsoid()`, `limb()`) abstract common geometry creation. Use them when possible.
- The player avatar (`createAvatar()`) returns a `THREE.Group` with `userData.leftArm`, `.rightArm`, `.leftLeg`, `.rightLeg` for animation.
- Terrain height is centralized through `getTerrainHeight(x, z)`. Any placed world object, decoration, collectible, or player movement update that depends on ground contact should use this helper instead of hard-coded `y = 0`.
- World bounds and terrain size live in `state.js` (`WORLD_SIZE`, `WORLD_LIMIT`, `WORLD_EDGE_START`) and should be changed there rather than scattering numeric limits.
- Game loop uses `renderer.setAnimationLoop(callback)`. Limit delta via `Math.min(delta, 0.05)` to prevent physics spiral of death.

### 2.10 HTML & CSS

- No CSS preprocessors. Plain CSS in `styles.css` (~2200 lines, single file).
- CSS custom properties for theming (`--skin`, `--hair`, `--shirt`, etc.) — used by the character creator's class-based toggle system.
- Responsive breakpoints at 52rem and 29rem.
- `[hidden]` attribute for show/hide (not `.hidden` class).
- Use `aria-label`, `aria-hidden`, `role="status"` for accessibility.
- Keep the glass/backdrop-filter aesthetic consistent for game overlays.

### 2.11 State Management

State is stored in global mutable objects in `state.js`:

- `characterState` — current character customization options
- `resources` — `{ emeralds: number, diamonds: number }`
- `ownedBrainrots` — `Set` of owned brainrot item names
- `learningProgress` — adaptive math/reading progress by character, with levels and recent results
- `gameUI` — `{ nearStore, shopOpen, inventoryOpen, gamePaused, lockTransition, pointerLocked }`

Persist via `saveGame()` / `loadGame()` in `save.js` (uses `localStorage` with key from `SAVE_KEY`).

### 2.12 Language

All user-facing UI text is **Swedish**. Labels, button text, placeholder text, reading questions, shop item names — all Swedish. Code identifiers, comments, and commit messages are in English.

### 2.13 Conventions to Avoid

- Do **not** add ES module syntax (`import`/`export`). The game loads from `file://` protocol where CORS blocks modules.
- Do **not** add a build step, package.json, or npm dependencies unless explicitly requested.
- Do **not** add TypeScript, JSX, or any transpiled language.
- Do **not** create test infrastructure unless asked.
- Do **not** commit secrets, API keys, or credentials to the repo.
- Do **not** use emojis in code or commit messages unless the user explicitly requests them.

### 2.14 Agent Configuration

See `.opencode/skills/frontend-design/SKILL.md` for frontend design philosophy guidance when building new UI. Key principles: ground designs in the subject matter, make deliberate typography/layout choices that avoid template defaults, and take one aesthetic risk that can be justified.
