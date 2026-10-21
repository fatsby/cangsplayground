import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Gamepad2, ArrowRight, Monitor, Users, Mic } from "lucide-react";
import { Button, Chip, Input, Panel } from "@clubplay/ui";
import { isValidLobbyCode, normalizeLobbyCode } from "@clubplay/core";
import { connect, request, saveToken } from "../socket";
export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    setError("");
    connect();
    const result = await request("lobby:create", {});
    setBusy(false);
    if (result.ok) {
      saveToken("host", result.data.code, result.data.hostToken);
      navigate(`/display/${result.data.code}`);
    } else setError(result.error.message);
  };
  return (
    <main className="home">
      <header className="brand">
        <Gamepad2 strokeWidth={2.25} size={32} />
        <span>ClubPlay</span>
        <Chip>Class time. Play time.</Chip>
      </header>
      <section className="home-hero">
        <div className="cp-stack">
          <p className="eyebrow">A LITTLE PLAY. A LOT TO SAY.</p>
          <h1>
            Good games.
            <br />
            <span>Great talks.</span>
          </h1>
          <p className="home-intro">
            Get your class talking.
            <br />
            Make teams, pick a game, and play together.
          </p>
          <div className="cp-row home-features">
            <span>
              <Users strokeWidth={2.25} />
              Make teams
            </span>
            <span>
              <Mic strokeWidth={2.25} />
              Take turns
            </span>
            <span>
              <Monitor strokeWidth={2.25} />
              Play together
            </span>
          </div>
        </div>
        <Panel className="entry-panel cp-stack">
          <Chip>Ready to play?</Chip>
          <h2>Bring your class together</h2>
          <p className="cp-muted">Teacher? Open this on the class screen.</p>
          <Button variant="primary" size="lg" onClick={() => void create()} disabled={busy}>
            {busy ? "Creating…" : "Create lobby"}
            <ArrowRight strokeWidth={2.25} />
          </Button>
          {error && (
            <p className="cp-error" role="alert">
              {error}
            </p>
          )}
          <div className="entry-divider">Here to join?</div>
          <form
            className="cp-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const normalized = normalizeLobbyCode(code);
              if (isValidLobbyCode(normalized)) navigate(`/join/${normalized}`);
              else setError("Enter the 6-character lobby code.");
            }}
          >
            <Input
              label="Lobby code"
              className="cp-code-input"
              placeholder="ABC234"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(normalizeLobbyCode(e.target.value))}
              required
            />
            <Button type="submit">
              Join lobby
              <ArrowRight strokeWidth={2.25} />
            </Button>
          </form>
          <Link className="quiet-link" to="/join">
            Join with your name
          </Link>
        </Panel>
      </section>
      <footer>Everyone has a voice. Let’s hear yours.</footer>
    </main>
  );
}
