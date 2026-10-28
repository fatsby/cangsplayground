import { useId, useState } from "react";
import { Shuffle, Pencil } from "lucide-react";
import { avatarChoices, type AvatarConfig, type PlayerSummary } from "@cangsplayground/core";
import { Button, Panel, PlayerAvatar } from "@cangsplayground/ui";
import { request } from "../socket";
import { newCommandId } from "../socket/command-id";
import { useLobbyStore } from "../store";

const labels = {
  hairVariant: "Hairstyle",
  hairColor: "Hair color",
  skinColor: "Skin tone",
  eyesVariant: "Eyes",
  mouthVariant: "Smile",
  accessoriesVariant: "Accessory",
  backgroundColor: "Background",
} satisfies Record<keyof Omit<AvatarConfig, "seed">, string>;
const colorNames: Record<string, string> = {
  ffe3ea: "Rose",
  e3edff: "Sky",
  e2f5e9: "Mint",
  fdf1d4: "Butter",
  efe6ff: "Lavender",
  "220f00": "Black",
  "3a1a00": "Dark brown",
  "71472d": "Brown",
  e2ba87: "Golden",
  "605de4": "Purple",
  "238d80": "Teal",
  d56c0c: "Orange",
  e9b729: "Yellow",
  ffe4c0: "Ivory",
  f5d7b1: "Light peach",
  efcc9f: "Peach",
  c99c62: "Tan",
  a47539: "Warm brown",
  "8c5a2b": "Deep brown",
  "643d19": "Dark brown",
};
const optionLabel = (value: string) =>
  colorNames[value] ??
  value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());

export function AvatarEditor({ player }: { player: PlayerSummary }) {
  const canEdit = useLobbyStore((state) => state.view?.game === null);
  return canEdit ? <Editor key={player.id} player={player} /> : null;
}

function Editor({ player }: { player: PlayerSummary }) {
  const id = useId();
  const online = useLobbyStore((state) => state.connection === "online");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AvatarConfig>(player.avatar ?? { seed: player.id });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (busy || !online) return;
    setBusy(true);
    setError("");
    try {
      const result = await request("player:avatar", { avatar: draft });
      if (result.ok) setOpen(false);
      else setError(result.error.message);
    } catch {
      setError("Couldn't save your avatar. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel className={`avatar-studio ${open ? "avatar-studio-open" : ""}`}>
      <div className="avatar-studio-heading">
        <PlayerAvatar
          playerId={player.id}
          avatar={open ? draft : player.avatar}
          size={open ? 96 : 64}
          label="Avatar preview"
        />
        <div>
          <p className="avatar-eyebrow">A little more you</p>
          <h2>Your lobby look</h2>
          <p className="cp-muted">Make it yours while your teacher picks a game.</p>
        </div>
      </div>
      {!open ? (
        <Button
          onClick={() => {
            setDraft(player.avatar ?? { seed: player.id });
            setError("");
            setOpen(true);
          }}
        >
          <Pencil size={18} />
          Customize avatar
        </Button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          aria-label="Customize your avatar"
        >
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => setDraft({ seed: newCommandId() })}
          >
            <Shuffle size={18} />
            Randomize
          </Button>
          <fieldset disabled={busy} className="avatar-fields">
            <legend className="cp-sr-only">Your appearance</legend>
            {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
              <div
                className={`cp-field ${key === "backgroundColor" ? "avatar-background" : ""}`}
                key={key}
              >
                <label htmlFor={`${id}-${key}`}>{labels[key]}</label>
                <select
                  className="cp-input"
                  id={`${id}-${key}`}
                  name={key}
                  value={draft[key] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((previous) => ({ ...previous, [key]: value || undefined }));
                  }}
                >
                  <option value="">Surprise me</option>
                  {avatarChoices[key].map((value) => (
                    <option key={value} value={value}>
                      {optionLabel(value)}
                    </option>
                  ))}
                </select>
                {key === "backgroundColor" && (
                  <span className="avatar-pastel-palette" aria-hidden="true">
                    {avatarChoices.backgroundColor.map((color) => (
                      <i key={color} style={{ backgroundColor: `#${color}` }} />
                    ))}
                  </span>
                )}
              </div>
            ))}
          </fieldset>
          {error && (
            <p className="cp-error" role="alert">
              {error}
            </p>
          )}
          {!online && (
            <p className="cp-muted" role="status">
              Reconnect to save your avatar.
            </p>
          )}
          <div className="avatar-actions">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy || !online}>
              {busy ? "Saving…" : "Save avatar"}
            </Button>
          </div>
        </form>
      )}
      <small className="avatar-credit">
        Big Smile by{" "}
        <a href="https://www.ashleyseo.com/" target="_blank" rel="noreferrer">
          Ashley Seo
        </a>{" "}
        ·{" "}
        <a href="https://www.dicebear.com/styles/big-smile/" target="_blank" rel="noreferrer">
          DiceBear
        </a>{" "}
        ·{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
      </small>
    </Panel>
  );
}
