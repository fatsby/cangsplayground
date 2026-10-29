import { useState } from "react";
import { generalHelp, languageHelp } from "../phrases.js";
import type { HelpLevel, HelpRole, Phrase } from "../types.js";
import { LEVEL_KEY } from "./shared.js";

function readLevel(): HelpLevel {
  try {
    return localStorage.getItem(LEVEL_KEY) === "A2" ? "A2" : "A1";
  } catch {
    return "A1";
  }
}

/** A1 by default; remembered on this phone when storage is available. */
export function useHelpLevel() {
  const [level, setLevel] = useState<HelpLevel>(readLevel);
  const change = (next: HelpLevel) => {
    setLevel(next);
    try {
      localStorage.setItem(LEVEL_KEY, next);
    } catch {
      /* Private browsing may deny storage; keep the in-memory choice. */
    }
  };
  return [level, change] as const;
}

function PhraseList({ phrases }: { phrases: Phrase[] }) {
  return (
    <ul className="gc-phrases">
      {phrases.map((phrase) => (
        <li key={phrase.en}>
          <span className="gc-en">{phrase.en}</span>
          <span className="gc-vi" lang="vi">
            {phrase.vi}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LanguageHelp({
  categoryId,
  role,
  level,
  onLevelChange,
}: {
  categoryId: string | null;
  role: HelpRole;
  level: HelpLevel;
  onLevelChange: (level: HelpLevel) => void;
}) {
  let help;
  try {
    help = categoryId ? languageHelp(categoryId, level) : generalHelp(level);
  } catch {
    help = generalHelp(level);
  }
  return (
    <section className="cp-panel gc-help" aria-labelledby="gc-help-title">
      <div className="gc-help-head">
        <h2 id="gc-help-title">{role === "question" ? "Ask a question" : "Answer the question"}</h2>
        <div className="gc-level" role="group" aria-label="English level">
          {(["A1", "A2"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="gc-level-option"
              aria-pressed={level === value}
              onClick={() => onLevelChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <PhraseList phrases={role === "question" ? help.questions : help.answers} />
      <p className="gc-grammar">
        <strong>Tip:</strong> {help.grammar.en}
        <span className="gc-vi" lang="vi">
          {help.grammar.vi}
        </span>
      </p>
      {help.vocabulary.length > 0 && (
        <details className="gc-vocab">
          <summary>Words you can use</summary>
          <dl>
            {help.vocabulary.map((word) => (
              <div key={word.en}>
                <dt>{word.en}</dt>
                <dd lang="vi">{word.vi}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
