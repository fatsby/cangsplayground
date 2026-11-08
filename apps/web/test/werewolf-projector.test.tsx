// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Role } from "@cangsplayground/game-werewolf";
import views from "@cangsplayground/game-werewolf/views";
import { ids, props, wwView } from "./werewolf-fixture";

const Screen = views.ProjectorScreen!;
type View = Parameters<typeof wwView>[0];
const html = (over: View = {}, now = 0) => {
  const p = props(wwView(over), "projector");
  p.serverNow = () => now;
  const el = document.createElement("div");
  el.innerHTML = renderToStaticMarkup(<Screen {...p} />);
  return el;
};
const ROLE_WORDS = /Werewolf|Villager|Seer|Guard/;

it("registers a projector screen", () => {
  expect(views.ProjectorScreen).toBeDefined();
});

it("waits quietly while the game is being set up", () => {
  expect(html({ stage: "SETUP", deadlineAt: null }).textContent).toContain(
    "The village is getting ready",
  );
  expect(html({ stage: "REVEAL" }).textContent).toContain("Look at your phone");
});

it("night shows only public information: the night number, the timer and sleeping portraits", () => {
  const el = html();
  const text = el.textContent!;
  expect(text).toContain("Night 1");
  expect(text).toContain("The village sleeps");
  expect(text).toContain("0:30");
  for (const name of ["Ada", "Bo", "Cy", "Dee", "Eve", "Fay"]) expect(text).toContain(name);
  expect(text).not.toMatch(ROLE_WORDS);
  expect(el.querySelectorAll(".pt.sleep")).toHaveLength(6);
});

it("night counts down the last five seconds with a large numeral and a darkening moon", () => {
  expect(html({ deadlineAt: 3_000 }).querySelector(".cd .num")?.textContent).toBe("3");
  const el = html({ deadlineAt: 5_000 });
  expect(el.querySelector(".cd .num")?.textContent).toBe("5");
  expect(el.querySelector(".sc-night")?.hasAttribute("data-cd")).toBe(true);
  expect(html({ deadlineAt: 20_000 }).querySelector(".cd .num")).toBeNull();
});

it("a dawn kill names the victim, never their role", () => {
  const el = html({
    stage: "DAWN",
    dawn: { eliminatedId: "p3" },
    players: ids.map((id) => ({ id, alive: id !== "p3" })),
  });
  const text = el.textContent!;
  expect(text).toContain("CY WAS KILLED");
  expect(text).toContain("The werewolves struck in the night.");
  expect(text).not.toMatch(ROLE_WORDS);
  expect(el.querySelector(".pt.victim")).not.toBeNull();
});

it("a quiet dawn is one animation that never explains why nobody died", () => {
  const text = html({ stage: "DAWN", dawn: { eliminatedId: null } }).textContent!;
  expect(text).toContain("NO ONE DIED");
  expect(text).toContain("Everyone survived the night.");
  expect(text).not.toMatch(/protect|guard|shield|saved/i);
});

it("discussion shows the day, the timer and the living players", () => {
  const text = html({ stage: "DISCUSSION", deadlineAt: 160_000 }).textContent!;
  expect(text).toContain("Day 1 · Discussion");
  expect(text).toContain("2:40");
  expect(text).toContain("Fay");
});

it("the vote shows totals against the threshold and who has reached it, never who voted", () => {
  const el = html({
    stage: "VOTE",
    deadlineAt: 40_000,
    needed: 3,
    voteCounts: { p3: 3, p4: 1 },
  });
  expect(el.textContent).toContain("Needed to banish");
  const cy = el.querySelector('.vcol[data-n="p3"]')!;
  expect(cy.classList.contains("reached")).toBe(true);
  expect(cy.querySelectorAll(".slot")).toHaveLength(3);
  expect(cy.querySelectorAll(".slot.on")).toHaveLength(3);
  expect(cy.textContent).toContain("3 / 3");
  const dee = el.querySelector('.vcol[data-n="p4"]')!;
  expect(dee.classList.contains("reached")).toBe(false);
  expect(dee.querySelectorAll(".slot.on")).toHaveLength(1);
  expect(el.innerHTML).not.toMatch(/voter|voted for/i);
});

it("the verdict names the banished player and the totals, or says nobody was banished", () => {
  const banished = html({
    stage: "VERDICT",
    players: ids.map((id) => ({ id, alive: id !== "p3" })),
    lastVote: { eliminatedId: "p3", counts: { p3: 3 } },
  }).textContent!;
  expect(banished).toContain("CY IS BANISHED");
  expect(banished).toContain("3 of 6 votes");
  expect(banished).toContain("Their role stays hidden until the game ends.");
  expect(banished).not.toMatch(ROLE_WORDS);
  const nobody = html({
    stage: "VERDICT",
    lastVote: { eliminatedId: null, counts: { p3: 2, p4: 2 } },
  }).textContent!;
  expect(nobody).toContain("NO ONE IS BANISHED");
});

it("the end reveals every role and the winner", () => {
  const roles: Record<string, Role> = {
    p1: "werewolf",
    p2: "werewolf",
    p3: "seer",
    p4: "guard",
    p5: "villager",
    p6: "villager",
  };
  const wolves = html({ stage: "ENDED", deadlineAt: null, winner: "wolves", roles });
  expect(wolves.textContent).toContain("THE WOLVES WIN");
  for (const word of ["Werewolf", "Seer", "Guard", "Villager"])
    expect(wolves.textContent).toContain(word);
  expect(wolves.querySelectorAll(".fc")).toHaveLength(6);
  const village = html({ stage: "ENDED", deadlineAt: null, winner: "village", roles });
  expect(village.textContent).toContain("THE VILLAGE WINS");
  expect(village.querySelectorAll(".fc.win")).toHaveLength(4);
});
