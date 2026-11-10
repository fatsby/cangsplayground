// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { Role } from "@cangsplayground/game-werewolf";
import views from "@cangsplayground/game-werewolf/views";
import { ids, props, wwView } from "./werewolf-fixture";

const Panel = views.HostSessionPanel!;
type P = ReturnType<typeof props>;
/** p1,p2 werewolves; p3 seer; p4 guard; p5,p6 villagers. */
const ROLES: Record<string, Role> = {
  p1: "werewolf",
  p2: "werewolf",
  p3: "seer",
  p4: "guard",
  p5: "villager",
  p6: "villager",
};
const hostProps = (over = {}, roles: Record<string, Role> = ROLES): P =>
  props(wwView({ roles, ...over }), "host");

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
const mount = (p: P) => act(async () => root.render(<Panel {...p} />));
const markup = (p: P) => {
  const el = document.createElement("div");
  el.innerHTML = renderToStaticMarkup(<Panel {...p} />);
  return el;
};
const roleButton = (id: string, role: string) =>
  container.querySelector<HTMLButtonElement>(`[data-set="${id}:${role}"]`)!;
const click = (el: HTMLElement) => act(async () => el.click());
const startButton = () =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Start game"))!;

it("registers a host panel and a settings note", () => {
  expect(views.HostSessionPanel).toBeDefined();
  expect(views.HostConfigNote).toBeDefined();
});

it("SETUP lists every player with a role selector reflecting their role", async () => {
  await mount(hostProps({ stage: "SETUP", deadlineAt: null }));
  for (const id of ids) {
    for (const role of ["werewolf", "villager", "seer", "guard"])
      expect(roleButton(id, role)).toBeTruthy();
    expect(roleButton(id, ROLES[id]!).getAttribute("aria-pressed")).toBe("true");
  }
  expect(container.textContent).toContain("Werewolf 2");
});

it("changing a role sends ww:setRole with the exact payload", async () => {
  const p = hostProps({ stage: "SETUP", deadlineAt: null });
  await mount(p);
  await click(roleButton("p5", "seer"));
  expect(p.hostAct).toHaveBeenCalledWith({
    type: "ww:setRole",
    payload: { playerId: "p5", role: "seer" },
  });
});

it("Start is disabled with the reason when the roles are not valid, and sends ww:start when they are", async () => {
  const noWolf = hostProps(
    { stage: "SETUP", deadlineAt: null },
    { ...ROLES, p1: "villager", p2: "villager" },
  );
  await mount(noWolf);
  expect(startButton().disabled).toBe(true);
  expect(container.textContent).toContain("Add at least one Werewolf.");
  const tooMany = hostProps(
    { stage: "SETUP", deadlineAt: null },
    {
      p1: "werewolf",
      p2: "werewolf",
      p3: "werewolf",
      p4: "villager",
      p5: "villager",
      p6: "villager",
    },
  );
  await mount(tooMany);
  expect(container.textContent).toContain("Werewolves must be fewer than everyone else.");
  const ok = hostProps({ stage: "SETUP", deadlineAt: null });
  await mount(ok);
  expect(startButton().disabled).toBe(false);
  await click(startButton());
  expect(ok.hostAct).toHaveBeenCalledWith({ type: "ww:start" });
});

it("during the night the host sees every role, who has acted and tonight's live choices", () => {
  const el = markup(
    hostProps({
      hostNight: {
        wolfVotes: { p1: "p5", p2: "p5" },
        seerPicks: { p3: "p1" },
        guardPicks: { p4: "p6" },
      },
    }),
  );
  const text = el.textContent!;
  expect(text).toContain("NIGHT 1");
  for (const label of ["Werewolf", "Seer", "Guard", "Villager"]) expect(text).toContain(label);
  const rows = [...el.querySelectorAll(".ncompact-row")].map((r) => r.textContent);
  expect(rows[0]).toContain("Wolves");
  expect(rows[0]).toContain("Ada");
  expect(rows[0]).toContain("Bo");
  expect(rows[0]).toContain("AttackEve");
  expect(rows[1]).toContain("Seer");
  expect(rows[1]).toContain("Cy");
  expect(rows[1]).toContain("InspectAda");
  expect(rows[2]).toContain("Guard");
  expect(rows[2]).toContain("Dee");
  expect(rows[2]).toContain("ProtectFay");
  expect(el.querySelectorAll(".acted")).toHaveLength(4);
});

it("during the vote the host sees who voted for whom plus totals against the threshold", () => {
  const el = markup(
    hostProps({
      stage: "VOTE",
      needed: 3,
      voteCounts: { p1: 3, p2: 1 },
      hostVotes: { p3: "p1", p4: "p1", p5: "p1", p6: "p2" },
    }),
  );
  const cards = [...el.querySelectorAll(".vtarget-card")].map((c) => c.textContent);
  expect(cards[0]).toContain("Ada");
  expect(cards[0]).toContain("3/3");
  expect(cards[0]).toContain("Voted by");
  expect(cards[0]).toContain("Cy");
  expect(cards[0]).toContain("Dee");
  expect(cards[0]).toContain("Eve");
  expect(cards[1]).toContain("Bo");
  expect(cards[1]).toContain("1/3");
  expect(cards[1]).toContain("Fay");
  expect(el.querySelector(".unvoted-bar")?.textContent).toContain("Waiting");
  expect(el.querySelectorAll(".vbar.reach")).toHaveLength(1);
});

it("marks eliminated players", () => {
  const el = markup(
    hostProps({ players: ids.map((id) => ({ id, alive: id !== "p5" })), me: null }),
  );
  expect(el.querySelectorAll(".hp.dead")).toHaveLength(1);
});

it("late joiners wait in their own list with a role selector that defaults to Villager", async () => {
  const p = hostProps(
    {
      players: [
        ...ids.map((id) => ({ id, alive: true })),
        { id: "p7", alive: true, pending: true as const },
      ],
    },
    { ...ROLES, p7: "villager" },
  );
  p.lobby.players.push({ id: "p7", name: "Gus", groupId: "g1", connected: true, away: false });
  await mount(p);
  const pending = container.querySelector(".pending")!;
  expect(pending.textContent).toContain("Gus");
  expect(pending.textContent).toContain("enters at dawn");
  expect(pending.querySelector('[data-set="p7:villager"]')!.getAttribute("aria-pressed")).toBe(
    "true",
  );
  await click(pending.querySelector<HTMLButtonElement>('[data-set="p7:seer"]')!);
  expect(p.hostAct).toHaveBeenCalledWith({
    type: "ww:setRole",
    payload: { playerId: "p7", role: "seer" },
  });
  expect(container.querySelectorAll(".hgrid .hp")).toHaveLength(6);
});

it("after the game ends the host sees the winner", () => {
  const text = markup(
    hostProps({ stage: "ENDED", deadlineAt: null, winner: "wolves" }),
  ).textContent!;
  expect(text).toContain("The wolves win");
});
