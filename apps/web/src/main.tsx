import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "@fontsource-variable/unbounded";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-500.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles.css";
const Home = lazy(() => import("./routes/Home"));
const Join = lazy(() => import("./routes/Join"));
const Player = lazy(() => import("./routes/Player"));
const Host = lazy(() => import("./routes/Host"));
const Display = lazy(() => import("./routes/Display"));
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          Opening CangsPlayground…
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/play/:code" element={<Player />} />
        <Route path="/host/:code" element={<Host />} />
        <Route path="/display/:code" element={<Display />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Suspense>
  </BrowserRouter>,
);
