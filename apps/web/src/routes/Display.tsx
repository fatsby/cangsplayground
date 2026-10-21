import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import { Maximize, ScanLine } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";
import { teamStyle } from "@clubplay/core";
import { Button, GroupCard, LobbyCodeDisplay, Switch, Waiting } from "@clubplay/ui";
import { useLobbyStore } from "../store";
import { readToken, request } from "../socket";
import { SessionBoundary, useRole } from "../components/session";
import { gameViews } from "../games/registry";
function QR({ value, label, size = 112 }: { value: string; label: string; size?: number }) {
  return (
    <div className="qr-frame">
      <QRCodeSVG value={value} size={size} marginSize={1} title={label} />
    </div>
  );
}
export default function Display() {
  const code = useParams().code!.toUpperCase(),
    error = useRole("projector", code);
  const { view, serverNow } = useLobbyStore();
  const [publicUrl, setPublicUrl] = useState(location.origin),
    [pair, setPair] = useState<{ pairToken: string; expiresAt: number } | null>(null),
    [pairError, setPairError] = useState(""),
    [pairing, setPairing] = useState(false),
    [now, setNow] = useState(Date.now()),
    [boost, setBoost] = useState(() => localStorage.getItem("clubplay:boost") !== "off"),
    [cursor, setCursor] = useState(true);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    revealed = useRef(new Set<string>()),
    reduced = useReducedMotion();
  const hostToken = readToken("host", code),
    session = view?.game,
    views = session ? gameViews[session.gameId] : undefined,
    Header = views?.ProjectorHeader,
    Extra = views?.ProjectorGroupCard;
  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && typeof data?.publicUrl === "string" && /^https?:\/\//.test(data.publicUrl))
          setPublicUrl(data.publicUrl.replace(/\/$/, ""));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(timer);
  }, [serverNow]);
  useEffect(() => {
    const root = document.documentElement;
    if (boost) root.dataset.boost = "projector";
    else delete root.dataset.boost;
    localStorage.setItem("clubplay:boost", boost ? "on" : "off");
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && !(event.target instanceof HTMLInputElement))
        setBoost((v) => !v);
    };
    window.addEventListener("keydown", key);
    return () => {
      delete root.dataset.boost;
      window.removeEventListener("keydown", key);
    };
  }, [boost]);
  useEffect(() => {
    const move = () => {
      setCursor(true);
      clearTimeout(cursorTimer.current);
      cursorTimer.current = setTimeout(() => setCursor(false), 3000);
    };
    move();
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      clearTimeout(cursorTimer.current);
    };
  }, []);
  useEffect(() => {
    if (view?.hostConnected) setPair(null);
  }, [view?.hostConnected]);
  useEffect(() => {
    if (!session || session.stage === "CONFIGURING") {
      revealed.current.clear();
      return;
    }
    const fresh = session.groups.filter(
      (g) => g.revealed && !revealed.current.has(`${session.gameId}-${g.groupId}-${g.round}`),
    );
    fresh.forEach((g) => revealed.current.add(`${session.gameId}-${g.groupId}-${g.round}`));
    if (!fresh.length || reduced) return;
    clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(
      () => {
        void confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: (view?.groups ?? []).map((g) => teamStyle(g.index).neon),
          disableForReducedMotion: true,
        });
      },
      Math.min(3200, fresh.length * 400),
    );
  }, [session, view?.groups, reduced]);
  useEffect(() => () => clearTimeout(confettiTimer.current), []);
  const makePair = async () => {
    if (!hostToken) return;
    setPairing(true);
    setPairError("");
    const result = await request("host:pair", { code, hostToken });
    setPairing(false);
    if (result.ok) setPair(result.data);
    else setPairError(result.error.message);
  };
  const columns = !view?.groups.length
    ? 2
    : view.groups.length <= 4
      ? 2
      : view.groups.length <= 6
        ? 3
        : 4;
  return (
    <SessionBoundary code={code} error={error} projector>
      <main className={`projector ${cursor ? "" : "cursor-hidden"}`}>
        <header className="projector-header">
          <LobbyCodeDisplay
            code={code}
            qr={<QR value={`${publicUrl}/join/${code}`} label={`Join lobby ${code}`} />}
          />
          <div className="projector-title">
            <h1>{session?.name ?? "ClubPlay"}</h1>
            <p className="cp-muted">
              {view?.locked
                ? "Lobby locked"
                : session?.stage === "ACTIVE"
                  ? "Now playing"
                  : "Join in. Play together."}
            </p>
          </div>
          <div className="projector-tools">
            <Switch label="Projector Boost" checked={boost} onCheckedChange={setBoost} />
            <Button
              variant="ghost"
              aria-label="Enter fullscreen"
              onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
            >
              <Maximize strokeWidth={2.25} />
            </Button>
          </div>
        </header>
        <LayoutGroup>
          <div className="projector-content">
            {session && (
              <div className="projector-public">
                {Header ? (
                  <Header session={session} />
                ) : session.publicInfo && typeof session.publicInfo === "object" ? (
                  Object.entries(session.publicInfo)
                    .filter(([, v]) => typeof v === "string")
                    .map(([key, value]) => <p key={key}>{String(value)}</p>)
                ) : null}
              </div>
            )}
            {!view ? (
              <Waiting message="Opening your lobby" />
            ) : !view.groups.length ? (
              <section className="projector-lobby">
                <div className="lobby-welcome">
                  <h2>
                    Your voice.
                    <br />
                    Your team.
                    <br />
                    <span className="cp-accent">Your turn.</span>
                  </h2>
                  <p className="cp-muted">Scan the code to join</p>
                  <p className="projector-join-url">
                    {publicUrl.replace(/^https?:\/\//, "")}/join/{code}
                  </p>
                  {hostToken && !view.hostConnected && (
                    <div className="pair-section">
                      {pair && pair.expiresAt > now ? (
                        <div className="pair-qr cp-row">
                          <QR
                            size={160}
                            value={`${publicUrl}/host/${code}#pair=${pair.pairToken}`}
                            label="Pair teacher phone"
                          />
                          <div>
                            <h3>Teacher only</h3>
                            <p>Scan to open Host Console</p>
                            <p className="cp-muted">
                              {Math.max(0, Math.ceil((pair.expiresAt - now) / 1000))}s left
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Button disabled={pairing} onClick={() => void makePair()}>
                          <ScanLine strokeWidth={2.25} />
                          {pairing ? "Making QR…" : "Pair host phone"}
                        </Button>
                      )}
                      {pairError && <p className="cp-error">{pairError}</p>}
                    </div>
                  )}
                </div>
                <div className="projector-players">
                  <div className="cp-row cp-spread">
                    <h2>Look who’s here</h2>
                    <span className="player-count">
                      {view.players.length}
                      <span> / {view.maxPlayers}</span>
                    </span>
                  </div>
                  {!view.players.length ? (
                    <Waiting message="Waiting for your players" />
                  ) : (
                    <ul className="projector-join-list">
                      {view.players.map((player, index) => (
                        <motion.li
                          layoutId={`player-${player.id}`}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: reduced ? 0.15 : 0.25,
                            delay: Math.min(index * 0.03, 1),
                          }}
                          className="cp-person"
                          key={player.id}
                        >
                          {player.name}
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ) : (
              <section
                key={view.groupsVersion}
                className="projector-grid"
                style={{
                  gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
                  gridTemplateRows: `repeat(${view.groups.length <= 2 ? 1 : Math.ceil(view.groups.length / columns)},minmax(0,1fr))`,
                }}
              >
                {view.groups.map((group, index) => {
                  const runtime = session?.groups.find((g) => g.groupId === group.id);
                  return (
                    <motion.div
                      layout
                      key={group.id}
                      className="projector-group-wrap"
                      style={
                        {
                          "--member-columns":
                            view.groups.length <= 4 && group.playerIds.length > 10
                              ? group.playerIds.length > 30
                                ? 4
                                : view.groups.length <= 2
                                  ? 2
                                  : 3
                              : 2,
                        } as CSSProperties
                      }
                      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 24 }}
                      animate={{ opacity: 1, scale: 1, y: 0, rotateY: runtime?.revealed ? 360 : 0 }}
                      transition={{
                        duration: reduced ? 0.15 : 0.4,
                        delay: Math.min(index * (runtime?.revealed ? 0.4 : 0.03), 1.6),
                      }}
                    >
                      <GroupCard
                        group={group}
                        players={view.players}
                        game={runtime}
                        serverNow={serverNow}
                        renderMember={(player, id) => (
                          <motion.span
                            layoutId={`player-${id}`}
                            transition={{
                              duration: reduced ? 0.15 : 0.4,
                              delay: Math.min(index * 0.03, 1.5),
                            }}
                          >
                            {player?.name ?? "Player"}
                          </motion.span>
                        )}
                      >
                        {session && runtime && Extra && (
                          <Extra
                            lobby={view}
                            session={session}
                            group={runtime}
                            serverNow={serverNow}
                          />
                        )}
                      </GroupCard>
                    </motion.div>
                  );
                })}
              </section>
            )}
          </div>
        </LayoutGroup>
        {view && view.groups.length > 0 && hostToken && !view.hostConnected && (
          <div className="projector-pair-small">
            {pair && pair.expiresAt > now ? (
              <>
                <QR
                  value={`${publicUrl}/host/${code}#pair=${pair.pairToken}`}
                  label="Pair teacher phone"
                />
                <span>Teacher only · Scan to pair</span>
              </>
            ) : (
              <Button disabled={pairing} onClick={() => void makePair()}>
                Pair host phone
              </Button>
            )}
          </div>
        )}
        <footer className="projector-footer">
          <span>ClubPlay</span>
          <span>
            {view?.players.length ?? 0} players · {view?.groups.length ?? 0} teams
          </span>
          <span>Listen. Speak. Connect.</span>
        </footer>
      </main>
    </SessionBoundary>
  );
}
