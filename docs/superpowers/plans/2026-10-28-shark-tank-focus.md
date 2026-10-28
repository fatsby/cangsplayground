# Shark Tank Focus Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this small visual change inline.

**Goal:** Apply the selected 03 · Focus projector composition to Shark Tank presentations.

**Architecture:** Keep the existing projector component, live data and shared display chrome. Place the team badge beside the stage label, use an unframed product hero, and place all presenters in a strip below it. Apply the same composition to PITCH and QA.

**Tech Stack:** React, TypeScript, existing Arcade Night CSS tokens.

**Spec:** User selected `docs/designs/shark-tank-pitch.html#focus` on 2026-10-28.

## Global Constraints

- Keep the app's existing fonts, colors, team badges, timers and shared projector chrome.
- Preserve pause, expiry, discount, automatic-price and reduced-motion behavior.
- Do not change game logic, player screens, host controls or other game stages.
- Work in the current workspace; this is a reversible visual change.

## Review Focus

- Product names and descriptions may be longer than the sample.
- Groups may contain more than five members, including long Vietnamese names.
- Both 1280×720 and 1920×1080 displays must retain the full presentation.
- Paused and expired timer labels must remain visible.
- Discounted and automatic prices must retain their annotations.

## Task 1: Apply Focus and verify

**Files:**

- Modify: `packages/games/shark-tank/src/views/projector.tsx`
- Modify: `packages/games/shark-tank/src/views/shark-tank.css`

- [x] Put the presenting team badge next to the stage label for PITCH/QA; group product text into a copy region.
- [x] Replace the two-column presentation layout with a flexible hero and bottom presenter strip, using existing style tokens.
- [x] Run existing Shark Tank projector/player tests, typecheck and build. No new implementation-mirroring tests for this visual change.
- [x] Use a temporary browser fixture to check both presentation stages, long content, member counts, discounts, pause/expiry and projector sizes; remove the fixture afterward.
- [x] Review the diff and record validation results.

## Validation

- Existing projector/player checks: 100 passed.
- Full workspace suite: 498 passed.
- `pnpm typecheck` passed.
- Browser checks: 12 combinations across 1280×720, 1440×900 and 1920×1080; Pitch/Q&A, reduced price, automatic price, paused/expired timers, 5/7/12 members and long names/product copy. No page overflow or product/presenter overlap.
- Product typography uses the available hero height so longer content and taller presenter strips fit.
- Temporary browser fixtures removed; production diff reviewed.
