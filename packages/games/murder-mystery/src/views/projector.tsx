import type { SessionViewProps } from "@cangsplayground/ui";
import { TeamShape, Timer, teamVars } from "@cangsplayground/ui";
import type { LobbyView } from "@cangsplayground/core";
import type { MurderView } from "../types.js";
import { IntroStage } from "./intro.js";
import { stageLabel } from "./scene-art.js";
import { Scoreboard, SolutionStory } from "./reveal.js";
import { ROUNDS, murderView } from "./shared.js";
import {
  REVEAL_BOARD_START_MS,
  REVEAL_TOTAL_MS,
  elapsedStyle,
  useElapsedMs,
  usePrefersReducedMotion,
} from "./timeline.js";

const PHASE_TITLES: Record<MurderView["phase"], string> = {
  READY: "Get ready",
  INTRO: "",
  BRIEFING: "Read the case file",
  SHARING: "Share your clues",
  INVESTIGATION: "Investigate",
  CONCLUSION: "Agree on your answer",
  AWAITING_REVEAL: "Waiting for the teacher to reveal the answer",
  REVEALED: "Case closed",
};

const teamName = (lobby: LobbyView, groupId: string): string =>
  lobby.groups.find((g) => g.id === groupId)?.name ?? groupId;

/** The public case file in two columns (mockup D2), sized to fit a 16:9 projector. */
function Dossier({ view }: { view: MurderView }) {
  const b = view.briefing;
  if (!b) return null;
  return (
    <section className="mm-dossier" aria-label="The case">
      <div className="mm-pj-panel mm-dossier-case">
        <p className="mm-eyebrow">The case</p>
        <h1>{b.title}</h1>
        <p>{b.opening}</p>
        <p className="mm-dossier-found">
          <span>
            <b>Body found:</b> at {b.bodyFoundAt}
          </span>
          <span>
            <b>Where it happened:</b> still unknown — one of {b.rooms.length} rooms.
          </span>
        </p>
        {view.phase === "BRIEFING" && (
          <p className="mm-dossier-goal">
            <b>Mission:</b> find the culprit, the weapon and the room — with evidence.
          </p>
        )}
      </div>
      <div className="mm-dossier-side">
        <div className="mm-pj-panel">
          <h2 className="mm-eyebrow">Suspects</h2>
          <ul className="mm-dossier-people">
            {b.suspects.map((e) => (
              <li key={e.id}>
                <strong>{e.name}</strong>
                <span>{e.description}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mm-dossier-pair">
          {(
            [
              ["Weapons", b.weapons],
              ["Rooms", b.rooms],
            ] as const
          ).map(([title, list]) => (
            <div key={title} className="mm-pj-panel">
              <h2 className="mm-eyebrow">{title}</h2>
              <ul className="mm-dossier-chips">
                {list.map((e) => (
                  <li key={e.id}>{stageLabel(e.name)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function progressText(phase: MurderView["phase"], p: MurderView["progress"][number]): string {
  if (!p.active) return "No players";
  if (phase === "INVESTIGATION") return p.acted ? "Investigated" : "Thinking…";
  if (phase === "CONCLUSION" || phase === "AWAITING_REVEAL")
    return p.submitted ? "Submitted" : "Working…";
  return "";
}

/**
 * The class's shared screen. It shows only public things: the case file once the intro has
 * played, the shared clock, and for each team whether it has investigated or submitted. Clues,
 * drafts, answers and scores appear only through the staged reveal. The intro and the reveal are
 * pure functions of the server clock, so a reload lands on the right frame.
 */
export function ProjectorScreen({ lobby, session, serverNow }: SessionViewProps) {
  const view = murderView(session);
  const reduced = usePrefersReducedMotion();
  const clock = view?.clock;
  const introMs = view?.introMs ?? 0;
  const inIntro = view?.phase === "INTRO";
  const remaining = clock?.remainingMs ?? null;
  const frozenAtMs = inIntro && view?.paused && remaining !== null ? introMs - remaining : null;
  const introStart =
    !inIntro || !clock
      ? null
      : clock.endsAt !== null
        ? clock.endsAt - introMs
        : serverNow() - (introMs - (remaining ?? introMs));
  const introElapsed = useElapsedMs({
    totalMs: introMs,
    startedAt: introStart,
    serverNow,
    frozenAtMs,
  });
  const revealElapsed = useElapsedMs({
    totalMs: REVEAL_TOTAL_MS,
    startedAt: view?.phase === "REVEALED" ? view.revealStartedAt : null,
    serverNow,
  });
  if (!view) return null;

  if (view.phase === "READY") {
    const teams = lobby.groups.filter((g) => g.playerIds.length > 0);
    const detectives = teams.reduce((sum, g) => sum + g.playerIds.length, 0);
    return (
      <section className="mm-projector mm-projector-ready">
        <div className="mm-ready-center">
          <p className="mm-eyebrow">New case</p>
          <h1>A case is waiting.</h1>
          <p className="mm-ready-sub">
            {teams.length} {teams.length === 1 ? "team" : "teams"} · {detectives}{" "}
            {detectives === 1 ? "detective" : "detectives"} · one mystery
          </p>
          <ul className="mm-ready-teams">
            {teams.map((g) => (
              <li key={g.id}>
                <span className="cp-team-badge" style={teamVars(g.index)}>
                  <TeamShape teamIndex={g.index} size={20} />
                  {g.name} · {g.playerIds.length}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mm-ready-foot">
          <span aria-hidden="true">✦</span> Waiting for the host to start.
        </p>
      </section>
    );
  }

  if (view.phase === "INTRO") {
    return (
      <section className="mm-projector-intro" aria-label="Case introduction">
        {view.briefing && view.intro ? (
          <IntroStage
            briefing={view.briefing}
            intro={view.intro}
            elapsedMs={introElapsed}
            reduced={reduced}
            decorSeed={view.caseNumber}
          />
        ) : null}
        {view.paused && (
          <p className="mm-intro-paused" role="status">
            Paused
          </p>
        )}
      </section>
    );
  }

  if (view.phase === "REVEALED") {
    const showBoard = reduced || (revealElapsed ?? 0) >= REVEAL_BOARD_START_MS;
    return (
      <section
        className="mm-projector mm-projector-reveal"
        style={elapsedStyle(revealElapsed, reduced)}
      >
        <h1>{PHASE_TITLES.REVEALED}</h1>
        {showBoard ? (
          <Scoreboard
            view={view}
            elapsed={revealElapsed}
            reduced={reduced}
            teamName={(id) => teamName(lobby, id)}
          />
        ) : (
          <SolutionStory view={view} elapsed={revealElapsed} reduced={reduced} />
        )}
      </section>
    );
  }

  return (
    <section className="mm-projector">
      <header className="mm-projector-head">
        <h2>{PHASE_TITLES[view.phase]}</h2>
        {view.phase === "INVESTIGATION" && (
          <p>
            Round {view.investigationRound} of {ROUNDS}
          </p>
        )}
        {view.paused && <p className="cp-banner">Paused</p>}
        {(view.clock.endsAt !== null || view.clock.remainingMs !== null) && (
          <div className="mm-pj-clock">
            <small>Time left</small>
            <Timer
              timer={{
                endsAt: view.clock.endsAt,
                pausedRemainingMs: view.clock.remainingMs,
                durationMs: view.clock.durationMs,
              }}
              serverNow={serverNow}
            />
          </div>
        )}
      </header>
      {view.phase !== "BRIEFING" && (
        <ul className="mm-progress">
          {view.progress.map((p) => (
            <li key={p.groupId}>
              <strong>{teamName(lobby, p.groupId)}</strong> {progressText(view.phase, p)}
            </li>
          ))}
        </ul>
      )}
      {view.phase === "AWAITING_REVEAL" ? null : <Dossier view={view} />}
    </section>
  );
}
