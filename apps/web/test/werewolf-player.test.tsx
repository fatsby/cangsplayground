// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it } from "vitest";
import views from "@cangsplayground/game-werewolf/views";
import { gameViews } from "../src/games/registry";
import { ids, myState, props, wwView } from "./werewolf-fixture";

const Screen = views.PlayerSessionScreen!;
type P = ReturnType<typeof props>;
const markup = (p: P) => {
  const el = document.createElement("div");
  el.innerHTML = renderToStaticMarkup(<Screen {...p} />);
  return el;
};
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function mount(p: P) {
  await act(async () => root.render(<Screen {...p} />));
}
const row = (selector: string, id: string) =>
  container.querySelector<HTMLElement>(`${selector}[data-n="${id}"]`)!;
async function click(el: HTMLElement) {
  await act(async () => el.click());
}
const night = (me = {}, over = {}) => props(wwView({ me: myState(me), ...over }));

it("is registered under the werewolf game id", () => {
  expect(gameViews.werewolf).toBe(views);
});

it("waits for the host while roles are being set up", () => {
  expect(
    markup(props(wwView({ stage: "SETUP", deadlineAt: null, me: myState() }))).textContent,
  ).toContain("Waiting for the host");
});

it("shows the role card with the pack for a werewolf and no pack for a villager", () => {
  const wolf = markup(
    props(wwView({ stage: "REVEAL", me: myState({ role: "werewolf", teammates: ["p2"] }) })),
  ).textContent!;
  expect(wolf).toContain("Werewolf");
  expect(wolf).toContain("Your pack: Bo");
  const villager = markup(props(wwView({ stage: "REVEAL", me: myState() }))).textContent!;
  expect(villager).toContain("Villager");
  expect(villager).not.toContain("Your pack");
});

it("draws every other living player with their avatar, never an initial", () => {
  const html = renderToStaticMarkup(<Screen {...night()} />);
  for (const id of ids.slice(1)) expect(html).toContain(`data-player-id="${id}"`);
  expect(html).toContain("cp-avatar");
});

it("gives every role the same night screen structure", () => {
  const shape = (me: object) => {
    const el = markup(night(me));
    return {
      root: el.querySelector(".screen")!.className,
      title: el.querySelector(".gtitle")!.textContent,
      rows: el.querySelectorAll(".nopt").length,
      panel: el.querySelectorAll("[data-res]").length,
    };
  };
  const villager = shape({});
  expect(shape({ role: "werewolf", teammates: ["p2"] })).toEqual(villager);
  expect(shape({ role: "seer", seerLog: [] })).toEqual(villager);
  expect(shape({ role: "guard", guardSelfUsed: false })).toEqual(villager);
  expect(villager.rows).toBe(6);
});

it("a werewolf sees packmates and the pack's votes, and votes for a non-packmate", async () => {
  const p = night({ role: "werewolf", teammates: ["p2"], wolfVotes: { p2: "p3" } });
  await mount(p);
  expect(row(".nopt", "p2").textContent).toContain("Packmate");
  expect(row(".nopt", "p2").classList.contains("dis")).toBe(true);
  expect(row(".nopt", "p1").classList.contains("dis")).toBe(true);
  expect(row(".nopt", "p3").textContent).toContain("Bo chose");
  await click(row(".nopt", "p2"));
  await click(row(".nopt", "p4"));
  expect(p.act).toHaveBeenCalledTimes(1);
  expect(p.act).toHaveBeenCalledWith({ type: "ww:wolfVote", payload: { targetId: "p4" } });
  expect(row(".nopt", "p4").classList.contains("sel")).toBe(true);
});

it("the seer picks once and then sees only the binary result", async () => {
  const p = night({ role: "seer", seerLog: [] });
  await mount(p);
  await click(row(".nopt", "p3"));
  expect(p.act).toHaveBeenCalledWith({ type: "ww:seerPick", payload: { targetId: "p3" } });
  for (const [isWerewolf, text] of [
    [true, "Werewolf"],
    [false, "Not a werewolf"],
  ] as const) {
    const done = night({
      role: "seer",
      seerLog: [{ night: 1, targetId: "p3", isWerewolf }],
      myNightPick: "p3",
    });
    await mount(done);
    expect(container.querySelector("[data-res]")!.textContent).toContain(text);
    expect(row(".nopt", "p4").classList.contains("dis")).toBe(true);
    await click(row(".nopt", "p4"));
    expect(done.act).not.toHaveBeenCalled();
  }
});

it("the guard may protect themselves once and others any time", async () => {
  const p = night({ role: "guard", guardSelfUsed: false });
  await mount(p);
  expect(row(".nopt", "p1").textContent).toContain("1 left");
  expect(row(".nopt", "p1").classList.contains("dis")).toBe(false);
  await click(row(".nopt", "p1"));
  expect(p.act).toHaveBeenLastCalledWith({ type: "ww:guardPick", payload: { targetId: "p1" } });
  await click(row(".nopt", "p5"));
  expect(p.act).toHaveBeenLastCalledWith({ type: "ww:guardPick", payload: { targetId: "p5" } });
  await mount(night({ role: "guard", guardSelfUsed: true }));
  expect(row(".nopt", "p1").classList.contains("dis")).toBe(true);
});

