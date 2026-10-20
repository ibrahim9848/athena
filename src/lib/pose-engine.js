/* Ported verbatim from reference/lifting-plan.html — hand-written figure engine. */
/* eslint-disable */
// @ts-nocheck

/* Exercise figure engine: articulated side/front/top-view figures on machines.
   Each exercise defines pose(t) for t in [0,1] (0 = start, 1 = end of the lift). */
const PF = (() => {
  'use strict';
  const R = Math.PI / 180;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const len = a => Math.hypot(a[0], a[1]);
  const unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const dir = d => [Math.cos(d * R), Math.sin(d * R)];
  const ang = a => Math.atan2(a[1], a[0]) / R;
  const at = (p, d, l) => add(p, mul(dir(d), l));
  const mix = (a, b, t) => a + (b - a) * t;
  const mixP = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1));
  const ph = (t, a, b) => ease((t - a) / (b - a));
  const r1 = v => Math.round(v * 10) / 10;
  const P = p => r1(p[0]) + ' ' + r1(p[1]);
  /* anterior normal of a proximal->distal segment, for a body facing right */
  const ant = (p1, p2) => { const u = unit(sub(p2, p1)); return [u[1], -u[0]]; };
  const mirror = (p, c) => [2 * c - p[0], p[1]];

  function ik(root, target, l1, l2, bend) {
    const d = sub(target, root);
    const dist = clamp(len(d), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.4);
    const a = Math.acos(clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1)) / R;
    return at(root, ang(d) + bend * a, l1);
  }

  /* tapered capsule outline (counter-clockwise, so overlapping parts union cleanly) */
  function capsule(p1, ra, p2, rb) {
    const d = sub(p2, p1), L = len(d);
    if (L < 0.05) return circ(p1, Math.max(ra, rb));
    const u = mul(d, 1 / L), n = [-u[1], u[0]];
    const s = clamp((ra - rb) / L, -0.95, 0.95), c = Math.sqrt(1 - s * s);
    const m1 = add(mul(n, c), mul(u, s)), m2 = add(mul(n, -c), mul(u, s));
    const a1 = add(p1, mul(m1, ra)), b1 = add(p2, mul(m1, rb));
    const a2 = add(p1, mul(m2, ra)), b2 = add(p2, mul(m2, rb));
    return `M${P(a1)}L${P(b1)}A${r1(rb)} ${r1(rb)} 0 ${s < 0 ? 1 : 0} 0 ${P(b2)}L${P(a2)}A${r1(ra)} ${r1(ra)} 0 ${s > 0 ? 1 : 0} 0 ${P(a1)}Z`;
  }
  function circ(c, r) {
    return `M${r1(c[0] - r)} ${r1(c[1])}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0Z`;
  }
  function ell(c, rx, ry, rot) {
    const u = dir(rot), a = add(c, mul(u, -rx)), b = add(c, mul(u, rx));
    return `M${P(a)}A${rx} ${ry} ${rot} 1 0 ${P(b)}A${rx} ${ry} ${rot} 1 0 ${P(a)}Z`;
  }
  function band(p1, p2, f0, f1, off, r) {
    const d = sub(p2, p1), n = ant(p1, p2);
    return capsule(add(add(p1, mul(d, f0)), mul(n, off)), r, add(add(p1, mul(d, f1)), mul(n, off)), r);
  }

  /* ---------- machine drawing ---------- */
  const L = (a, b, c = 'fr') => `<path class="${c}" d="M${P(a)}L${P(b)}"/>`;
  const PL = (pts, c = 'fr') => `<path class="${c}" d="M${pts.map(P).join('L')}"/>`;
  const PAD = (a, b, r = 5.2, c = 'pad') => `<path class="${c}" d="${capsule(a, r, b, r)}"/>`;
  const DISC = (p, r, c) => `<circle class="${c}" cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}"/>`;
  const RECT = (x, y, w, h, rx, c) => `<rect class="${c}" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}"/>`;
  const FLOOR = L([6, 186], [274, 186], 'floor');
  function STACK(x, top, w, bottom, lift) {
    const n = 7, h = 5, g = 1.7, sel = 4, cx = x + w / 2;
    const topY = bottom - 4 - n * (h + g) - lift;
    let s = RECT(x, top, w, bottom - top, 3, 'col');
    s += DISC([cx, top + 7], 3.4, 'hub');
    s += L([cx, top + 7], [cx, topY], 'cable');
    for (let i = 0; i < n; i++) {
      const y = bottom - 4 - (i + 1) * (h + g) + (i >= n - sel ? -lift : 0);
      s += RECT(x + 3.5, y, w - 7, h, 1.2, 'plate');
    }
    return s;
  }
  const GRIP = (hand, d = [0, 1], l = 8) => L(add(hand, mul(d, -l)), add(hand, mul(d, l)), 'grip');

  /* ---------- bodies ---------- */
  const TOR = 52, UA = 31, FA = 28, TH = 44, SH = 43, HD = 22, AY = 177.5;
  const BR = { hip: 9.2, sh: 9.8, sp: 9.1, head: 9.4, th0: 8.6, th1: 6.1, sh0: 6.1, sh1: 4.0, ua0: 5.6, ua1: 4.3, fa0: 4.3, fa1: 3.4, hand: 4.2, heel: 3.7, toe: 2.8 };

  function sideBody(j) {
    const base = [];
    base.push(capsule(j.hip, BR.th0, j.knee, BR.th1));
    base.push(capsule(j.knee, BR.sh0, j.ankle, BR.sh1));
    const fd = dir(j.foot), fn = [-fd[1], fd[0]];
    const heel = add(add(j.ankle, mul(fd, -3.5)), mul(fn, 4.6));
    const toe = add(add(j.ankle, mul(fd, 13)), mul(fn, 5.4));
    base.push(capsule(heel, BR.heel, toe, BR.toe));
    const top = j.spine || j.hip;
    if (j.spine) {
      base.push(capsule(j.hip, BR.hip, j.spine, BR.sp));
      base.push(capsule(j.spine, BR.sp, j.shoulder, BR.sh));
    } else base.push(capsule(j.hip, BR.hip, j.shoulder, BR.sh));
    const nU = ant(j.shoulder, top), dU = unit(sub(top, j.shoulder));
    base.push(circ(add(add(j.shoulder, mul(dU, 11)), mul(nU, 3.6)), 8.2));
    const lowTop = j.spine || j.shoulder, nL = ant(lowTop, j.hip), dL = unit(sub(j.hip, lowTop));
    base.push(circ(add(add(j.hip, mul(dL, -1)), mul(nL, -3.8)), 8.4));
    base.push(circ(j.head, BR.head));
    const arm = [capsule(j.shoulder, BR.ua0, j.elbow, BR.ua1), capsule(j.elbow, BR.fa0, j.hand, BR.fa1), circ(j.hand, BR.hand)];
    return { base, arms: [arm], heel, toe };
  }

  function frontBody(j) {
    const c = j.c, base = [], sy = j.sh[0][1];
    for (const s of [-1, 1]) {
      const hipP = [c + s * 9, j.hipY], knee = [c + s * 15, j.kneeY], ankle = [c + s * 16, AY];
      base.push(capsule(hipP, 8.8, knee, 7.6));
      base.push(capsule(knee, 6.3, ankle, 4.2));
      base.push(capsule([c + s * 14, AY + 5.4], 3.9, [c + s * 19.5, AY + 6], 3.4));
    }
    base.push(capsule([c - 18, sy - 1], 8.8, [c + 18, sy - 1], 8.8));
    base.push(capsule([c, sy + 10], 17.5, [c, j.hipY - 5], 12.4));
    base.push(capsule([c - 9, j.hipY], 9.6, [c + 9, j.hipY], 9.6));
    base.push(circ(j.head, BR.head));
    const arms = [0, 1].map(i => [circ(j.sh[i], 7.2), capsule(j.sh[i], 6.0, j.el[i], 4.5), capsule(j.el[i], 4.5, j.ha[i], 3.6), circ(j.ha[i], 4.4)]);
    return { base, arms };
  }

  /* ---------- muscles (side view) ---------- */
  const M = {
    chest: j => band(j.shoulder, j.spine || j.hip, 0.06, 0.42, 6.4, 6.6),
    upperChest: j => band(j.shoulder, j.spine || j.hip, -0.02, 0.3, 6.4, 6.4),
    abs: j => j.spine
      ? band(j.spine, j.hip, -0.15, 0.86, 6.6, 5.6) + band(j.shoulder, j.spine, 0.5, 1.05, 6.6, 5.6)
      : band(j.shoulder, j.hip, 0.42, 0.92, 6.6, 5.6),
    back: j => band(j.shoulder, j.spine || j.hip, 0.02, 0.62, -6.6, 7),
    quads: j => band(j.hip, j.knee, 0.16, 0.95, 4.4, 5.4),
    hams: j => band(j.hip, j.knee, 0.16, 0.95, -4.4, 5.4),
    glutes: j => { const lt = j.spine || j.shoulder; return circ(add(j.hip, mul(ant(lt, j.hip), -7.5)), 8.6); },
    calves: j => band(j.knee, j.ankle, 0.04, 0.62, -2.8, 4.4),
    delt: j => circ(j.shoulder, 7.8),
    frontDelt: j => circ(add(j.shoulder, mul(ant(j.shoulder, j.elbow), 3)), 6.6),
    rearDelt: j => circ(add(j.shoulder, mul(ant(j.shoulder, j.elbow), -3)), 6.6),
    triceps: j => band(j.shoulder, j.elbow, 0.22, 0.92, -2.9, 3.3),
    biceps: j => band(j.shoulder, j.elbow, 0.22, 0.92, 2.9, 3.3),
  };

  function seated(hip, lean) {
    const a = -90 - lean, shoulder = at(hip, a, TOR);
    return { shoulder, head: at(shoulder, a, HD), a };
  }
  function backrest(hip, shoulder, top = 12, bot = 2, off = 15.2, r = 5.2) {
    const d = unit(sub(hip, shoulder)), post = [-d[1], d[0]];
    const a = add(add(shoulder, mul(post, off)), mul(d, -top)), b = add(add(hip, mul(post, off)), mul(d, bot));
    return { a, b, post, d, pad: PAD(a, b, r) };
  }

  /* ---------- exercises ---------- */
  const EX = {};

  EX['chest-press'] = {
    view: 'Side view',
    pose(t) {
      const hip = [88, 128], { shoulder, head } = seated(hip, 10);
      const ankle = [138, AY], knee = ik(hip, ankle, TH, SH, -1);
      const hand = mixP(add(shoulder, [13, 10]), add(shoulder, [55, 8]), t);
      const elbow = ik(shoulder, hand, UA, FA, 1);
      const j = { hip, shoulder, head, knee, ankle, foot: 0, elbow, hand };
      const br = backrest(hip, shoulder);
      let behind = STACK(12, 20, 24, 182, t * 13);
      behind += L([12, 183], [150, 183], 'fr base') + L([88, 146], [88, 182]);
      behind += PL([[36, 120], [br.b[0] - 3, br.b[1] - 6]]);
      behind += L([36, hand[1]], [hand[0], hand[1]], 'fr arm');
      behind += br.pad + PAD([64, 142.5], [114, 142.5]);
      return { j, body: sideBody(j), behind, mid: GRIP(hand) };
    },
    muscles: j => ({ pb: M.chest(j), sa: M.triceps(j) }),
    trace: j => add(j.hand, [0, -16]),
  };

  EX['incline-press'] = {
    view: 'Side view',
    pose(t) {
      const hip = [96, 131], { shoulder, head, a } = seated(hip, 38);
      const u = dir(a), p = dir(a + 90);
      const hand = mixP(add(add(shoulder, mul(p, 13)), mul(u, -9)), add(add(shoulder, mul(p, 55)), mul(u, -2)), t);
      const elbow = ik(shoulder, hand, UA, FA, 1);
      const ankle = [154, AY], knee = ik(hip, ankle, TH, SH, -1);
      const j = { hip, shoulder, head, knee, ankle, foot: 0, elbow, hand };
      const br = backrest(hip, shoulder, 14, 3);
      const piv = [30, 30];
      let behind = STACK(8, 20, 24, 182, t * 13);
      behind += L([8, 183], [160, 183], 'fr base') + L([96, 148], [96, 182]);
      behind += PL([[br.b[0] + 2, br.b[1] + 4], [60, 182]]);
      behind += L(piv, hand, 'fr arm') + DISC(piv, 4.5, 'hub');
      behind += br.pad + PAD([74, 145], [120, 145]);
      return { j, body: sideBody(j), behind, mid: GRIP(hand, unit(sub(hand, piv)), 7) };
    },
    muscles: j => ({ pb: M.upperChest(j), sa: M.triceps(j) }),
    trace: j => add(j.hand, [10, 11]),
  };

  EX['shoulder-press'] = {
    view: 'Side view',
    pose(t) {
      const hip = [96, 128], { shoulder, head } = seated(hip, 6);
      const hand = mixP(add(shoulder, [11, -6]), add(shoulder, [7, -55]), t);
      const elbow = ik(shoulder, hand, UA, FA, 1);
      const ankle = [148, AY], knee = ik(hip, ankle, TH, SH, -1);
      const j = { hip, shoulder, head, knee, ankle, foot: 0, elbow, hand };
      const br = backrest(hip, shoulder, 16);
      const piv = [44, 92];
      let behind = STACK(16, 20, 24, 182, t * 13);
      behind += L([16, 183], [154, 183], 'fr base') + L([96, 146], [96, 182]);
      behind += PL([[40, 130], [br.b[0] - 3, br.b[1] - 4]]);
      behind += L(piv, hand, 'fr arm') + DISC(piv, 4.5, 'hub');
      behind += br.pad + PAD([72, 142.5], [120, 142.5]);
      return { j, body: sideBody(j), behind, mid: GRIP(hand, [1, 0], 6) };
    },
    muscles: j => ({ pa: M.delt(j), sa: M.triceps(j) }),
    trace: j => add(j.hand, [14, 0]),
  };

  EX['cable-lateral-raise'] = {
    view: 'Front view',
    pose(t) {
      const c = 120, hipY = 91, sy = hipY - TOR + 2;
      const shL = [c - 21, sy], shR = mirror(shL, c);
      /* working arm (viewer's left) sweeps out to shoulder height, elbow slightly bent */
      const th = mix(78, 170, t);
      const elL = at(shL, th, UA), haL = at(elL, th - 12, FA);
      /* free hand holds the cable column */
      const col = c + 48, haR = [col + 1, sy + 26], elR = ik(shR, haR, UA, FA, 1);
      const head = [c, sy - 24];
      const j = { c, hipY, kneeY: AY - SH, sh: [shL, shR], el: [elL, elR], ha: [haL, haR], head, th };
      const pul = [col - 2, 170];
      let behind = STACK(col, 20, 24, 182, t * 12);
      behind += L([col - 10, 183], [col + 34, 183], 'fr base') + DISC(pul, 4.6, 'hub');
      const cd = unit(sub(haL, pul));
      const mid = L(pul, add(haL, mul(cd, -9)), 'cable') + L(add(haL, mul(cd, -10)), add(haL, mul(cd, 3)), 'grip');
      return { j, body: frontBody(j), behind, mid };
    },
    muscles: j => ({ pa: circ([j.sh[0][0] - 3.2, j.sh[0][1] - 1], 7.6) }),
    trace: j => at(j.sh[0], j.th - 6, UA + FA + 10),
  };

  EX['triceps-pushdown'] = {
    view: 'Side view',
    pose(t) {
      const ankle = [104, AY], knee = at(ankle, -86, SH), hip = at(knee, -97, TH);
      const shoulder = at(hip, -78, TOR), head = at(shoulder, -80, HD);
      const elbow = at(shoulder, 96, UA);
      const fa = mix(-14, 93, t), hand = at(elbow, fa, FA);
      const j = { hip, shoulder, head, knee, ankle, foot: 0, elbow, hand };
      const pul = [152, 12];
      const len0 = len(sub(pul, at(elbow, -14, FA)));
      const lift = Math.max(0, len(sub(pul, hand)) - len0);
      let behind = STACK(200, 8, 26, 182, lift);
      behind += L([200, 9], [pul[0] + 2, 9], 'fr') + L([194, 183], [232, 183], 'fr base');
      behind += DISC(pul, 4.6, 'hub');
      const cd = unit(sub(hand, pul));
      const mid = L(add(pul, mul([-cd[1], cd[0]], 0)), add(hand, mul(cd, -9)), 'cable') + L(add(hand, mul(cd, -10)), add(hand, mul(cd, 3)), 'grip');
      return { j, body: sideBody(j), behind, mid };
    },
    muscles: j => ({ pa: M.triceps(j) }),
    trace: j => at(j.elbow, ang(sub(j.hand, j.elbow)), FA + 14),
  };

  EX['leg-press'] = {
    view: 'Side view',
    pose(t) {
      const hip = [86, 150], a = -150, shoulder = at(hip, a, TOR), head = at(shoulder, a + 6, HD);
      const k0 = at(hip, -105, TH), A0 = at(k0, -15, SH);
      const k1 = at(hip, -68, TH), A1 = at(k1, -50, SH);
      const ankle = mixP(A0, A1, t), knee = ik(hip, ankle, TH, SH, -1);
      const footA = -125, fd = dir(footA), fn = [-fd[1], fd[0]];
      const hand = [93, 146], elbow = ik(shoulder, hand, UA, FA, 1);
      const j = { hip, shoulder, head, knee, ankle, foot: footA, elbow, hand };
      const v = unit(sub(A1, A0));
      const plateC = add(ankle, mul(fn, 10.5));
      const railOff = mul(fn, 30);
      const rail0 = add(add(A0, railOff), mul(v, -120)), rail1 = add(add(A1, railOff), mul(v, 30));
      const br = backrest(hip, shoulder, 18, 4, 15.2);
      let behind = L([10, 183], [196, 183], 'fr base');
      behind += L(rail0, rail1, 'fr rail') + L([rail1[0], rail1[1]], [rail1[0], 182]);
      const q = (a, b) => add(add(plateC, mul(fd, a)), mul(fn, b));
      behind += `<path class="carriage" d="M${P(q(17, 3))}L${P(q(17, 15))}L${P(q(-11, 15))}L${P(q(-11, 3))}Z"/>`;
      behind += DISC(q(4, 22), 14, 'wplate') + DISC(q(4, 22), 3.2, 'hub');
      behind += L(q(22, 0.5), q(-16, 0.5), 'fr plate-edge');
      behind += br.pad + PAD(add(br.b, mul(br.d, 2)), add(hip, [26, 12]), 5.2) + L([60, 166], [60, 182]) + L([104, 166], [104, 182]);
      return { j, body: sideBody(j), behind, mid: GRIP(hand, [0, 1], 5) };
    },
    muscles: j => ({ pb: M.quads(j), sb: M.glutes(j) }),
    trace: j => { const fd = dir(-125); return add(j.ankle, mul(fd, -30)); },
  };

  EX['leg-curl'] = {
    view: 'Side view',
    pose(t) {
      const hip = [96, 124], { shoulder, head } = seated(hip, 12);
      const knee = at(hip, -2, TH);
      const s = mix(6, 98, t), ankle = at(knee, s, SH);
      const hand = [120, 120], elbow = ik(shoulder, hand, UA, FA, 1);
      const j = { hip, shoulder, head, knee, ankle, foot: s - 100, elbow, hand };
      const sd = dir(s), post = [-sd[1], sd[0]];
      const roll = add(add(ankle, mul(sd, -5)), mul(post, -10.5));
      const nT = ant(hip, knee);
      const br = backrest(hip, shoulder);
      let behind = STACK(12, 40, 24, 182, t * 11);
      behind += L([12, 183], [176, 183], 'fr base') + L([96, 142], [96, 182]);
      behind += PL([[36, 116], [br.b[0] - 3, br.b[1] - 6]]);
      behind += L(knee, roll, 'fr arm');
      behind += br.pad + PAD([66, 138], [128, 138]);
      behind += PL([[160, 100], [168, 100], [168, 182]]);
      const padA = add(add(hip, mul(sub(knee, hip), 0.62)), mul(nT, 15)), padB = add(add(hip, mul(sub(knee, hip), 0.95)), mul(nT, 15));
      const front = DISC(knee, 7.6, 'pivot') + PAD(padA, padB, 5.2, 'pad ko-pad') + L(padB, [160, 100]) + DISC(roll, 6.6, 'pad ko-pad');
      return { j, body: sideBody(j), behind, front };
    },
    muscles: j => ({ pb: M.hams(j), sb: M.calves(j) }),
    trace: j => at(j.knee, ang(sub(j.ankle, j.knee)), SH + 13),
  };

  EX['leg-extension'] = {
    view: 'Side view',
    pose(t) {
      const hip = [96, 124], { shoulder, head } = seated(hip, 10);
      const knee = at(hip, -2, TH);
      const s = mix(94, 4, t), ankle = at(knee, s, SH);
      const hand = [120, 120], elbow = ik(shoulder, hand, UA, FA, 1);
      const j = { hip, shoulder, head, knee, ankle, foot: s - 96, elbow, hand };
      const sd = dir(s), nS = [sd[1], -sd[0]];
      const roll = add(add(ankle, mul(sd, -6)), mul(nS, 10.5));
      const br = backrest(hip, shoulder);
      let behind = STACK(12, 40, 24, 182, t * 11);
      behind += L([12, 183], [150, 183], 'fr base') + L([96, 142], [96, 182]);
      behind += PL([[36, 116], [br.b[0] - 3, br.b[1] - 6]]);
      behind += L(knee, roll, 'fr arm');
      behind += br.pad + PAD([66, 138], [128, 138]);
      const front = DISC(knee, 7.6, 'pivot') + DISC(roll, 6.6, 'pad ko-pad');
      return { j, body: sideBody(j), behind, front };
    },
    muscles: j => ({ pb: M.quads(j) }),
    trace: j => at(j.knee, ang(sub(j.ankle, j.knee)), SH + 20),
  };

  EX['hip-thrust'] = {
    view: 'Side view',
    pose(t) {
      const shoulder = [64, 134], th = mix(36, -1, t);
      const hip = at(shoulder, th, TOR);
      const ankle = [168, AY], knee = ik(hip, ankle, TH, SH, -1);
      const td = dir(th), head = add(add(shoulder, mul(td, -HD)), mul([td[1], -td[0]], 2));
      const nT = [td[1], -td[0]];
      const padC = add(hip, mul(nT, 14.5));
      const hand = add(padC, [-8, -3]), elbow = ik(shoulder, hand, UA, FA, 1);
      const j = { hip, shoulder, head, knee, ankle, foot: 0, elbow, hand };
      const discC = add(hip, mul(nT, 6));
      let behind = DISC(discC, 22, 'wplate') + DISC(discC, 3.6, 'hub');
      behind += PAD([20, 149], [72, 149], 5.4) + L([28, 154], [28, 182]) + L([64, 154], [64, 182]) + L([20, 183], [72, 183], 'fr base');
      const front = PAD(add(padC, mul(td, -9)), add(padC, mul(td, 9)), 5.4, 'pad ko-pad');
      return { j, body: sideBody(j), behind, front };
    },
    muscles: j => ({ pb: M.glutes(j), sb: M.hams(j) }),
    trace: j => { const td = unit(sub(j.hip, j.shoulder)); return add(j.hip, mul([td[1], -td[0]], 44)); },
  };

  EX['calf-raise'] = {
    view: 'Side view',
    pose(t) {
      const f = mix(-16, 30, t), fd = dir(f), fn = [-fd[1], fd[0]];
      const ball = [134, 170];
      const ankle = sub(sub(ball, mul(fd, 9)), mul(fn, 8.4));
      const hip = [ankle[0] - 2, ankle[1] - 86.4], knee = ik(hip, ankle, TH, SH, -1);
      const shoulder = at(hip, -91, TOR), head = at(shoulder, -91, HD);
      const hand = add(shoulder, [11, -5]), elbow = ik(shoulder, hand, UA, FA, 1);
      const j = { hip, shoulder, head, knee, ankle, foot: f, elbow, hand };
      const padY = shoulder[1] - 8.5;
      let behind = RECT(112, 170, 46, 16, 2, 'block');
      behind += L([80, 14], [80, 182]) + L([60, 183], [170, 183], 'fr base');
      behind += STACK(48, 30, 24, 182, t * 6);
      behind += L([80, padY], [shoulder[0] - 6, padY], 'fr arm');
      const front = PAD([shoulder[0] - 9, padY], [shoulder[0] + 7, padY], 4.4, 'pad ko-pad');
      return { j, body: sideBody(j), behind, front };
    },
    muscles: j => ({ pb: M.calves(j) }),
    trace: j => add(j.ankle, [-22, 6]),
  };

  EX['ab-crunch'] = {
    view: 'Side view',
    pose(t) {
      const hip = [96, 128];
      const a1 = mix(-98, -80, t), a2 = mix(-100, -40, t);
      const spine = at(hip, a1, 24), shoulder = at(spine, a2, 28);
      const head = at(shoulder, a2 + 0.25 * (a2 - a1), HD);
      const ud = dir(a2), nU = [-ud[1], ud[0]];
      const hand = add(add(shoulder, mul(ud, 7)), mul(nU, 12));
      const elbow = ik(shoulder, hand, UA, FA, 1);
      const ankle = [142, AY], knee = ik(hip, ankle, TH, SH, -1);
      const j = { hip, spine, shoulder, head, knee, ankle, foot: 0, elbow, hand };
      const piv = [62, 98];
      const over = add(add(shoulder, mul(ud, 14)), mul(nU, -8));
      let behind = STACK(12, 20, 24, 182, t * 10);
      behind += L([12, 183], [150, 183], 'fr base') + L([96, 142], [96, 182]) + L([36, 98], piv);
      behind += PL([piv, over, hand], 'fr arm') + DISC(piv, 4.5, 'hub');
      behind += PAD([70, 142.5], [120, 142.5]);
      return { j, body: sideBody(j), behind, mid: GRIP(hand, unit(sub(hand, over)), 5) };
    },
    muscles: j => ({ pb: M.abs(j) }),
    trace: j => { const d = dir(ang(sub(j.shoulder, j.spine)) + 90); return add(j.shoulder, mul(d, 26)); },
  };

  EX['lat-pulldown'] = {
    view: 'Front view',
    pose(t) {
      const c = 140, hipY = 140, sy = hipY - TOR + 2;
      const shL = [c - 21, sy], shR = mirror(shL, c);
      const hy = mix(sy - 56, sy - 6, t), haR = [c + 38, hy], haL = mirror(haR, c);
      const elR = ik(shR, haR, UA, FA, 1), elL = mirror(elR, c);
      const head = [c, sy - 24];
      const j = { c, hipY, kneeY: hipY - 2, sh: [shL, shR], el: [elL, elR], ha: [haL, haR], head };
      let behind = L([c - 61, 182], [c - 61, 8]) + L([c + 61, 182], [c + 61, 8]) + L([c - 61, 8], [c + 61, 8]);
      behind += L([c - 74, 183], [c + 74, 183], 'fr base') + RECT(c - 28, hipY + 7, 56, 9, 4.5, 'pad');
      behind += L([c, hipY + 16], [c, 182]);
      behind += DISC([c, 15], 5, 'hub');
      const mid = L([c, 15], [c, hy], 'cable') + PL([[c - 56, hy + 5], [c - 46, hy], [c + 46, hy], [c + 56, hy + 5]], 'grip bar');
      const front = PAD([c - 31, hipY - 12], [c + 31, hipY - 12], 5.4, 'pad ko-pad') + L([c + 31, hipY - 12], [c + 52, hipY - 12]) + L([c - 31, hipY - 12], [c - 52, hipY - 12]);
      return { j, body: frontBody(j), behind, mid, front };
    },
    muscles: j => {
      const c = j.c, y = j.sh[0][1];
      return {
        pb: ell([c - 13.5, y + 22], 7, 17, -14) + ell([c + 13.5, y + 22], 7, 17, 14),
        sa: [0, 1].map(i => capsule(add(j.sh[i], mul(sub(j.el[i], j.sh[i]), 0.3)), 3.3, add(j.sh[i], mul(sub(j.el[i], j.sh[i]), 0.85)), 3.3)).join(''),
      };
    },
    trace: j => [add(j.ha[1], [14, 0]), add(j.ha[0], [-14, 0])],
  };

  EX['seated-row'] = {
    view: 'Side view',
    pose(t) {
      const hip = [88, 126];
      const sh0 = at(hip, -87, TOR), shoulder = add(sh0, [-3.5 * t, 0]);
      const head = at(shoulder, ang(sub(shoulder, hip)), HD);
      const hand = mixP(add(sh0, [57, 10]), add(shoulder, [8, 20]), t);
      const elbow = ik(shoulder, hand, UA, FA, 1);
      const ankle = [140, AY], knee = ik(hip, ankle, TH, SH, -1);
      const j = { hip, shoulder, head, knee, ankle, foot: 0, elbow, hand };
      const piv = [176, 16];
      const px = sh0[0] + 16;
      let behind = L([30, 183], [200, 183], 'fr base') + L([88, 142], [88, 182]);
      behind += L(piv, add(hand, [0, -7]), 'fr arm') + L([piv[0], piv[1]], [196, 16]) + L([196, 16], [196, 182]) + DISC(piv, 4.5, 'hub');
      const wp = add(mixP(piv, hand, 0.36), mul(unit(sub(hand, piv)), 0));
      behind += DISC(wp, 12, 'wplate') + DISC(wp, 3, 'hub');
      behind += PAD([px, sh0[1] + 8], [px, sh0[1] + 38], 5) + L([px + 4, sh0[1] + 42], [px + 4, 182]);
      behind += PAD([64, 140.5], [112, 140.5]);
      return { j, body: sideBody(j), behind, mid: GRIP(hand, [0, 1], 7) };
    },
    muscles: j => ({ pb: M.back(j), sa: M.rearDelt(j) + M.biceps(j) }),
    trace: j => add(j.hand, [0, -15]),
  };

  EX['rear-delt-fly'] = {
    view: 'From above',
    floor: false,
    pose(t) {
      const c = 140, y0 = 130;
      const shL = [c - 20, y0], shR = mirror(shL, c);
      const tu = mix(-84, -182, t), tf = tu + 12;
      const elL = at(shL, tu, UA), haL = at(elL, tf, FA);
      const elR = mirror(elL, c), haR = mirror(haL, c);
      const piv = [c, 34];
      const j = { c, sh: [shL, shR], el: [elL, elR], ha: [haL, haR], tu };
      const base = [capsule(shL, 11.5, shR, 11.5), ell([c, y0 + 4], 18, 9, 0)];
      const arms = [0, 1].map(i => [capsule(j.sh[i], 6.2, j.el[i], 4.6), capsule(j.el[i], 4.6, j.ha[i], 3.6), circ(j.ha[i], 4.4)]);
      const top = [circ([c, y0 - 3], 9.6), circ([c, y0 - 13.2], 2.6)];
      let behind = RECT(c - 7, 6, 14, 30, 4, 'col-fill') + DISC(piv, 6, 'hub');
      behind += L(piv, haL, 'fr arm') + L(piv, haR, 'fr arm');
      behind += RECT(c - 25, y0 - 28, 50, 11, 5, 'pad');
      return { j, body: { base, arms, top }, behind };
    },
    muscles: j => ({
      pb: circ([j.c - 22, j.sh[0][1] + 6], 7.4) + circ([j.c + 22, j.sh[0][1] + 6], 7.4),
      sb: ell([j.c, j.sh[0][1] + 7], 10, 5, 0),
    }),
    trace: j => { const s = j.sh[0]; const p = at(s, j.tu + 7, UA + FA + 12); return [p, mirror(p, j.c)]; },
  };

  EX['biceps-curl'] = {
    view: 'Side view',
    pose(t) {
      const hip = [84, 130], { shoulder, head } = seated(hip, -10);
      const elbow = at(shoulder, 42, UA);
      const fa = mix(36, -98, t), hand = at(elbow, fa, FA);
      const ankle = [130, AY], knee = ik(hip, ankle, TH, SH, -1);
      const j = { hip, shoulder, head, knee, ankle, foot: 0, elbow, hand };
      const d = dir(42), post = [-d[1], d[0]];
      const pA = add(add(shoulder, mul(d, 10)), mul(post, 10.5)), pB = add(add(elbow, mul(d, 7)), mul(post, 10.5));
      let behind = L([30, 183], [160, 183], 'fr base') + L([84, 144], [84, 182]);
      behind += L(add(pB, mul(post, 4)), [132, 182]);
      behind += PAD([62, 144], [106, 144]);
      const fd = dir(fa), fp = [-fd[1], fd[0]];
      const mid = PAD(pA, pB, 5.2, 'pad ko-pad') + DISC(elbow, 7.6, 'pivot') + L(add(hand, mul(fp, -7)), add(hand, mul(fp, 7)), 'grip');
      return { j, body: sideBody(j), behind, mid };
    },
    muscles: j => ({ pa: M.biceps(j) }),
    trace: j => at(j.elbow, ang(sub(j.hand, j.elbow)), FA + 15),
  };

  EX['straight-arm-pulldown'] = {
    view: 'Side view',
    pose(t) {
      const ankle = [100, AY], knee = at(ankle, -82, SH), hip = at(knee, -100, TH);
      const shoulder = at(hip, -70, TOR), head = at(shoulder, -73, HD);
      /* arms stay nearly straight and sweep from head height down to the thighs */
      const al = mix(-20, 97, t);
      const elbow = at(shoulder, al, UA), hand = at(elbow, al - 12, FA);
      const j = { hip, shoulder, head, knee, ankle, foot: 0, elbow, hand, al };
      const pul = [196, 12];
      let behind = STACK(206, 8, 26, 182, t * 13);
      behind += L([206, 9], [pul[0] + 2, 9], 'fr') + L([200, 183], [238, 183], 'fr base');
      behind += DISC(pul, 4.6, 'hub');
      const cd = unit(sub(hand, pul));
      const mid = L(pul, add(hand, mul(cd, -9)), 'cable') + L(add(hand, mul(cd, -10)), add(hand, mul(cd, 3)), 'grip');
      return { j, body: sideBody(j), behind, mid };
    },
    muscles: j => ({ pb: M.back(j), sa: M.rearDelt(j) }),
    trace: j => at(j.shoulder, j.al - 6, UA + FA + 12),
  };

  /* ---------- rendering ---------- */
  function poseSVG(ex, t, uid, ghostT) {
    const s = ex.pose(t), b = s.body;
    const m = ex.muscles ? ex.muscles(s.j, s) : {};
    let o = '';
    if (ghostT != null) {
      const g = ex.pose(ghostT).body;
      o += `<path class="ghost" d="${g.base.join('')}${g.arms.flat().join('')}${(g.top || []).join('')}"/>`;
    }
    o += s.behind || '';
    const baseD = b.base.join('');
    o += `<path class="b" d="${baseD}"/>`;
    if (m.pb || m.sb) o += `<clipPath id="${uid}b"><path d="${baseD}"/></clipPath><g clip-path="url(#${uid}b)">${m.sb ? `<path class="ms" d="${m.sb}"/>` : ''}${m.pb ? `<path class="mp" d="${m.pb}"/>` : ''}</g>`;
    o += s.mid || '';
    for (const arm of b.arms) { const d = arm.join(''); o += `<path class="ko" d="${d}"/><path class="b" d="${d}"/>`; }
    if (m.pa || m.sa) {
      const armD = b.arms.flat().join('');
      o += `<clipPath id="${uid}a"><path d="${armD}"/></clipPath><g clip-path="url(#${uid}a)">${m.sa ? `<path class="ms" d="${m.sa}"/>` : ''}${m.pa ? `<path class="mp" d="${m.pa}"/>` : ''}</g>`;
    }
    if (b.top) { const d = b.top.join(''); o += `<path class="ko" d="${d}"/><path class="b" d="${d}"/>`; }
    o += s.front || '';
    return o;
  }

  function traceSVG(ex) {
    if (!ex.trace) return '';
    const n = 40, tracks = [];
    for (let i = 0; i <= n; i++) {
      const s = ex.pose(i / n), q = ex.trace(s.j, s);
      (typeof q[0] === 'number' ? [q] : q).forEach((p, k) => { (tracks[k] = tracks[k] || []).push(p); });
    }
    return tracks.map(raw => {
      const pts = [raw[0]];
      for (const p of raw) if (len(sub(p, pts[pts.length - 1])) > 0.6) pts.push(p);
      if (pts.length < 3) return '';
      const e = pts[pts.length - 1];
      let k = pts.length - 2;
      while (k > 0 && len(sub(e, pts[k])) < 7) k--;
      const u = unit(sub(e, pts[k])), nn = [-u[1], u[0]];
      const end = add(e, mul(u, -4));
      const body = pts.filter((p, i) => i > 0 && len(sub(p, e)) > 5);
      const tip = add(e, mul(u, 1.5)), b1 = add(add(e, mul(u, -6)), mul(nn, 4)), b2 = add(add(e, mul(u, -6)), mul(nn, -4));
      return `<path class="trace" d="M${body.concat([end]).map(P).join('L')}"/><path class="trace-head" d="M${P(tip)}L${P(b1)}L${P(b2)}Z"/>`;
    }).join('');
  }

  const DEFAULT_TEMPO = { bottom: 420, up: 1000, top: 480, down: 1900 };
  function cycle(ms, tempo) {
    const { bottom, up, top, down } = tempo || DEFAULT_TEMPO;
    let x = ms % (bottom + up + top + down);
    if (x < bottom) return 0; x -= bottom;
    if (x < up) return ease(x / up); x -= up;
    if (x < top) return 1; x -= top;
    return 1 - ease(x / down);
  }

  let uidN = 0;
  const ASPECT = 1.4, FLOOR_Y = 186;
  function mount(svg, id) {
    const ex = EX[id];
    if (!ex) throw new Error('Unknown exercise ' + id);
    const uid = 'f' + (++uidN) + '-';
    const hasFloor = ex.floor !== false;
    svg.setAttribute('viewBox', '0 0 280 200');
    svg.innerHTML = `${hasFloor ? '<path class="floor" d="M6 186H274"/>' : ''}<g class="tr">${traceSVG(ex)}</g><g class="dyn"></g>`;
    const dyn = svg.querySelector('.dyn'), tr = svg.querySelector('.tr'), floor = svg.querySelector('.floor');
    try {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const grow = b => { if (!b.width && !b.height) return; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); };
      for (const t of [0, 0.5, 1]) { dyn.innerHTML = poseSVG(ex, t, uid, null); grow(dyn.getBBox()); }
      grow(tr.getBBox());
      if (isFinite(x0)) {
        const pad = 12;
        x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
        if (hasFloor) y1 = Math.max(y1, FLOOR_Y + 8);
        let w = x1 - x0, h = y1 - y0;
        if (w / h < ASPECT) { const nw = h * ASPECT; x0 -= (nw - w) / 2; w = nw; }
        else { const nh = w / ASPECT; if (hasFloor) y0 = y1 - nh; else y0 -= (nh - h) / 2; h = nh; }
        svg.setAttribute('viewBox', `${r1(x0)} ${r1(y0)} ${r1(w)} ${r1(h)}`);
        if (floor) floor.setAttribute('d', `M${r1(x0)} ${FLOOR_Y}H${r1(x0 + w)}`);
        svg.style.setProperty('--zoom', r1(280 / w * 10) / 10);
      }
    } catch (e) { /* keep default framing */ }
    let last = -1, lastMode = '';
    return {
      ex, svg, view: ex.view,
      draw(t, mode) {
        const tt = Math.round(t * 400) / 400;
        if (tt === last && mode === lastMode) return;
        last = tt; lastMode = mode;
        dyn.innerHTML = mode === 'static' ? poseSVG(ex, 1, uid, 0) : poseSVG(ex, tt, uid, null);
      },
      tAt: ms => cycle(ms, ex.tempo),
    };
  }

  /* debug: report limb length errors (unreachable targets) */
  function audit() {
    const out = [];
    for (const [id, ex] of Object.entries(EX)) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const j = ex.pose(t).j;
        const chk = (a, b, l, name) => { if (a && b) { const e = Math.abs(len(sub(a, b)) - l); if (e > 0.8) out.push(`${id} t=${t} ${name} off by ${e.toFixed(1)}`); } };
        if (j.shoulder) { chk(j.shoulder, j.elbow, UA, 'upper arm'); chk(j.elbow, j.hand, FA, 'forearm'); chk(j.hip, j.knee, TH, 'thigh'); chk(j.knee, j.ankle, SH, 'shin'); }
        if (j.sh) for (let i = 0; i < 2; i++) { chk(j.sh[i], j.el[i], UA, 'upper arm ' + i); }
      }
    }
    return out;
  }

  return { mount, ids: Object.keys(EX), EX, poseSVG, traceSVG, audit };
})();

export default PF;
