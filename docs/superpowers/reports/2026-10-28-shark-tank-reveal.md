# Shark Tank reveal verification

- Implemented sequential team spotlights, cumulative sale reveals, digit reels and damped scale punches, separate wallet/penalty lines, progress strip, skip/replay and a crowned podium with aura, rays and confetti.
- Wallet remains private during gameplay and becomes public at RESULTS/CLOSING. Existing scoring rules are unchanged.
- Test-first checks confirmed missing wallet exposure and ceremony behavior before implementation. Full workspace suite: 507 tests passed. `pnpm typecheck`, `pnpm lint`, `pnpm build` and `git diff --check` passed.
- Chromium: 17 layouts across 1280×720 and 1920×1080, 3/8 teams, long Vietnamese names, introductions/totals/podium and 8 joint winners. Assertions confirmed no page overflow, clipped member names, clipped podium headings or scrolling in the main finale.
- Two additional reduced-motion browser checks confirmed immediate complete details and static reels, including a zero-sales team.
- Independent code review found no correctness issues and identified long-name clipping as a browser concern. Browser testing confirmed and resolved it with responsive member sizing, safe alignment and overflow access. Podium member counts and compact tied steps keep the finale within the screen.
- Behavior tests cover equivalent server snapshots, timer cleanup on stage exit, skip/replay, transaction quantities/prices, negative totals, ties, awards and reduced motion.
- Temporary browser fixture removed. Review screenshots/metrics are in `/tmp/shark-reveal-review`.
- Follow-up: fixed a transient horizontal scrollbar during buyer reveals. Entry used a 16px horizontal translation, and money punches extended another 2–3px beyond the row. Entry now scales within the row, and inline padding reserves space for punches. Browser checks at 1280/1440/1920 widths confirm `scrollWidth === clientWidth` during entry, punch and settled states with two buyer rows. Full tests, typecheck, lint and build passed again.
