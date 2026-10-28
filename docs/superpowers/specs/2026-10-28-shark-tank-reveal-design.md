# Shark Tank final reveal

Implement the requested Balatro-inspired ceremony in the existing React projector. Keep the current palette, fonts, game rules and host controls. Use the existing Motion dependency and CSS; no image assets or additional packages are needed.

The ceremony starts with a short suspense title, then spotlights one team at a time in ascending final-score order. Introduce team identity, product and all member names; reveal revenue, individual buyer quantities and amounts; reveal money remaining, spending shortfall and no-question penalties; finish with the actual total. Money remaining is informational: only the existing shortfall and no-question penalties reduce the total. Completed teams remain in a compact progress strip without exposing later teams.

Numbers roll upward through individual clipped digit reels with staggered stops and a spring punch. Team titles and score impacts also have spring motion. Finish with a podium, all winning teams crowned, team-colored aura, rotating gold rays and one confetti burst. Preserve Best Startup and Best Buyer awards. Tied totals share competition ranks, including joint winners. Show remaining placements below the podium. Support zero sales, zero/negative totals, long names and a full classroom.

Use an automatic staged timeline with local skip-to-podium and replay controls. Reduced motion shows the final podium and complete detailed results immediately, with no spinning, spring movement or confetti. Announce meaningful stages rather than every animated digit.

After browser verification, the podium uses member counts to keep its champions visible on 720p screens. Full member names remain in each spotlight and the complete score breakdown. Tied teams share a step side by side; large ties use a compact layout.

Approaches considered: extending the current accumulating grid is small but cannot give each team the requested drama; a single spotlight followed by the podium provides readable transaction detail and suspense without shrinking every team card. The latter is the implementation choice derived from the request. A public wallet value is needed only after RESULTS, and remains hidden during play.
