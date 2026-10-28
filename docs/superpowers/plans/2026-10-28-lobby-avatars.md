# Lobby and minigame avatars Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Students customize Big Smile Pastel Wall avatars before game selection, and circular saved avatars appear throughout the lobby and minigames.

**Architecture:** Store validated avatar options in server player records and public player summaries. Render locally through a shared UI component, and send only saved options through the existing socket protocol. A dedicated editor owns unsaved drafts.

**Tech Stack:** TypeScript, React, Zod, Socket.IO, DiceBear core 10.7.0 / styles 10.6.0, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-lobby-avatars-design.md`

## Global Constraints

- Five backgrounds: `ffe3ea`, `e3edff`, `e2f5e9`, `fdf1d4`, `efe6ff`.
- Editing only when `view.game === null`; server enforces the same rule.
- All previews and display avatars are circular. Preserve full player names and hidden information.
- Browser rendering imports only Big Smile. Player static JavaScript stays under 200 KB gzip.
- English UI copy; existing in-memory persistence only.

## Review Focus

- Save racing with game selection must fail without changing the saved avatar.
- A socket cannot change another student's avatar or publish an arbitrary URL/SVG.
- Reconnecting and regrouping preserve saved appearance.
- Legacy fixtures without avatar options still render a deterministic default.
- Long names and dense mobile rosters retain readable names without horizontal overflow.

### Task 1: Validated options and server updates

**Files:** create `packages/core/src/avatar.ts`; modify core exports/types/events, server Lobby, broadcast and session handlers; extend `apps/server/test/lobby.test.ts` and `integration.test.ts`.

**Interfaces:** `AvatarConfig`, `avatarSchema`, `avatarChoices`; optional `PlayerSummary.avatar`; `Lobby.updateAvatar(playerId, avatar)`; `player:avatar` event accepts `{ avatar }` and returns an undefined ack.

- [x] Add failing tests for saved avatar publication, reconnect preservation, game-selected rejection, and invalid options.
- [x] Run targeted server tests; confirm missing avatar behavior fails.
- [x] Implement allowlisted component/color configuration and player-authenticated updates.
- [x] Run targeted tests and typecheck.

### Task 2: Shared circular avatar and lobby editor

**Files:** create `packages/ui/src/avatar.tsx`, `apps/web/src/components/AvatarEditor.tsx`, and `apps/web/test/avatar-editor.test.tsx`; modify UI exports/styles and Player route.

**Interfaces:** `PlayerAvatar({ playerId, avatar?, size?, className? })`, `PlayerIdentity({ player?, playerId?, size?, className?, children? })`; editor accepts own player summary and saves via `player:avatar`.

- [x] Add failing interaction tests for preview/draft, randomization, Save/Cancel, offline state and closing when game is selected.
- [x] Implement local DiceBear rendering, an accessible mobile editor and player-header integration.
- [x] Run editor tests and confirm rendered avatars have circular clipping and no remote source.

### Task 3: Lobby and minigame placement

**Files:** shared UI components, Display/Player routes, all four games' view components and relevant CSS.

**Interfaces:** use Task 2 identity components and existing player summaries; turn indicators gain optional player summaries while retaining existing string props.

- [x] Add meaningful rendering checks for configured appearance in each minigame, including concealed Spy/Secret Word views.
- [x] Add identity components in rosters, turn indicators, vote choices/tallies and Shark Tank presenter/question/result rows; size for each context.
- [x] Run minigame rendering and interaction tests; check mobile/projector layouts with long names.

### Task 4: Verification and review

- [x] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm --filter @cangsplayground/web size`.
- [x] Inspect mobile lobby editor, vote controls, and projector identity layouts in a browser.
- [x] Review the final diff against privacy, save races, reconnect, bundle budget and accessibility requirements; resolve material findings.

## Execution record

Work runs inline in the existing user workspace. After reviewing the screenshots,
the user explicitly requested a commit and direct push to `master`; no deployment requested.

- Baseline: 507 tests passed before implementation.
- Protocol/domain: missing avatar behavior reproduced, then server tests passed;
  real socket coverage verifies authorization, broadcast to all viewers, resume,
  and rejection after game selection.
- Editor and minigames: preview/draft, Save/Cancel, offline/pending/error states,
  game-selection closure, saved colors, and concealed game information verified.
  Plain-HTTP randomization regression reproduced and fixed with the existing
  `getRandomValues` helper.
- Bundle check first exposed a 229.93 KB static dependency graph. Moved only the
  DiceBear renderer to an asynchronous chunk; final static player graph is
  188,670 bytes gzip, with a 42.07 KB optional renderer chunk.
- Fresh independent review identified a renderer download error that unmounted
  the game. Reproduced with a failing test, added a local error boundary and
  smile fallback, then verified the controls still work with the renderer chunk
  deliberately blocked in Chromium. Separate control labels and a compact sticky
  preview also address the review's small-phone observations.
- Final verification: 521 tests passed; workspace typecheck, lint, production
  build, bundle budget and `git diff --check` passed.
- Chromium checks: all four games at 360px phone / 1920px projector widths;
  circular clipping and no horizontal overflow; configured images match on
  player reload, host and projector; preview stays visible at 320×568; editing
  closes on game selection and returns after exit; no uncaught browser errors.
- Integration choice: commit the reviewed avatar changes and push directly to
  `origin/master`, as explicitly requested by the user.
