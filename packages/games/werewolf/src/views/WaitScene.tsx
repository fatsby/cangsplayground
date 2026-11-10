import { useEffect, useRef } from "react";
import type { SceneProps } from "./SceneProps.js";
import { stars } from "./effects.js";

/** SETUP and REVEAL: the roles are being dealt on the players' phones. */
export function WaitScene({ view }: Pick<SceneProps, "view">) {
  const sky = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sky.current && !sky.current.childElementCount) stars(sky.current, 70);
  }, []);
  return (
    <div className="scene sc-night">
      <div className="sky" />
      <div className="stars" ref={sky} />
      <div className="fog f1" />
      <div className="fog f2" />
      <div className="moonwrap" style={{ top: "44%" }}>
        <div className="moon">
          <i className="cr c1" />
          <i className="cr c2" />
          <i className="cr c3" />
        </div>
      </div>
      <div className="hl" style={{ left: 0, right: 0, top: "66%", fontSize: "3.4cqw" }}>
        WEREWOLF
      </div>
      <div
        style={{
          left: 0,
          right: 0,
          top: "77%",
          textAlign: "center",
          color: "#cfd3ff",
          fontWeight: 600,
          fontSize: "1.5cqw",
        }}
      >
        {view.stage === "REVEAL"
          ? "Look at your phone: your role is waiting."
          : "The village is getting ready."}
      </div>
    </div>
  );
}
