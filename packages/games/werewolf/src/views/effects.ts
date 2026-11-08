/**
 * DOM effects used by the cinematic scenes: blood, claw slashes, shattering portraits, stars.
 * They draw into a container element owned by a view (never into React-managed children), so a
 * view can clear them by emptying the container. Ported from the approved mockup (screens.html).
 */
const NS = "http://www.w3.org/2000/svg";
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Restarts a CSS animation class on `el`. */
export function replay(el: Element, cls = "play"): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

function blobPath(r: number, n = 16, jag = 0.38): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = r * (1 - jag / 2 + Math.random() * jag * (i % 2 ? 1.25 : 0.7));
    pts.push([Math.cos(a) * k, Math.sin(a) * k]);
  }
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p = pts[(i + 1) % n]!;
    const q = pts[i]!;
    d += ` Q${q[0].toFixed(1)},${q[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)},${((p[1] + q[1]) / 2).toFixed(1)}`;
  }
  return d + "Z";
}

export interface SplatOptions {
  delay?: number;
  drips?: boolean;
  droplets?: number;
}

/** Adds one blood splat (blob, flung droplets, drips) at x/y percent of `layer`; size is percent of its width. */
export function bloodSplat(
  layer: HTMLElement,
  x: number,
  y: number,
  size = 26,
  opts: SplatOptions = {},
): SVGSVGElement {
  const { delay = 0, drips = true, droplets = 26 } = opts;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "-150 -150 300 300");
  svg.setAttribute("class", "splat");
  svg.style.cssText = `left:${x}%;top:${y}%;width:${size}%;--delay:${delay}ms`;
  const id = "bg" + Math.random().toString(36).slice(2, 7);
  let h = `<defs><radialGradient id="${id}" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#ff3b57"/><stop offset=".55" stop-color="#c1121f"/><stop offset="1" stop-color="#5d0610"/></radialGradient></defs>`;
  h += `<path class="blob" d="${blobPath(rand(58, 72))}" fill="url(#${id})"/>`;
  h += `<path class="blob b2" d="${blobPath(rand(30, 42), 12, 0.5)}" fill="#ff5b73" opacity=".35" transform="translate(-14,-16)"/>`;
  for (let i = 0; i < droplets; i++) {
    const a = rand(0, Math.PI * 2);
    const dist = rand(80, 150);
    const r = rand(2, 9) * (dist < 110 ? 1.3 : 1);
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist;
    h += `<g class="drop" style="--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--d:${rand(0, 90).toFixed(0)}ms"><circle r="${r.toFixed(1)}" fill="#b30f1d"/></g>`;
    if (r > 6.5)
      h += `<line class="streak" pathLength="1" x1="0" y1="0" x2="${(dx * 0.62).toFixed(0)}" y2="${(dy * 0.62).toFixed(0)}" stroke="#a50e1c" stroke-width="${(r * 0.3).toFixed(1)}" stroke-linecap="round" style="--d:${rand(0, 60).toFixed(0)}ms"/>`;
  }
  if (drips)
    for (let i = 0; i < 5; i++) {
      const xx = rand(-50, 50);
      const w = rand(5, 10);
      const len = rand(50, 130);
      const t = rand(1.6, 3.2).toFixed(1);
      const d = rand(200, 900).toFixed(0);
      h += `<rect class="drip" x="${xx.toFixed(0)}" y="30" width="${w.toFixed(1)}" height="${len.toFixed(0)}" rx="${(w / 2).toFixed(1)}" fill="#a50e1c" style="--t:${t}s;--d:${d}ms"/>`;
      h += `<circle class="drip-end" cx="${(xx + w / 2).toFixed(0)}" cy="${(30 + len).toFixed(0)}" r="${(w * 0.85).toFixed(1)}" fill="#a50e1c" style="--t:${t}s;--d:${d}ms"/>`;
    }
  h += `<ellipse cx="-22" cy="-30" rx="14" ry="7" fill="#fff" opacity=".28" transform="rotate(-30 -22 -30)"/>`;
  svg.innerHTML = h;
  layer.appendChild(svg);
  requestAnimationFrame(() => svg.classList.add("go"));
  return svg;
}

