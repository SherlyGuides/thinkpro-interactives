// ThinkPro Academy — interactive page kit (window.TPI).
// The house video frame (vector slate backdrop, 85px floor, logo plate, heading
// notch, one-line floor caption) for INTERACTIVE pages: no timeline, the learner
// drives the state. Vanilla JS, no build step, so a page embeds in the LMS as a
// plain iframe. Authored at 1920×1080 and scaled to fit the window.
// Load order: theme.js → interactive-kit.js → your page script.
(function () {
  const T = window.TP_THEME || {};
  const COL = Object.assign({
    stage: "#3D495B", floor: "#2E3846", fill: "#3C4B5C", fillLo: "#33414F",
    outline: "#F28C3E", white: "#FFFFFF", dim: "rgba(255,255,255,0.62)",
    tint: "rgba(255,255,255,0.06)", line: "rgba(255,255,255,0.85)",
    pill: "rgba(51,56,69,0.40)", warm: "#F28C3E", rust: "#BB3B16", cool: "#87A2C6",
    green: "#7FB89A", pink: "#C58BB0",
  }, T);
  const SANS = "system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const W = 1920, H = 1080, FLOOR_H = 85, GROUND_Y = H - FLOOR_H - 6;
  // Same vector backdrop as StageFrame (stage-kit.jsx).
  const BG = [
    "radial-gradient(120% 90% at 50% 4%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.05) 34%, rgba(255,255,255,0) 62%)",
    "radial-gradient(90% 70% at 12% 96%, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0) 60%)",
    "radial-gradient(90% 70% at 88% 96%, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 60%)",
    "linear-gradient(178deg, #4A566A 0%, #414D60 44%, #384453 100%)",
  ].join(", ");

  const CSS = `
html,body{margin:0;height:100%;background:#20272F;overflow:hidden;touch-action:none}
.tpi-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.tpi-stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:top left;overflow:hidden;
  font-family:${SANS};color:#fff;user-select:none;-webkit-user-select:none;background:${BG}}
.tpi-floor{position:absolute;left:0;right:0;bottom:0;height:${FLOOR_H}px;background:${COL.floor};
  border-top:2px solid rgba(255,255,255,0.10);box-shadow:0 -18px 40px rgba(0,0,0,0.22)}
.tpi-logo{position:absolute;right:60px;bottom:${FLOOR_H + 33 - 70}px;background:#fff;border-radius:26px;overflow:hidden;z-index:5}
.tpi-logo img{display:block;width:320px;height:auto}
.tpi-heading{position:absolute;top:0;left:0;right:0;display:flex;justify-content:center;pointer-events:none;z-index:4}
.tpi-heading span{display:inline-flex;padding:26px 56px 24px;border-radius:0 0 44px 44px;background:#20272F;
  border-bottom:2px solid rgba(255,255,255,0.10);box-shadow:0 14px 36px rgba(0,0,0,0.20);
  font-weight:700;font-size:46px;line-height:1.1;letter-spacing:-0.01em;white-space:nowrap}
.tpi-caption{position:absolute;left:0;right:600px;bottom:0;height:${FLOOR_H}px;display:flex;align-items:center;justify-content:center;
  padding:0 60px;box-sizing:border-box;font-size:44px;line-height:1.2;white-space:nowrap;transition:opacity .25s;z-index:4;pointer-events:none}
.tpi-tag{display:inline-flex;align-items:center;gap:12px;padding:10px 24px;border-radius:999px;box-shadow:0 0 0 2px ${COL.line};
  background:${COL.pill};font-size:26px;white-space:nowrap}
.tpi-tag i{width:10px;height:10px;border-radius:50%;background:${COL.line}}
.tpi-badge{display:inline-flex;padding:10px 22px;border-radius:18px;box-shadow:0 0 0 2px ${COL.white};background:${COL.tint};
  font-weight:700;font-size:24px;letter-spacing:0.12em;text-transform:uppercase;white-space:nowrap}
.tpi-btn{font:inherit;font-size:26px;color:#fff;background:${COL.pill};border:0;border-radius:999px;padding:14px 28px;
  box-shadow:0 0 0 2px ${COL.line};cursor:pointer}
.tpi-btn:hover{box-shadow:0 0 0 3px ${COL.warm}}
.tpi-btn.on{background:${COL.warm};box-shadow:0 0 0 2px ${COL.warm};font-weight:700}
`;

  function el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }

  // mount({ heading }) → { stage, caption(text), toStage(evt), COL, SANS, W, H, GROUND_Y }
  function mount(opts = {}) {
    el("style", null, document.head).textContent = CSS;
    const wrap = el("div", "tpi-wrap", document.body);
    const stage = el("div", "tpi-stage", wrap);
    el("div", "tpi-floor", stage);
    const logo = el("div", "tpi-logo", stage);
    const img = el("img", null, logo);
    img.src = (window.TP_ASSETS || "../../design-system/assets/") + "thinkpro-logo.png";
    img.alt = "ThinkPro Academy";
    if (opts.heading) el("span", null, el("div", "tpi-heading", stage)).textContent = opts.heading;
    const cap = el("div", "tpi-caption", stage);

    let scale = 1, ox = 0, oy = 0;
    function fit() {
      scale = Math.min(innerWidth / W, innerHeight / H);
      ox = (innerWidth - W * scale) / 2; oy = (innerHeight - H * scale) / 2;
      stage.style.transform = `translate(${ox}px,${oy}px) scale(${scale})`;
    }
    addEventListener("resize", fit); fit();

    // One-line floor caption. Holds each line at least `hold` seconds so quick
    // events don't flicker; newer captions queue in order (max 3, no repeats).
    let capUntil = 0, queue = [], capTimer = null;
    // force = true replaces whatever is showing and clears the queue.
    function caption(text, hold = 2.6, force = false) {
      const now = performance.now() / 1000;
      if (force) { queue = []; clearTimeout(capTimer); capTimer = null; if (cap.textContent !== text) show(text, hold); return; }
      if (cap.textContent === text && !queue.length) { capUntil = Math.max(capUntil, now + hold); return; }
      if (now < capUntil) {
        if (!queue.some(q => q[0] === text)) { queue.push([text, hold]); if (queue.length > 3) queue.shift(); }
        if (!capTimer) capTimer = setTimeout(flush, (capUntil - now) * 1000);
        return;
      }
      show(text, hold);
    }
    function show(text, hold) {
      cap.style.opacity = 0;
      setTimeout(() => { cap.textContent = text; cap.style.opacity = 1; }, 250);
      capUntil = performance.now() / 1000 + hold + 0.25;
    }
    function flush() {
      capTimer = null;
      const next = queue.shift();
      if (!next) return;
      show(next[0], next[1]);
      if (queue.length) capTimer = setTimeout(flush, (next[1] + 0.25) * 1000);
    }

    function toStage(e) { return { x: (e.clientX - ox) / scale, y: (e.clientY - oy) / scale }; }
    return { stage, caption, toStage, el, COL, SANS, W, H, GROUND_Y, FLOOR_H };
  }

  window.TPI = { mount, el, COL, SANS, W, H, GROUND_Y, FLOOR_H };
})();