it("a villager's night taps are decoys that never reach the server", async () => {
  const p = night();
  await mount(p);
  await click(row(".nopt", "p3"));
  expect(row(".nopt", "p3").classList.contains("sel")).toBe(true);
  expect(p.act).not.toHaveBeenCalled();
});

it("the vote lists only living others with public totals and sends the chosen target", async () => {
  const players = ids.map((id) => ({ id, alive: id !== "p6" }));
  const p = props(
    wwView({
      stage: "VOTE",
      players,
      voteCounts: { p3: 2 },
      needed: 3,
      me: myState({ myVote: null }),
    }),
  );
  await mount(p);
  expect([...container.querySelectorAll(".dopt")].map((e) => e.getAttribute("data-n"))).toEqual([
    "p2",
    "p3",
    "p4",
    "p5",
  ]);
  expect(row(".dopt", "p3").querySelectorAll(".pb:not(.ph)")).toHaveLength(2);
  expect(row(".dopt", "p3").querySelectorAll(".pb")).toHaveLength(3);
  expect(container.textContent).toContain("3");
  await click(row(".dopt", "p4"));
  expect(p.act).toHaveBeenCalledWith({ type: "ww:dayVote", payload: { targetId: "p4" } });
  await mount(props(wwView({ stage: "VOTE", needed: 3, me: myState({ myVote: "p4" }) })));
  expect(row(".dopt", "p4").classList.contains("sel")).toBe(true);
});

it("an eliminated player only spectates", () => {
  for (const stage of ["NIGHT", "DISCUSSION", "VOTE"] as const) {
    const el = markup(props(wwView({ stage, me: myState({ alive: false }) })));
    expect(el.textContent).toContain("You're out");
    expect(el.querySelectorAll(".nopt, .dopt")).toHaveLength(0);
  }
});

it("a waiting late joiner sees the gate screen without a role", () => {
  const el = markup(props(wwView({ me: myState({ role: null, pending: true }) })));
  expect(el.textContent).toContain("The gates open at dawn");
  expect(el.textContent).not.toMatch(/Werewolf|Seer|Guard|Villager/);
});

it("dawn: the victim, everyone else, and a quiet night each get their own screen", () => {
  const killed = markup(
    props(wwView({ stage: "DAWN", dawn: { eliminatedId: "p1" }, me: myState({ alive: false }) })),
  ).textContent!;
  expect(killed).toContain("YOU WERE KILLED");
  const news = markup(
    props(wwView({ stage: "DAWN", dawn: { eliminatedId: "p3" }, me: myState() })),
  ).textContent!;
  expect(news).toContain("CY WAS KILLED");
  expect(news).not.toContain("YOU WERE KILLED");
  const quiet = markup(
    props(wwView({ stage: "DAWN", dawn: { eliminatedId: null }, me: myState() })),
  ).textContent!;
  expect(quiet).toContain("NO ONE DIED");
  // the safe screen never reveals why nobody died
  expect(quiet).not.toMatch(/protect|guard|shield/i);
});

it("discussion shows the living players and the verdict names the banished player", () => {
  const talk = markup(props(wwView({ stage: "DISCUSSION", me: myState() }))).textContent!;
  expect(talk).toContain("Talk it out");
  for (const name of ["Bo", "Cy", "Dee", "Eve", "Fay"]) expect(talk).toContain(name);
  const banished = markup(
    props(
      wwView({
        stage: "VERDICT",
        players: ids.map((id) => ({ id, alive: id !== "p3" })),
        lastVote: { eliminatedId: "p3", counts: { p3: 3 } },
        me: myState(),
      }),
    ),
  ).textContent!;
  expect(banished).toContain("CY IS BANISHED");
  expect(banished).toContain("3 of 6");
  const nobody = markup(
    props(
      wwView({ stage: "VERDICT", lastVote: { eliminatedId: null, counts: {} }, me: myState() }),
    ),
  ).textContent!;
  expect(nobody).toContain("NO ONE IS BANISHED");
});

it("the end screen tells each player whether they won and reveals every role", () => {
  const roles = {
    p1: "werewolf",
    p2: "villager",
    p3: "seer",
    p4: "guard",
    p5: "villager",
    p6: "villager",
  } as const;
  const lost = markup(
    props(wwView({ stage: "ENDED", winner: "village", roles, me: myState({ role: "werewolf" }) })),
  ).textContent!;
  expect(lost).toContain("YOU LOSE");
  const won = markup(
    props(
      wwView({ stage: "ENDED", winner: "village", roles, me: myState({ role: "villager" }) }),
      "player",
      "p2",
    ),
  ).textContent!;
  expect(won).toContain("YOU WIN");
  for (const name of ["Ada", "Bo", "Cy", "Dee", "Eve", "Fay"]) expect(won).toContain(name);
  expect(won).toContain("Seer");
});
