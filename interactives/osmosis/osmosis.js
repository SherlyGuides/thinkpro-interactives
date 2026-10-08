// Osmosis Lab — drag particles into a tank split by a semi-permeable membrane.
// Water slips through the pores; ions and sugar are too big (unless the learner
// switches to large pores). Water drifts toward the side with more trapped
// solute until the extra height of water pushes back and the levels settle.
(function () {
  const { mount, COL, SANS } = window.TPI;
  const ui = mount({ heading: "Osmosis: what can cross?" });
  const { stage, caption, toStage, el, GROUND_Y } = ui;

  // ---- Geometry (1920×1080 stage px). Tank stays left of the no-go zone. ----
  const X0 = 300, X1 = 1260, MX = 780, BY = GROUND_Y, TY = 300, WALL = 5;
  const H0 = 340;                       // starting liquid height on each side
  const HMAX = BY - TY - 40, HMIN = 70;
  const N_WATER0 = 110;                 // water molecules per side at the start
  const VOL = H0 / N_WATER0;            // liquid height carried by one water molecule

  // ---- Particle kinds ------------------------------------------------------
  const KINDS = {
    water: { name: "Water", sub: "H₂O molecule", r: 8, color: COL.cool, vmax: 230, label: "" },
    na:    { name: "Sodium", sub: "Na⁺ ion", r: 20, color: COL.warm, vmax: 120, label: "Na⁺" },
    cl:    { name: "Chloride", sub: "Cl⁻ ion", r: 24, color: COL.green, vmax: 105, label: "Cl⁻" },
    sugar: { name: "Sugar", sub: "glucose molecule", r: 32, color: COL.pink, vmax: 80, label: "sugar", hex: true },
  };
  const PORES = { small: 10, large: 26 };   // largest radius that fits through
  let pore = "small";
  const fits = k => KINDS[k].r <= PORES[pore];

  // ---- Osmosis model -------------------------------------------------------
  // Each side's "push" of water through the membrane:
  //   f = 1 − A·c + G·(h_this − h_other)
  // c = trapped-solute particles per 400px of liquid. Trapped solute holds water
  // back on its side; a taller column pushes water out. The level moves
  // smoothly, dh_A/dt = K·(f_B − f_A), settling at h_A − h_B = A·(c_A − c_B) / 2G.
  // Water molecules then cross at the membrane so each side's count follows its
  // level, so the crossings you see match the flow.
  const A = 0.02, G = 0.0012, K = 1 / (20 * G), BASE = 0.35;

  let parts = [], level = [H0, H0], flux = 0, paused = false, flashes = [];
  let calmFor = 0, flowed = false, lastSaid = {};
  let balance = 0;   // f_A − f_B: near 0 once the levels have settled
  let mode = "explore";

  const rnd = (a, b) => a + Math.random() * (b - a);
  const surfY = s => BY - level[s];
  const sideOf = x => (x < MX ? 0 : 1);
  const xMin = s => (s === 0 ? X0 + WALL : MX);
  const xMax = s => (s === 0 ? MX : X1 - WALL);

  function add(kind, side, x, y) {
    const k = KINDS[kind];
    const sy = surfY(side);
    if (x == null) x = rnd(xMin(side) + k.r + 4, xMax(side) - k.r - 4);
    if (y == null) y = rnd(sy + k.r + 4, BY - k.r - 4);
    x = Math.min(Math.max(x, xMin(side) + k.r + 2), xMax(side) - k.r - 2);
    y = Math.min(Math.max(y, sy + k.r + 2), BY - k.r - 2);
    const a = rnd(0, Math.PI * 2);
    parts.push({ kind, r: k.r, x, y, vx: Math.cos(a) * k.vmax * 0.5, vy: Math.sin(a) * k.vmax * 0.5,
      side, crossing: false, born: performance.now() });
  }
  function reset() {
    parts = []; level = [H0, H0]; flux = 0; flashes = []; calmFor = 0; flowed = false; lastSaid = {};
    for (let s = 0; s < 2; s++) for (let i = 0; i < N_WATER0; i++) add("water", s);
    say("start", "Drag particles into either side of the tank.", 0);
  }
  // Caption once per key, then not again for `gap` seconds. Silent in Guided
  // mode: there the lesson script owns the caption.
  function say(key, text, gap = 10) {
    if (mode === "guided") return;
    const now = performance.now() / 1000;
    if (lastSaid[key] && now - lastSaid[key] < gap) return;
    lastSaid[key] = now;
    caption(text);
  }

  const count = (side, kind) => parts.reduce((n, p) => n + (p.side === side && !p.crossing && p.kind === kind ? 1 : 0), 0);
  function trappedConc(side) {
    let n = 0;
    for (const p of parts) if (p.side === side && p.kind !== "water" && !fits(p.kind)) n++;
    return (n * 400) / level[side];
  }

  // ---- Simulation step -----------------------------------------------------
  let net = 0;   // water molecules crossing this step (+ = A→B)
  function step(dt) {
    const cA = trappedConc(0), cB = trappedConc(1);
    const f = [1 - A * cA + G * (level[0] - level[1]), 1 - A * cB + G * (level[1] - level[0])];
    balance = f[0] - f[1];
    let dh = K * (f[1] - f[0]) * dt;
    dh = Math.max(Math.min(dh, HMAX - level[0], level[1] - HMIN), HMIN - level[0], level[1] - HMAX);
    level[0] += dh; level[1] -= dh;
    const nW = [count(0, "water"), count(1, "water")];
    net = 0;

    // Soft repulsion between solute particles so they don't pile up.
    const sol = parts.filter(p => p.kind !== "water");
    for (let i = 0; i < sol.length; i++) for (let j = i + 1; j < sol.length; j++) {
      const p = sol[i], q = sol[j], dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy, m = p.r + q.r + 4;
      if (d2 > 0 && d2 < m * m) {
        const d = Math.sqrt(d2), push = ((m - d) / m) * 400 * dt;
        p.vx -= (dx / d) * push; p.vy -= (dy / d) * push; q.vx += (dx / d) * push; q.vy += (dy / d) * push;
      }
    }

    for (const p of parts) {
      const k = KINDS[p.kind];
      // Random walk: jitter, gentle drag, speed cap by size.
      p.vx += rnd(-1, 1) * k.vmax * 6 * dt; p.vy += rnd(-1, 1) * k.vmax * 6 * dt;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > k.vmax) { p.vx *= k.vmax / sp; p.vy *= k.vmax / sp; }
      p.x += p.vx * dt; p.y += p.vy * dt;

      const s = p.side;
      if (p.crossing) {
        const top = Math.max(surfY(0), surfY(1)) + p.r;
        if (p.y < top) { p.y = top; p.vy = Math.abs(p.vy); }
        if (p.y > BY - p.r) { p.y = BY - p.r; p.vy = -Math.abs(p.vy); }
        const ns = sideOf(p.x);
        if (ns !== p.side) { if (p.kind === "water") net += ns === 1 ? 1 : -1; p.side = ns; }
        if (Math.abs(p.x - MX) > p.r + 1) p.crossing = false;
        continue;
      }
      // Outer walls and surface/bottom.
      const lo = xMin(s) + p.r, hi = xMax(s) - p.r;
      if (s === 0 && p.x < lo) { p.x = lo; p.vx = Math.abs(p.vx); }
      if (s === 1 && p.x > hi) { p.x = hi; p.vx = -Math.abs(p.vx); }
      const top = surfY(s) + p.r;
      if (p.y < top) { p.y = top; p.vy = Math.abs(p.vy) * 0.6; }
      if (p.y > BY - p.r) { p.y = BY - p.r; p.vy = -Math.abs(p.vy); }

      // Membrane contact.
      const atMembrane = s === 0 ? p.x > hi : p.x < lo;
      if (!atMembrane) continue;
      const other = 1 - s;
      let pass = false;
      if (p.kind === "water") {
        const excess = nW[s] - level[s] / VOL;   // molecules this side has beyond its level
        pass = p.y > surfY(other) + p.r && Math.random() < Math.min(1, Math.max(0.02, BASE * (1 + 0.3 * excess)));
        if (pass) { nW[s]--; nW[other]++; }
      } else if (fits(p.kind)) {
        pass = p.y > surfY(other) + p.r && Math.random() < 0.6;
        if (pass) say("pass-" + p.kind, `Large pores: ${k.name.toLowerCase()} can slip through now.`, 12);
      } else {
        flashes.push({ y: p.y, r: p.r, t: 0 });
        say("block-" + p.kind, `${k.name} is too big to fit through the pores.`, 12);
      }
      if (pass) p.crossing = true;
      else { p.x = s === 0 ? hi : lo; p.vx = s === 0 ? -Math.abs(p.vx) : Math.abs(p.vx); }
    }

    // Net water flow (smoothed, molecules per second, + = A→B) drives the arrow + captions.
    flux += (-dh / VOL / dt - flux) * Math.min(1, dt * 2);
    const diff = Math.abs(cA - cB);
    if (Math.abs(flux) > 0.8 && diff > 3) {
      flowed = true; calmFor = 0;
      say("flow", "Water flows toward the side with more solute.", 14);
    } else if (flowed && Math.abs(balance) < 0.015) {   // pushes balanced = level has settled
      calmFor += dt;
      if (calmFor > 2 && Math.abs(level[0] - level[1]) > 30) { say("settle", "The levels stop changing once they balance.", 20); flowed = false; }
    }
    for (const fl of flashes) fl.t += dt;
    flashes = flashes.filter(fl => fl.t < 0.6);
  }

  // ---- Drawing -------------------------------------------------------------
  const cv = el("canvas", null, stage);
  Object.assign(cv.style, { position: "absolute", left: 0, top: 0, width: "1920px", height: "1080px" });
  const ctx = cv.getContext("2d");
  function sizeCanvas() {
    const k = Math.min(2, Math.max(0.75, (window.devicePixelRatio || 1) * Math.min(innerWidth / 1920, innerHeight / 1080)));
    cv.width = Math.round(1920 * k); cv.height = Math.round(1080 * k);
    ctx.setTransform(k, 0, 0, k, 0, 0);
  }
  addEventListener("resize", sizeCanvas); sizeCanvas();

  function hexPath(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; ctx[i ? "lineTo" : "moveTo"](x + r * Math.cos(a), y + r * Math.sin(a)); }
    ctx.closePath();
  }
  function drawParticle(kind, x, y, alpha = 1) {
    const k = KINDS[kind];
    ctx.globalAlpha = alpha;
    ctx.fillStyle = k.color;
    if (k.hex) hexPath(x, y, k.r); else { ctx.beginPath(); ctx.arc(x, y, k.r, 0, Math.PI * 2); }
    ctx.fill();
    if (k.label) {
      ctx.fillStyle = "#fff"; ctx.font = `700 ${kind === "sugar" ? 15 : 17}px ${SANS}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(k.label, x, y + 1);
    }
    ctx.globalAlpha = 1;
  }
  function liquidPath(s, t) {
    const a = s === 0 ? X0 + WALL : MX, b = s === 0 ? MX : X1 - WALL, y0 = surfY(s);
    ctx.beginPath(); ctx.moveTo(a, BY);
    for (let x = a; x <= b; x += 16) ctx.lineTo(x, y0 + 2.5 * Math.sin(t * 2.2 + x / 55 + s));
    ctx.lineTo(b, y0 + 2.5 * Math.sin(t * 2.2 + b / 55 + s)); ctx.lineTo(b, BY); ctx.closePath();
  }
  function arrow(x1, x2, y, color) {
    const dir = Math.sign(x2 - x1), head = 30, base = x2 - dir * head;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 8; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(base, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y); ctx.lineTo(base, y - 20); ctx.lineTo(base, y + 20); ctx.closePath(); ctx.fill();
  }

  function draw(t) {
    ctx.clearRect(0, 0, 1920, 1080);
    // Tank body (CupG recipe: slate fill at 35%, accent outline drawn last).
    ctx.fillStyle = COL.fill; ctx.globalAlpha = 0.35; ctx.fillRect(X0, TY, X1 - X0, BY - TY); ctx.globalAlpha = 1;
    // Liquid.
    for (let s = 0; s < 2; s++) {
      liquidPath(s, t); ctx.fillStyle = COL.cool; ctx.globalAlpha = 0.24; ctx.fill(); ctx.globalAlpha = 1;
    }
    // Start-level guide.
    ctx.setLineDash([12, 12]); ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X0 - 30, BY - H0); ctx.lineTo(X0, BY - H0); ctx.moveTo(X1, BY - H0); ctx.lineTo(X1 + 30, BY - H0); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COL.dim; ctx.font = `400 22px ${SANS}`; ctx.textBaseline = "middle";
    ctx.textAlign = "right"; ctx.fillText("start", X0 - 40, BY - H0);
    ctx.textAlign = "left"; ctx.fillText("start", X1 + 40, BY - H0);

    // Particles, clipped to the tank interior.
    ctx.save(); ctx.beginPath(); ctx.rect(X0 + WALL, TY, X1 - X0 - 2 * WALL, BY - TY); ctx.clip();
    for (const p of parts) if (p.kind === "water") drawParticle("water", p.x, p.y, 0.9);
    for (const p of parts) if (p.kind !== "water") drawParticle(p.kind, p.x, p.y, Math.min(1, (performance.now() - p.born) / 250));
    ctx.restore();

    // Surface lines.
    for (let s = 0; s < 2; s++) {
      const a = s === 0 ? X0 + WALL : MX, b = s === 0 ? MX : X1 - WALL, y0 = surfY(s);
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = a; x <= b; x += 16) ctx[x === a ? "moveTo" : "lineTo"](x, y0 + 2.5 * Math.sin(t * 2.2 + x / 55 + s));
      ctx.stroke();
    }

    // Membrane: solid segments with gaps (the pores). Gap width shows pore size.
    const gap = pore === "small" ? 14 : 34, seg = 30;
    ctx.strokeStyle = COL.white; ctx.lineWidth = 8; ctx.lineCap = "butt";
    ctx.setLineDash([seg, gap]); ctx.beginPath(); ctx.moveTo(MX, BY); ctx.lineTo(MX, TY); ctx.stroke(); ctx.setLineDash([]);
    // Blocked bumps: a rust ring where a too-big particle hit.
    for (const fl of flashes) {
      const k = 1 - fl.t / 0.6;
      ctx.strokeStyle = COL.rust; ctx.globalAlpha = k; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(MX, fl.y, fl.r + 10 + 14 * (1 - k), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }

    // Tank outline (open top), resting on the floor line.
    ctx.strokeStyle = COL.outline; ctx.lineWidth = 5; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(X0, TY); ctx.lineTo(X0, BY); ctx.lineTo(X1, BY); ctx.lineTo(X1, TY); ctx.stroke();

    // Net water-flow arrow across the membrane.
    const fa = Math.min(1, Math.max(0, (Math.abs(flux) - 0.8) / 1.5));
    if (fa > 0) {
      const dir = flux > 0 ? 1 : -1, y = BY - 70;
      ctx.globalAlpha = fa; arrow(MX - dir * 120, MX + dir * 120, y, COL.warm);
      // Label on a dark pill so it reads over the membrane and particles.
      ctx.fillStyle = "#20272F"; ctx.beginPath(); ctx.roundRect(MX - 58, y - 72, 116, 40, 20); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `700 24px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("water", MX, y - 51); ctx.globalAlpha = 1;
    }

    // Drag ghost.
    if (drag && drag.moved) drawParticle(drag.kind, drag.x, drag.y, 0.85);
  }

  // ---- Labels above the tank ---------------------------------------------
  const sideBadge = (txt, cx) => {
    const b = el("div", "tpi-badge", stage); b.textContent = txt;
    Object.assign(b.style, { position: "absolute", left: cx + "px", top: "160px", transform: "translateX(-50%)" });
  };
  sideBadge("Side A", (X0 + MX) / 2); sideBadge("Side B", (MX + X1) / 2);
  const memTag = el("div", "tpi-tag", stage, "<i></i>membrane");
  Object.assign(memTag.style, { position: "absolute", left: MX + "px", top: "226px", transform: "translateX(-50%)" });
  const counts = [0, 1].map(s => {
    const d = el("div", null, stage);
    Object.assign(d.style, { position: "absolute", top: "236px", left: (s === 0 ? X0 : MX + 120) + "px", width: (MX - X0 - 120) + "px",
      textAlign: s === 0 ? "left" : "right", fontSize: "22px", color: COL.dim, whiteSpace: "nowrap" });
    return d;
  });
  function updateCounts() {
    for (let s = 0; s < 2; s++) {
      const bits = ["na", "cl", "sugar"].map(k => [KINDS[k].label === "sugar" ? "sugar" : KINDS[k].label, count(s, k)]).filter(([, n]) => n);
      counts[s].textContent = bits.length ? bits.map(([l, n]) => `${l} ${n}`).join("  ·  ") : "just water";
    }
  }

  // ---- Control panel (right column, ends above the no-go zone y 800) -------
  const panel = el("div", null, stage);
  Object.assign(panel.style, { position: "absolute", left: "1380px", top: "40px", width: "480px", display: "flex", flexDirection: "column", gap: "12px" });
  const row = (parent, mt = 0) => { const r = el("div", null, parent); Object.assign(r.style, { display: "flex", gap: "14px", marginTop: mt + "px" }); return r; };
  const badge = (parent, txt, mt = 0) => { const b = el("div", "tpi-badge", parent, txt); b.style.alignSelf = "flex-start"; b.style.marginTop = mt + "px"; return b; };

  // Mode switch: Explore (learner drives) / Guided (scripted tutor drives).
  const modeRow = row(panel);
  const modeBtns = {};
  for (const m of ["explore", "guided"]) {
    const b = el("button", "tpi-btn", modeRow, m === "explore" ? "Explore" : "Guided lesson");
    b.onclick = () => setMode(m); modeBtns[m] = b;
  }

  // Explore pane.
  const explorePane = el("div", null, panel);
  Object.assign(explorePane.style, { display: "flex", flexDirection: "column", gap: "12px" });
  badge(explorePane, "Add particles", 8);
  const hint = el("div", null, explorePane, "Drag one into the tank, or pick one and tap a side.");
  Object.assign(hint.style, { fontSize: "22px", color: COL.dim });

  let selected = "na";
  const chips = {};
  for (const kind of ["water", "na", "cl", "sugar"]) {
    const k = KINDS[kind];
    const c = el("div", null, explorePane);
    Object.assign(c.style, { display: "flex", alignItems: "center", gap: "18px", padding: "6px 20px", borderRadius: "18px",
      background: COL.pill, cursor: "grab", touchAction: "none" });
    const icon = el("canvas", null, c); icon.width = 128; icon.height = 128;
    Object.assign(icon.style, { width: "60px", height: "60px", flex: "none" });
    const ic = icon.getContext("2d"); ic.scale(2, 2);
    ic.fillStyle = k.color;
    if (k.hex) { ic.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; ic[i ? "lineTo" : "moveTo"](32 + k.r * Math.cos(a), 32 + k.r * Math.sin(a)); } ic.closePath(); }
    else { ic.beginPath(); ic.arc(32, 32, kind === "water" ? 12 : k.r, 0, Math.PI * 2); }
    ic.fill();
    if (k.label) { ic.fillStyle = "#fff"; ic.font = `700 ${kind === "sugar" ? 15 : 17}px ${SANS}`; ic.textAlign = "center"; ic.textBaseline = "middle"; ic.fillText(k.label, 32, 33); }
    el("div", null, c, `<div style="font-size:28px;font-weight:700">${k.name}</div><div style="font-size:22px;color:${COL.dim}">${k.sub}</div>`);
    chips[kind] = c;
    c.addEventListener("pointerdown", e => { e.preventDefault(); select(kind); const p = toStage(e); drag = { kind, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false }; });
  }
  function select(kind) {
    selected = kind;
    for (const k in chips) chips[k].style.boxShadow = k === kind ? `0 0 0 3px ${COL.warm}` : `0 0 0 2px ${COL.line}`;
  }
  select("na");

  badge(explorePane, "Membrane pores", 6);
  const poreRow = row(explorePane);
  const poreBtns = {};
  for (const p of ["small", "large"]) {
    const b = el("button", "tpi-btn", poreRow, p === "small" ? "Small pores" : "Large pores");
    b.onclick = () => setPore(p); poreBtns[p] = b;
  }
  function setPore(p, quiet) {
    pore = p;
    for (const k in poreBtns) poreBtns[k].classList.toggle("on", k === p);
    if (!quiet) caption(p === "small" ? "Small pores: only water can pass." : "Large pores let ions through, but not sugar.");
  }
  pore = "small"; poreBtns.small.classList.add("on");

  // Guided pane: step counter, the prediction question, answer buttons, feedback.
  const guidePane = el("div", null, panel);
  Object.assign(guidePane.style, { display: "none", flexDirection: "column", gap: "14px" });
  badge(guidePane, "Guided lesson", 8);
  const stepLine = el("div", null, guidePane); Object.assign(stepLine.style, { fontSize: "22px", color: COL.dim });
  const qBox = el("div", null, guidePane); Object.assign(qBox.style, { fontSize: "30px", fontWeight: 700, lineHeight: 1.25 });
  const optBox = el("div", null, guidePane); Object.assign(optBox.style, { display: "flex", flexDirection: "column", gap: "12px" });
  const fbBox = el("div", null, guidePane); Object.assign(fbBox.style, { fontSize: "24px", lineHeight: 1.3, minHeight: "32px" });

  const ctl = row(panel, 14);
  el("button", "tpi-btn", ctl, "Reset").onclick = () => { if (mode === "guided") runLesson(); else { setPore("small"); reset(); } };
  const pauseBtn = el("button", "tpi-btn", ctl, "Pause");
  pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? "Play" : "Pause"; pauseBtn.classList.toggle("on", paused); };

  // ---- Guided lesson ---------------------------------------------------------
  // A scripted tutor runs the same tank: it adds particles, switches the pores
  // and asks the learner to predict before each result. Text captions only.
  let runId = 0;
  class Stop extends Error {}
  const live = id => { if (id !== runId) throw new Stop(); };
  async function wait(id, sec) {            // pauses with the Pause button
    let t = 0;
    while (t < sec) { await new Promise(r => setTimeout(r, 100)); live(id); if (!paused) t += 0.1; }
  }
  async function until(id, cond, maxSec) { let t = 0; while (!cond() && t < maxSec) { await wait(id, 0.2); t += 0.2; } }
  async function drip(id, kind, side, n) { for (let i = 0; i < n; i++) { add(kind, side, null, surfY(side) + KINDS[kind].r + 6); await wait(id, 0.12); } }
  const tell = (text, hold = 3) => caption(text, hold, true);
  const settled = () => Math.abs(balance) < 0.015;
  function ask(id, question, options, right) {
    qBox.textContent = question; fbBox.textContent = ""; optBox.textContent = "";
    tell("Make a prediction.");
    return new Promise(resolve => {
      options.forEach((o, i) => {
        const b = el("button", "tpi-btn", optBox, o);
        b.style.textAlign = "left";
        b.onclick = () => {
          if (id !== runId) return;
          [...optBox.children].forEach((c, j) => { c.disabled = true; c.classList.toggle("on", j === i); c.style.cursor = "default"; });
          fbBox.innerHTML = i === right
            ? `<b style="color:${COL.green}">Good prediction!</b> Watch it happen.`
            : `<b style="color:${COL.warm}">Not quite.</b> Watch what happens.`;
          resolve(i);
        };
      });
    });
  }
  const LESSON = [
    async id => { tell("This tank of water is split by a membrane."); await wait(id, 4); },
    async id => { tell("Water molecules are small enough to pass through."); await wait(id, 4.5); },
    async id => {
      await ask(id, "We'll add sodium to Side A. Which side will rise?", ["Side A", "Side B", "Neither"], 0);
      tell("Adding sodium to Side A."); await drip(id, "na", 0, 20);
      tell("Sodium is too big to fit through the pores."); await wait(id, 3.5);
      tell("Water flows toward the side with more solute."); await wait(id, 3); await until(id, settled, 25);
      tell("Side A rises until the water's weight pushes back."); await wait(id, 4);
    },
    async id => {
      await ask(id, "Now the pores get big enough for sodium. What happens?", ["The levels even out", "Side A rises even more", "Nothing changes"], 0);
      setPore("large", true); tell("Large pores: sodium can slip through now.");
      await wait(id, 3); await until(id, () => Math.abs(level[0] - level[1]) < 12, 30);
      tell("Sodium spreads out, so the levels even up."); await wait(id, 4);
    },
    async id => {
      await ask(id, "Pores still large. We add sugar to Side B. Which side will rise?", ["Side A", "Side B", "Neither"], 1);
      tell("Adding sugar to Side B."); await drip(id, "sugar", 1, 14);
      tell("Sugar is too big, even for the large pores."); await wait(id, 3.5); await until(id, settled, 25);
      tell("So water flows in and Side B rises."); await wait(id, 4);
    },
    async id => {
      qBox.textContent = "Lesson complete!";
      fbBox.textContent = "Switch to Explore to try your own mix, or press Reset to watch again.";
      tell("Your turn: switch to Explore and try your own mix.", 6);
    },
  ];
  async function runLesson() {
    const id = ++runId;
    setPore("small", true); reset();
    qBox.textContent = ""; optBox.textContent = ""; fbBox.textContent = "";
    try {
      for (let i = 0; i < LESSON.length; i++) {
        stepLine.textContent = i < LESSON.length - 1 ? `Step ${i + 1} of ${LESSON.length - 1}` : "";
        if (i < 2) { qBox.textContent = ""; optBox.textContent = ""; fbBox.textContent = ""; }
        await LESSON[i](id);
      }
    } catch (e) { if (!(e instanceof Stop)) throw e; }
  }
  function setMode(m) {
    mode = m; runId++;
    for (const k in modeBtns) modeBtns[k].classList.toggle("on", k === m);
    explorePane.style.display = m === "explore" ? "flex" : "none";
    guidePane.style.display = m === "guided" ? "flex" : "none";
    if (paused) pauseBtn.onclick();
    if (m === "guided") runLesson();
    else { setPore("small", true); reset(); }
  }

  // ---- Pointer input: drag from a chip, or tap/hold in the tank -----------
  let drag = null, pour = null;
  const inTank = p => p.x > X0 + WALL && p.x < X1 - WALL && p.y > TY - 120 && p.y < BY;
  function drop(kind, p) {
    const sol = parts.filter(q => q.kind !== "water").length;
    if (kind !== "water" && sol >= 140) { say("full", "That's plenty! Press Reset to start again.", 6); return; }
    if (kind === "water") {
      const s = sideOf(p.x);
      if (level[s] + VOL * 5 > HMAX) { say("brim", "That side is full to the brim.", 6); return; }
      level[s] += VOL * 5;
      for (let i = 0; i < 5; i++) add("water", s, p.x + rnd(-20, 20), Math.max(p.y, surfY(s)) + rnd(0, 30));
      return;
    }
    add(kind, sideOf(p.x), p.x, Math.max(p.y, surfY(sideOf(p.x)) + KINDS[kind].r + 4));
  }
  addEventListener("pointermove", e => {
    const p = toStage(e);
    if (drag) { drag.x = p.x; drag.y = p.y; if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) drag.moved = true; }
    if (pour) { pour.x = p.x; pour.y = p.y; }
  });
  addEventListener("pointerup", e => {
    const p = toStage(e);
    if (drag && drag.moved && inTank(p)) drop(drag.kind, p);
    drag = null; pour = null;
  });
  stage.addEventListener("pointerdown", e => {
    if (drag || mode === "guided") return;
    const p = toStage(e);
    if (!inTank(p)) return;
    drop(selected, p);
    pour = { x: p.x, y: p.y, next: performance.now() + 350 };
  });

  // ---- Loop ----------------------------------------------------------------
  // ?mode=guided opens straight into the lesson (handy for LMS embeds).
  setMode(new URLSearchParams(location.search).get("mode") === "guided" ? "guided" : "explore");
  let last = performance.now(), tick = 0;
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
    if (pour && now > pour.next && inTank(pour)) { drop(selected, pour); pour.next = now + 140; }
    if (!paused) step(dt);
    draw(now / 1000);
    if (++tick % 10 === 0) updateCounts();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Debug/test hook: OSMO.run(seconds) fast-forwards the model.
  window.OSMO = { get parts() { return parts; }, get level() { return level; }, get flux() { return flux; }, add, setPore, reset, setMode,
    run(sec) { for (let i = 0; i < sec * 60; i++) step(1 / 60); } };
})();
