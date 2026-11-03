import { useState } from "react";
import { helpFor } from "../phrases.js";

/** Where each phone remembers whether the help panel is hidden. */
export const HELP_KEY = "cangsplayground:mm-help";

function readHidden(): boolean {
  try {
    return localStorage.getItem(HELP_KEY) === "hidden";
  } catch {
    return false;
  }
}

/** Help is visible by default; the choice is remembered on this phone when storage allows. */
export function useHelpHidden(): readonly [boolean, (hidden: boolean) => void] {
  const [hidden, setHidden] = useState(readHidden);
  const change = (next: boolean) => {
    setHidden(next);
    try {
      localStorage.setItem(HELP_KEY, next ? "hidden" : "shown");
    } catch {
      /* Private browsing may deny storage; keep the in-memory choice. */
    }
  };
  return [hidden, change] as const;
}

/**
 * Sentence frames for the current phase, with a Hide button.
 *
 * @param phase the game phase; the frames change with it.
 * @param hidden whether the panel is collapsed.
 * @param onHiddenChange called with the new choice.
 */
export function LanguageHelp({
  phase,
  hidden,
  onHiddenChange,
}: {
  phase: string;
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
}) {
  if (hidden) {
    return (
      <button
        type="button"
        className="cp-btn cp-btn-ghost mm-help-show"
        onClick={() => onHiddenChange(false)}
      >
        Show help
      </button>
    );
  }
  return (
    <section className="cp-panel mm-help" aria-labelledby="mm-help-title">
      <div className="mm-help-head">
        <h2 id="mm-help-title">Language help</h2>
        <button type="button" className="cp-btn cp-btn-ghost" onClick={() => onHiddenChange(true)}>
          Hide
        </button>
      </div>
      {helpFor(phase).map((group) => (
        <div key={group.topic} className="mm-help-group">
          <h3>{group.title}</h3>
          <ul className="mm-phrases">
            {group.phrases.map((phrase) => (
              <li key={phrase.en}>
                <span className="mm-en">{phrase.en}</span>
                <span className="mm-vi" lang="vi">
                  {phrase.vi}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
