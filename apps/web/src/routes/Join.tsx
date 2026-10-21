import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Gamepad2, ArrowRight } from "lucide-react";
import { Button, Input, Panel } from "@clubplay/ui";
import { isValidLobbyCode, normalizeLobbyCode, PLAYER_NAME_MAX } from "@clubplay/core";
import { connect, readToken, request, saveToken } from "../socket";
export default function Join() {
  const params = useParams(),
    navigate = useNavigate();
  const [code, setCode] = useState(normalizeLobbyCode(params.code ?? "")),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [suggestion, setSuggestion] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (params.code && readToken("player", code)) navigate(`/play/${code}`, { replace: true });
  }, [code, navigate, params.code]);
  const submit = async () => {
    setError("");
    setSuggestion("");
    if (!isValidLobbyCode(code)) {
      setError("Enter the 6-character lobby code.");
      return;
    }
    if (name.trim().length < 1 || name.trim().length > PLAYER_NAME_MAX) {
      setError("Use a name with 1 to 20 letters.");
      return;
    }
    setBusy(true);
    connect();
    const result = await request("lobby:join", { code, name: name.trim() });
    setBusy(false);
    if (result.ok) {
      saveToken("player", code, result.data.playerToken);
      navigate(`/play/${code}`, { replace: true });
    } else {
      setError(result.error.message);
      setSuggestion(result.error.suggestion ?? "");
    }
  };
  return (
    <main className="mobile-screen join-screen">
      <div className="brand">
        <Gamepad2 strokeWidth={2.25} size={28} />
        <span>ClubPlay</span>
      </div>
      <div className="join-intro">
        <p className="eyebrow">YOUR GROUP IS WAITING</p>
        <h1>Come on in.</h1>
        <p className="cp-muted">Add your name. Join the fun.</p>
      </div>
      <Panel>
        <form
          className="cp-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input
            label="Lobby code"
            className="cp-code-input"
            value={code}
            onChange={(e) => setCode(normalizeLobbyCode(e.target.value))}
            maxLength={6}
            placeholder="ABC234"
            required
            autoComplete="off"
          />
          <Input
            label="Your name"
            placeholder="What should we call you?"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            required
            error={error}
          />
          {suggestion && (
            <Button
              onClick={() => {
                setName(suggestion);
                setError("");
                setSuggestion("");
              }}
            >
              Use “{suggestion}”
            </Button>
          )}
          <div className="cp-sticky-action">
            <Button variant="primary" size="lg" type="submit" disabled={busy}>
              {busy ? "Joining…" : "Join lobby"}
              <ArrowRight strokeWidth={2.25} />
            </Button>
          </div>
        </form>
      </Panel>
      <p className="join-note cp-muted">Your teacher has the lobby code.</p>
    </main>
  );
}
