import {
  Button,
  Chip,
  Panel,
  PlayerIdentity,
  TeamBadge,
  Timer,
  type GameViewProps,
  type SessionViewProps,
} from "@cangsplayground/ui";
import type { GameSessionView, LobbyView } from "@cangsplayground/core";
import type { SharkTankView } from "../types.js";
import { prepLabels, stageLabels, useStageTime } from "./projector.js";

export function HostGroupPanel({ session, group }: GameViewProps) {
  const shared = session.shared as SharkTankView | undefined;
  const idea = shared?.companies.find((company) => company.groupId === group.groupId)?.idea;
  if (!idea) return <span>No idea assigned yet.</span>;
  return (
    <span className="cp-stack">
      <strong>
        {idea.emoji} {idea.name}
      </strong>
      <span>{idea.pitch}</span>
    </span>
  );
}

function nextLabel(shared: SharkTankView) {
  switch (shared.stage) {
    case "PREP":
      return "Start pitches";
    case "PITCH":
      return "Start Q&A";
    case "QA":
      return "Start team talk";
    case "HUDDLE": {
      const buyers = shared.companies.filter(
        (company) =>
          company.groupId !== shared.presenter &&
          company.eligible === true &&
          company.members.length > 0,
      );
      const ready = buyers.filter((company) => company.voted).length;
      return ready === buyers.length
        ? "Show decisions"
        : `Lock votes (${ready}/${buyers.length} groups ready)`;
    }
    case "DECISION":
      return shared.order
        ?.slice((shared.presenterIndex ?? 0) + 1)
        .some((id) => shared.companies.some((c) => c.groupId === id && c.members.length))
        ? "Next group"
        : "Show results";
    case "RESULTS":
      return "I bought… round";
    case "CLOSING":
      return "Next speaker";
  }
}
export function HostSessionPanel({
  lobby,
  session,
  serverNow,
  busy = false,
  hostAct,
}: SessionViewProps) {
  const shared = session.shared as SharkTankView;
  const { timed, expired } = useStageTime(shared, serverNow);
  const disabled = busy || !hostAct;
  const name = (id: string) => lobby.players.find((p) => p.id === id)?.name ?? "Player";
  const finalSpeaker =
    shared.stage === "CLOSING" &&
    (!shared.closing || shared.closing.index >= shared.closing.order.length - 1);
  const missingPrice = shared.stage === "PREP" && shared.companies.some((c) => c.price === null);
  return (
    <div className="cp-stack st-host">
      <Panel className="cp-stack st-host-controls">
        <h2>{stageLabels[shared.stage]}</h2>
        {timed && <Timer timer={shared.timer} serverNow={serverNow} />}
        {expired && (
          <p className="st-time-up" role="status">
            Time's up
          </p>
        )}
        {missingPrice && (
          <p className="cp-error" role="alert">
            Some groups have not set a price. Starting pitches will use the middle of the price
            range for them.
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          disabled={disabled || finalSpeaker || shared.presenterIndex === null}
          onClick={() =>
            void hostAct?.({
              type: "st:next",
              payload: { from: shared.stage, presenterIndex: shared.presenterIndex },
            })
          }
        >
          {nextLabel(shared)}
        </Button>
        {finalSpeaker && (
          <p className="cp-muted">
            The closing circle is complete. Exit the game when everyone is finished.
          </p>
        )}
        {timed && (
          <div className="cp-row">
            {shared.timer.pausedRemainingMs !== null ? (
              <Button disabled={disabled} onClick={() => void hostAct?.({ type: "st:resume" })}>
                Resume
              </Button>
            ) : (
              <Button
                disabled={disabled || shared.timer.endsAt === null}
                onClick={() => void hostAct?.({ type: "st:pause" })}
              >
                Pause
              </Button>
            )}
            <Button
              disabled={
                disabled ||
                (shared.timer.endsAt === null && shared.timer.pausedRemainingMs === null)
              }
              onClick={() => void hostAct?.({ type: "st:extend" })}
            >
              +30s
            </Button>
          </div>
        )}
      </Panel>
      {(shared.stage === "QA" || shared.stage === "HUDDLE") && (
        <Panel className="cp-stack">
          <h2>Who asked a question?</h2>
          <p className="cp-muted">
            Tap a name to mark or unmark a question. Locked groups cannot change during the team
            talk.
          </p>
          {shared.companies
            .filter((c) => c.groupId !== shared.presenter)
            .map((company) => (
              <section key={company.groupId}>
                <h3>
                  <TeamBadge
                    teamIndex={lobby.groups.find((g) => g.id === company.groupId)?.index ?? 0}
                  />
                </h3>
                <div className="cp-row">
                  {company.members.map((id) => (
                    <Button
                      key={id}
                      aria-pressed={shared.asked?.includes(id) ?? false}
                      variant={shared.asked?.includes(id) ? "accent" : "secondary"}
                      disabled={disabled || (shared.stage === "HUDDLE" && company.voted)}
                      onClick={() =>
                        void hostAct?.({ type: "st:asked", payload: { playerId: id } })
                      }
                    >
                      <span className="st-name" title={name(id)}>
                        <PlayerIdentity
                          player={lobby.players.find((p) => p.id === id)}
                          playerId={id}
                          size={28}
                        />
                      </span>
                    </Button>
                  ))}
                </div>
              </section>
            ))}
        </Panel>
      )}
      <Panel>
        <h2>Group status</h2>
        <div className="st-status-scroll">
          <table className="st-status-table">
            <caption className="cp-sr-only">Preparation, help and live finances by group</caption>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Progress</th>
                <th scope="col">Help</th>
                <th scope="col">Wallet</th>
                <th scope="col">Purchases</th>
                <th scope="col">Money earned</th>
              </tr>
            </thead>
            <tbody>
              {shared.companies.map((company) => (
                <tr key={company.groupId}>
                  <th scope="row">
                    <TeamBadge
                      teamIndex={lobby.groups.find((g) => g.id === company.groupId)?.index ?? 0}
                    />
                  </th>
                  <td data-label="Progress">
                    {shared.stage === "PREP" ? (
                      <>
                        <p>
                          Step {company.prepStep}: {prepLabels[company.prepStep]}
                        </p>
                        {company.price === null ? (
                          <Chip>Price not set</Chip>
                        ) : (
                          <span>Price: ${company.price}</span>
                        )}
                      </>
                    ) : shared.stage === "HUDDLE" ? (
                      company.groupId === shared.presenter ? (
                        "Presenting"
                      ) : (
                        <>
                          <span>
                            {
                              company.members.filter((id) => Object.hasOwn(company.votes ?? {}, id))
                                .length
                            }
                            /{company.members.length} voted
                          </span>
                          {company.voted && <p>✓ Locked</p>}
                          {company.eligible === false && <p>Can't buy (no question)</p>}
                        </>
                      )
                    ) : company.price !== null ? (
                      `Price: $${company.price}`
                    ) : (
                      "Price not set"
                    )}
                    {company.priceAuto && <p className="cp-muted">Price chosen automatically</p>}
                  </td>
                  <td data-label="Help">
                    {company.help ? (
                      <>
                        <p className="cp-error">Need help</p>
                        <Button
                          disabled={disabled}
                          onClick={() =>
                            void hostAct?.({
                              type: "st:clearHelp",
                              payload: { groupId: company.groupId },
                            })
                          }
                        >
                          Clear help
                        </Button>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="Wallet">${company.wallet ?? 0}</td>
                  <td data-label="Purchases">
                    {company.purchases?.length ? (
                      <ul>
                        {company.purchases.map((purchase) => (
                          <li key={purchase.seller}>
                            <span className="st-purchase-name">
                              {lobby.groups.find((g) => g.id === purchase.seller)?.name ?? "Group"}
                            </span>{" "}
                            <span className="st-purchase-amount">
                              {purchase.quantity} × ${purchase.price}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "None"
                    )}
                  </td>
                  <td data-label="Money earned">${company.revenue ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
export function HostConfigNote({ lobby, session }: { lobby: LobbyView; session: GameSessionView }) {
  if (!lobby.groups.length) return null;
  const money = Number(session.config?.moneyPerMember ?? 100);
  return (
    <p className="cp-muted">
      {lobby.groups
        .map(
          (group) =>
            `Group ${group.index + 1} (${group.playerIds.length}): $${group.playerIds.length * money}`,
        )
        .join(" · ")}
    </p>
  );
}
