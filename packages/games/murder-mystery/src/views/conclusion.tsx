import { useEffect, useState } from "react";
import type { GameAction } from "@cangsplayground/core";
import type { Conclusion, MurderView } from "../types.js";
import { ClueCard } from "./clue-card.js";
import { nameOf } from "./shared.js";

type Own = NonNullable<MurderView["ownTeam"]>;
type Field = "suspectId" | "weaponId" | "roomId";

/** Most evidence cards a team may cite for one answer. */
export const MAX_EVIDENCE = 2;

const FIELDS: { field: Field; legend: string; list: "suspects" | "weapons" | "rooms" }[] = [
  { field: "suspectId", legend: "Who did it?", list: "suspects" },
  { field: "weaponId", legend: "With what?", list: "weapons" },
  { field: "roomId", legend: "Where?", list: "rooms" },
];

const sameConclusion = (a: Conclusion, b: Conclusion): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

function Summary({ view, conclusion }: { view: MurderView; conclusion: Conclusion }) {
  return (
    <dl className="mm-summary">
      {FIELDS.map(({ field, legend }) => (
        <div key={field}>
          <dt>{legend}</dt>
          <dd>{nameOf(view, conclusion[field])}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The team's final accusation. Everyone sees the team's discovered clues and the shared draft;
 * only the submitter edits. Editing is local until the submitter saves, and the submitter must
 * save before confirming, so `draftVersion` always matches what the server holds.
 */
export function ConclusionPanel({
  view,
  own,
  send,
  pending,
  error,
  submitterName,
}: {
  view: MurderView;
  own: Own;
  submitterName: string;
  send: (action: GameAction) => Promise<boolean>;
  pending: boolean;
  error: string | null;
}) {
  const server = own.draft as Conclusion;
  const [edit, setEdit] = useState<Conclusion>(server);
  const [confirming, setConfirming] = useState(false);
  // A new server draft or a new phase replaces local edits and cancels any open confirmation.
  useEffect(() => {
    setEdit(server);
    setConfirming(false);
  }, [own.draftVersion, view.phaseVersion]);
  const guard = { caseNumber: view.caseNumber, phaseVersion: view.phaseVersion };
  const dirty = !sameConclusion(edit, server);
  const cards = own.sharedCards ?? [];

  const choose = (field: Field, id: string) =>
    setEdit((c) => ({ ...c, [field]: c[field] === id ? null : id }));
  const toggle = (field: Field, cardId: string) =>
    setEdit((c) => {
      const chosen = c.evidence[field];
      if (chosen.includes(cardId))
        return { ...c, evidence: { ...c.evidence, [field]: chosen.filter((x) => x !== cardId) } };
      if (chosen.length >= MAX_EVIDENCE) return c;
      return { ...c, evidence: { ...c.evidence, [field]: [...chosen, cardId] } };
    });

  return (
    <div className="cp-stack mm-conclusion">
      <h1>Your final answer</h1>
      <section aria-label="Your team's clues" className="cp-stack">
        <h2>Your team's clues</h2>
        {cards.map((card) => (
          <ClueCard key={card.id} card={card} />
        ))}
      </section>

      {own.submission ? (
        <section className="cp-panel mm-submitted" aria-live="polite">
          <h2>Submitted</h2>
          <p>Your team's answer is locked. Wait for the teacher to reveal the solution.</p>
          <Summary view={view} conclusion={own.submission} />
        </section>
      ) : !own.canEdit ? (
        <section className="cp-panel">
          <h2>Draft answer</h2>
          <p className="cp-muted">
            {submitterName} writes the final answer. Talk it through together.
          </p>
          <Summary view={view} conclusion={server} />
        </section>
      ) : (
        <form className="cp-stack" onSubmit={(e) => e.preventDefault()}>
          {FIELDS.map(({ field, legend, list }) => (
            <fieldset key={field} className="cp-panel mm-field">
              <legend>{legend}</legend>
              <div className="mm-choices" role="group" aria-label={`${legend} answer`}>
                {(view.briefing?.[list] ?? []).map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    className="cp-btn cp-btn-secondary mm-choice"
                    aria-pressed={edit[field] === entity.id}
                    onClick={() => choose(field, entity.id)}
                  >
                    {entity.name}
                  </button>
                ))}
              </div>
              <p className="cp-muted">Choose up to {MAX_EVIDENCE} clues that prove it.</p>
              <div className="mm-choices" role="group" aria-label={`${legend} evidence`}>
                {cards.map((card) => {
                  const picked = edit.evidence[field].includes(card.id);
                  const full = !picked && edit.evidence[field].length >= MAX_EVIDENCE;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className="cp-btn cp-btn-ghost mm-evidence"
                      aria-pressed={picked}
                      aria-disabled={full}
                      data-clue={card.id}
                      onClick={() => toggle(field, card.id)}
                    >
                      {card.sourceLabel}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <p className="cp-muted mm-explain">
            Be ready to say why: "We ruled out … because …". Each of you can explain one part.
          </p>
          <button
            type="button"
            className="cp-btn cp-btn-secondary"
            disabled={!dirty || pending}
            onClick={() =>
              send({
                type: "mm:saveDraft",
                payload: { ...guard, draftVersion: own.draftVersion, conclusion: edit },
              })
            }
          >
            Save draft
          </button>
          {!confirming ? (
            <button
              type="button"
              className="cp-btn cp-btn-primary"
              disabled={!own.canSubmit || dirty || pending}
              onClick={() => setConfirming(true)}
            >
              Review and submit
            </button>
          ) : (
            <section
              className="cp-panel mm-confirm"
              role="alertdialog"
              aria-label="Confirm final answer"
            >
              <h2>Submit this final answer?</h2>
              <Summary view={view} conclusion={server} />
              <p>You cannot change it after you submit.</p>
              <button
                type="button"
                className="cp-btn cp-btn-primary"
                disabled={pending}
                onClick={() =>
                  send({ type: "mm:submit", payload: { ...guard, draftVersion: own.draftVersion } })
                }
              >
                Yes, submit
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-ghost"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Keep editing
              </button>
            </section>
          )}
        </form>
      )}
      {error && (
        <p className="cp-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
