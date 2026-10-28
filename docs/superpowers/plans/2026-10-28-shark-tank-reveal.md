# Shark Tank reveal implementation

Spec: `docs/superpowers/specs/2026-10-28-shark-tank-reveal-design.md`.

Implement directly in the current workspace; no new dependencies, commits, publishing or game-rule changes.

1. Expose remaining wallet at RESULTS/CLOSING while preserving earlier privacy. Add a boundary test across roles and stages, observe failure, implement and verify.
2. Replace the old projector results grid with a dedicated ceremony component: deterministic timeline, upward digit reels and spring punch, team/member introduction, buyer-by-buyer sales, remaining wallet and actual penalties, score finish, completed-team progress, skip/replay and final podium. Update the existing behavioral results tests for the new pacing and add tests covering details, ties, controls and motion preferences before implementation.
3. Style and visually verify at 1280×720 and 1920×1080, including larger classes and long names. Run the full tests, typecheck, lint and production build; review the final diff.

Review focus: never show later scores early; never subtract the full wallet as a penalty; preserve negative formatting and zero values; display every buyer and member; support tied winners and empty results; timers must clean up and not restart when equivalent server snapshots arrive; reduced motion must bypass all animated phases.

Completed all three steps. Verification and browser findings are recorded in `docs/superpowers/reports/2026-10-28-shark-tank-reveal.md`.
