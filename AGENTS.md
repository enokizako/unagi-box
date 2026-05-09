# Coding Rules

This file is for AI coding agents such as Codex, Claude, and Copilot. Follow these rules when changing this repository.

## Project

- Project name: `unagi-box`.
- Runtime target: Cosense UserScript.
- Source language: TypeScript.
- Build output: `dist/script.js` generated from `src/main.ts` by esbuild.
- Persistence model: the current Cosense page body is the database.

## Commands

- Run `npm run check` after TypeScript changes.
- Run `npm run build` after source changes that affect the userscript.
- Keep `dist/script.js` in sync with `src` unless the user explicitly asks not to build.

## Cosense API Policy

- Prefer the public UserScript Page Edit API for writes:
  - `cosense.Page.insertLine(text, index)`
  - `cosense.Page.updateLine(text, index)`
  - `cosense.Page.waitForSave()`
- Do not use private REST endpoints, CSRF tokens, cookies, internal React state, webpack internals, or DOM hacking to edit page content.
- `scrapbox.PageMenu.addMenu`, `scrapbox.Page.lines`, and `scrapbox.on("page:changed", ...)` are acceptable UserScript APIs in this project.
- Keep Cosense/Scrapbox global type definitions in `src/types/cosense.d.ts`.

## Data Format

- Board sections are plain Cosense lines in this order:
  - `Focus`
  - ` Energy: Low|Mid|High`
  - focus task line or ` No doing task`
  - `Inbox`
  - inbox task lines
  - `Archive`
  - archived task lines
- Task lines are one-line records:
  - ` task title | p:1 | e:2 | v:1 | c:2026-04-27`
  - ` 👣task title | p:1 | e:2 | v:1 | c:2026-04-27`
  - ` ✅task title | p:1 | e:2 | v:1 | c:2026-04-27`
  - ` 👑task title | score:25.0 | p:1 | e:2 | v:1`
- New tasks should be saved as plain text titles, not bracketed titles.
- Existing manually bracketed titles such as `[task title]` must parse correctly and preserve brackets when the task is updated.
- Keep parsing and formatting centralized in `src/tasks.ts`.
- Keep task domain types in `src/types/task.ts`.

## Behavior Rules

- `👑` marks the current top candidate in `Inbox`; it does not mean the task is in progress.
- Starting the pomodoro promotes the current top candidate to doing.
- Doing tasks appear in `Focus` and are also marked with `👣` in `Inbox`.
- Completing a doing task moves it to `Archive` as `✅` and removes the matching `Inbox` line.
- Do not create `Focus`, `Inbox`, or `Archive` automatically on page load. Only create them via the create-board UI.
- While Cosense writes are in progress, block other mutating UI actions.

## Architecture

- `src/main.ts`: application orchestration and event wiring only.
- `src/board.ts`: Cosense board operations and task movement rules.
- `src/cosense.ts`: thin wrapper around Cosense page APIs.
- `src/tasks.ts`: task parsing, formatting, scoring, date helpers.
- `src/pomodoro.ts`: timer state machine.
- `src/alarm.ts`: alarm sound, flash, and title blink.
- `src/panel-view.ts`: DOM construction and UI state updates.
- `src/ui.ts`: small UI rendering helpers.
- `src/styles.ts`: injected CSS.
- Avoid moving business rules into UI files.
- Avoid direct Cosense writes outside `board.ts` and `cosense.ts`.

## UI Rules

- The panel is draggable and attached to the Cosense page.
- Keep low-frequency actions collapsed:
  - Timer Settings
  - Add Task
  - Pick Any Task
- Main controls should stay visually prominent:
  - timer display
  - start/stop
  - pause/reset
  - complete doing
- Timer phase should be indicated by color and status text, not large phase labels.
- Preserve the existing visual direction unless the user explicitly asks for redesign.

## Code Style

- Use strict TypeScript.
- Prefer small focused modules over growing `main.ts`.
- Keep exported types explicit.
- Use `type` imports for type-only dependencies.
- Avoid introducing runtime dependencies unless necessary.
- Keep comments rare and useful.
- Preserve user data first; do not normalize or rewrite unrelated task lines.

## Safety

- Do not use destructive git commands unless explicitly requested.
- Do not remove manually edited Cosense content unless the task operation specifically requires moving or updating that line.
- When changing line movement logic, account for index shifts caused by insert/update operations.
