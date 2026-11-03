import type { SessionViewProps } from "@cangsplayground/ui";
import { Timer } from "@cangsplayground/ui";
import type { LobbyView } from "@cangsplayground/core";
import type { MurderView } from "../types.js";
import { IntroStage } from "./intro.js";
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

function Dossier({ view }: { view: MurderView }) {
  const b = view.briefing;
  if (!b) return null;
  return (
    <section className="mm-dossier">
      <h1>{b.title}</h1>
      <p>{b.opening}</p>
      <p className="cp-muted">
        Victim: <strong>{b.victim.name}</strong>. Found at {b.bodyFoundAt}.
      </p>
      <div className="mm-dossier-lists">
        {(
          [
            ["Suspects", b.suspects],
            ["Weapons", b.weapons],
            ["Rooms", b.rooms],
          ] as const
        ).map(([title, list]) => (
          <div key={title}>
            <h2>{title}</h2>
            <ul>
              {list.map((e) => (
                <li key={e.id}>{e.name}</li>
              ))}
            </ul>
          </div>
        ))}
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
    return (
      <section className="mm-projector">
        <h1>Murder Mystery</h1>
        <p>Work in your teams. Share clues in English and solve the case together.</p>
        <ul className="mm-progress">
          {lobby.groups.map((g) => (
            <li key={g.id}>
              <strong>{g.name}</strong> {g.playerIds.length} players
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (view.phase === "INTRO") {
    return (
      <section className="mm-projector mm-projector-intro">
        {view.briefing && view.intro ? (
          <IntroStage
            briefing={view.briefing}
            intro={view.intro}
            elapsedMs={introElapsed}
            reduced={reduced}
            decorSeed={view.caseNumber}
          />
        ) : null}
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
          <Timer
            ring
            timer={{
              endsAt: view.clock.endsAt,
              pausedRemainingMs: view.clock.remainingMs,
              durationMs: view.clock.durationMs,
            }}
            serverNow={serverNow}
          />
        )}
      </header>
      {view.phase === "AWAITING_REVEAL" ? null : <Dossier view={view} />}
      <ul className="mm-progress">
        {view.progress.map((p) => (
          <li key={p.groupId}>
            <strong>{teamName(lobby, p.groupId)}</strong> {progressText(view.phase, p)}
          </li>
        ))}
      </ul>
    </section>
  );
}