/** Drips running down from the top edge of `layer`. `wMul` scales their width (use >1 on phones). */
export function bloodCurtain(layer: HTMLElement, count = 9, wMul = 1): void {
  for (let i = 0; i < count; i++) {
    const d = document.createElement("i");
    d.className = "curtain-drip";
    d.style.cssText = `left:${((i + rand(0.1, 0.9)) / count) * 100}%;--w:${(rand(0.5, 1.4) * wMul).toFixed(2)}cqw;--len:${rand(16, 52).toFixed(0)}%;--t:${rand(2, 4.5).toFixed(1)}s;--d:${rand(0, 700).toFixed(0)}ms`;
    layer.appendChild(d);
  }
}

/** Three diagonal claw slashes drawn on, then burning off. */
export function clawSlash(layer: HTMLElement): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 160 90");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "claws");
  const paths = ["M22,-4 Q60,38 112,96", "M44,-8 Q84,36 134,96", "M68,-8 Q104,30 150,88"];
  svg.innerHTML = paths
    .map(
      (d, i) =>
        `<path d="${d}" pathLength="1" class="cl core" style="--i:${i}"/><path d="${d}" pathLength="1" class="cl glow" style="--i:${i}"/>`,
    )
    .join("");
  layer.appendChild(svg);
  requestAnimationFrame(() => svg.classList.add("go"));
  return svg;
}

/**
 * Breaks `el` into falling shards plus ash. Identical for every role: banishment must not hint at
 * what the player was. `el`'s parent must be positioned.
 */
export function shatter(el: HTMLElement, shards = 9): void {
  const host = el.parentElement;
  if (!host) return;
  const r = el.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const clips: string[] = [];
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 3; x++) {
      const x0 = (x / 3) * 100;
      const x1 = ((x + 1) / 3) * 100;
      const y0 = (y / 3) * 100;
      const y1 = ((y + 1) / 3) * 100;
      const j = () => rand(-9, 9);
      clips.push(
        `polygon(${x0 + j()}% ${y0 + j()}%,${x1 + j()}% ${y0 + j()}%,${x1 + j()}% ${y1 + j()}%,${x0 + j()}% ${y1 + j()}%)`,
      );
    }
  clips.slice(0, shards).forEach((clip, i) => {
    const s = el.cloneNode(true) as HTMLElement;
    s.classList.add("shard");
    s.classList.remove("lit");
    s.style.cssText += `;position:absolute;left:${r.left - hr.left}px;top:${r.top - hr.top}px;width:${r.width}px;height:${r.height}px;margin:0;clip-path:${clip};--sx:${rand(-120, 120).toFixed(0)}px;--sy:${rand(-60, 40).toFixed(0)}px;--sr:${rand(-70, 70).toFixed(0)}deg;--sd:${i * 18}ms`;
    host.appendChild(s);
    setTimeout(() => s.remove(), 2600);
  });
  for (let i = 0; i < 22; i++) {
    const a = document.createElement("i");
    a.className = "ash";
    a.style.cssText = `left:${r.left - hr.left + rand(0, r.width)}px;top:${r.top - hr.top + rand(0, r.height)}px;--ax:${rand(-60, 60).toFixed(0)}px;--ay:${rand(-140, -40).toFixed(0)}px;--ad:${rand(0, 400).toFixed(0)}ms;width:${rand(3, 8).toFixed(0)}px;height:${rand(3, 8).toFixed(0)}px`;
    host.appendChild(a);
    setTimeout(() => a.remove(), 2600);
  }
}

/** Twinkling stars; `mul` scales their size (use ~4 on phones). */
export function stars(layer: HTMLElement, n = 70, mul = 1): void {
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i");
    s.className = "star";
    s.style.cssText = `left:${rand(0, 100)}%;top:${rand(0, 70)}%;--s:${(rand(0.1, 0.32) * mul).toFixed(2)}cqw;--t:${rand(2, 5).toFixed(1)}s;--dl:${rand(0, 4).toFixed(1)}s;opacity:${rand(0.3, 1).toFixed(2)}`;
    layer.appendChild(s);
  }
}
