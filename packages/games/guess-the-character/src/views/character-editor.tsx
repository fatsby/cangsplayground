import { useState } from "react";
import { Dices, Pencil } from "lucide-react";
import { Button, type SessionViewProps } from "@cangsplayground/ui";
import type { CharacterFace, MatchGuard } from "../types.js";

interface CharacterEditorProps {
  guard: MatchGuard;
  groupId: string;
  /** Every character of the match category. */
  pool: readonly CharacterFace[];
  /** The character this team holds now. */
  currentId: string | null;
  /** The other team's character: the host cannot give the same one to both teams. */
  opponentId: string | null;
  disabled: boolean;
  hostAct: SessionViewProps["hostAct"];
}

/**
 * Host controls on a team row: reroll the team's character at random, or pick one from
 * the match category. The server re-checks every rule; the list only hides what it would reject.
 */
export function CharacterEditor({
  guard,
  groupId,
  pool,
  currentId,
  opponentId,
  disabled,
  hostAct,
}: CharacterEditorProps) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const send = (characterId: string | null) =>
    void hostAct?.({ type: "gc:setCharacter", payload: { ...guard, groupId, characterId } });
  const needle = query.trim().toLocaleLowerCase();
  const shown = pool.filter((c) => c.name.toLocaleLowerCase().includes(needle));
  return (
    <div className="gc-editor">
      <div className="cp-row">
        <Button disabled={disabled} onClick={() => send(null)}>
          <Dices size={16} strokeWidth={2.25} aria-hidden="true" /> Reroll
        </Button>
        <Button disabled={disabled} aria-expanded={picking} onClick={() => setPicking(!picking)}>
          <Pencil size={16} strokeWidth={2.25} aria-hidden="true" /> Pick character
        </Button>
      </div>
      {picking && (
        <div className="gc-picker">
          <input
            className="cp-input"
            value={query}
            placeholder="Search this category"
            aria-label="Search characters"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="gc-picker-list">
            {shown.map((c) => {
              const current = c.id === currentId;
              const taken = c.id === opponentId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="gc-picker-item"
                    aria-current={current}
                    disabled={disabled || current || taken}
                    onClick={() => {
                      send(c.id);
                      setPicking(false);
                      setQuery("");
                    }}
                  >
                    {c.name}
                    {current && <span className="cp-muted"> (current)</span>}
                    {taken && <span className="cp-muted"> (other team's)</span>}
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="cp-muted gc-small">No match.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
