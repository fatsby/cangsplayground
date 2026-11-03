import { MessageSquareQuote, ShieldCheck } from "lucide-react";
import { SecretCard } from "@cangsplayground/ui";
import type { ClueFace } from "../types.js";

function ClueBody({ card, reference }: { card: ClueFace; reference?: string }) {
  const verified = card.sourceKind === "verified";
  return (
    <article className="mm-clue" data-kind={card.sourceKind} data-clue={card.id}>
      <header className="mm-clue-source">
        {/* Colour is never the only cue: icon, border style and the word all differ. */}
        {verified ? (
          <ShieldCheck size={18} aria-hidden="true" />
        ) : (
          <MessageSquareQuote size={18} aria-hidden="true" />
        )}
        {reference && <span className="mm-clue-reference">{reference}</span>}
        <strong>{card.sourceLabel}</strong>
        <span className="mm-clue-kind">{verified ? "Confirmed" : "Unverified"}</span>
      </header>
      <p className="mm-clue-body">{card.body}</p>
      {card.vocabulary.length > 0 && (
        <details className="mm-vocab">
          <summary>Words you can use</summary>
          <dl>
            {card.vocabulary.map((word) => (
              <div key={word.en}>
                <dt>{word.en}</dt>
                <dd lang="vi">{word.vi}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  );
}

/**
 * One clue card. A private card starts concealed on every mount and opens only while held; a
 * shared card (the team's conclusion list) is always readable.
 *
 * @param card the card text and source.
 * @param concealed hide the text behind the hold-to-see card.
 * @param reference visible team-clue reference matching the conclusion evidence controls.
 */
export function ClueCard({
  card,
  concealed = false,
  reference,
}: {
  card: ClueFace;
  concealed?: boolean;
  reference?: string;
}) {
  return concealed ? (
    <SecretCard>
      <ClueBody card={card} reference={reference} />
    </SecretCard>
  ) : (
    <ClueBody card={card} reference={reference} />
  );
}
