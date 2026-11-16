// Upgrades — one job: the between-wave build system. After every cleared
// wave the night pauses and the keeper picks 1 of 3 cards from a pool of 6.
// Every effect is permanent for the run (reset by startGame), every card has
// a priced trade-off, and every card has a cap — so no build is free and no
// build is forever. Pickups (spread/shield/magnet, 12 s) stay as temporary
// bonuses; upgrades are the permanent badges in the HUD.
//
// Numbers are the design numbers (REVAMP-DESIGN.md §1b) — do not retune
// them here. Base stats live in player.js PLAYER and are never changed:
// damage 1, cooldown 0.55 s, range 210, speed 265, lightMax 200, ember heal 6.

import { roundRect } from './screens.js';

export const UPGRADE_CAPS = {
  damage: 4,          // pulse damage max (base 1 + 3 picks)
  lightMax: 400,      // lantern light max
  range: 340,         // pulse range max
  speed: 320,         // move speed max
  cooldownMin: 0.30,  // pulse cooldown floor
  emberHeal: 14,      // heal per ember max
  pulseDirections: 2, // pulse directions max (1 -> 2 opposite)
};

// Each entry: id, name (English, shown big on the card), subtitle
// (Indonesian, shown under the name), desc, lines (effect lines with a
// `good` flag: green = benefit, orange = trade-off), apply(state) and
// canOffer(state) — a card is offered only while taking it once more
// stays inside every cap it touches.
export const UPGRADE_POOL = [
  {
    id: 'heavy-wick',
    name: 'HEAVY WICK',
    subtitle: 'Sumbu Berat',
    desc: 'A thicker wick. Each pulse hits harder, but the flame burns slower and dimmer.',
    lines: [
      { text: 'Damage +1', good: true },
      { text: 'Cooldown +0.10s', good: false },
      { text: 'Max Light -10', good: false },
    ],
    apply(state) {
      const u = state.upgrades;
      u.damageBonus += 1;
      u.cooldownBonus += 0.10;
      u.lightMaxBonus -= 10;
      clampLightToMax(state);
    },
    canOffer(state) {
      // Damage 1 -> 4 max: three picks. Light has no floor cap by design.
      return state.upgrades.damageBonus < UPGRADE_CAPS.damage - 1;
    },
  },
  {
    id: 'deep-reservoir',
    name: 'DEEP RESERVOIR',
    subtitle: 'Penampung Dalam',
    desc: 'A deeper lantern. More light, richer embers — but the pulse cannot reach as far.',
    lines: [
      { text: 'Max Light +50', good: true },
      { text: 'Heal per Ember +2', good: true },
      { text: 'Pulse Range -10', good: false },
    ],
    apply(state) {
      const u = state.upgrades;
      u.lightMaxBonus += 50;
      u.emberHealBonus += 2;
      u.rangeBonus -= 10;
      clampLightToMax(state);
    },
    canOffer(state) {
      const u = state.upgrades;
      // Offer only while one more pick stays inside BOTH caps it touches:
      // lightMax 200 + bonus + 50 <= 400, ember heal 6 + bonus + 2 <= 12.
      return u.lightMaxBonus <= 150 && u.emberHealBonus <= 4;
    },
  },
  {
    id: 'far-beam',
    name: 'FAR BEAM',
    subtitle: 'Sorot Jauh',
    desc: 'A longer, faster beam. It reaches the far shadows — and drinks more oil to do it.',
    lines: [
      { text: 'Pulse Range +60', good: true },
      { text: 'Move Speed +15', good: true },
      { text: 'Cooldown +0.08s', good: false },
      { text: 'Ember Heal -1', good: false },
    ],
    apply(state) {
      const u = state.upgrades;
      u.rangeBonus += 60;
      u.speedBonus += 15;
      u.cooldownBonus += 0.08;
      u.emberHealBonus -= 1;
      clampLightToMax(state);
    },
    canOffer(state) {
      const u = state.upgrades;
      // Range 210 + bonus + 60 <= 340; speed 265 + bonus + 15 <= 310.
      return u.rangeBonus <= 70 && u.speedBonus <= 30;
    },
  },
  {
    id: 'swift-feet',
    name: 'SWIFT FEET',
    subtitle: 'Langkah Cepat',
    desc: 'Lighter boots, quicker hands. You outrun the dark — but carry less light.',
    lines: [
      { text: 'Move Speed +25', good: true },
      { text: 'Cooldown -0.07s', good: true },
      { text: 'Max Light -20', good: false },
    ],
    apply(state) {
      const u = state.upgrades;
      u.speedBonus += 25;
      u.cooldownBonus -= 0.07;
      u.lightMaxBonus -= 20;
      clampLightToMax(state);
    },
    canOffer(state) {
      const u = state.upgrades;
      // Speed 265 + bonus + 25 <= 320; cooldown 0.55 + bonus - 0.07 >= 0.30.
      return u.speedBonus <= 30 && (0.55 + u.cooldownBonus - 0.07) >= UPGRADE_CAPS.cooldownMin;
    },
  },
  {
    id: 'ember-heart',
    name: 'EMBER HEART',
    subtitle: 'Jantung Ember',
    desc: 'A heart that burns embers brighter. Every ember heals more — but the night keeps a share of your score.',
    lines: [
      { text: 'Heal per Ember +3', good: true },
      { text: 'Wave-Clear Heal +20', good: true },
      { text: 'Score -25%', good: false },
    ],
    apply(state) {
      const u = state.upgrades;
      u.emberHealBonus += 3;
      u.waveClearHeal += 20;
      u.scorePenalty += 1;
      clampLightToMax(state);
    },
    canOffer(state) {
      // Ember heal 6 + bonus + 3 <= 14.
      return state.upgrades.emberHealBonus <= 5;
    },
  },
  {
    id: 'twin-flame',
    name: 'TWIN FLAME',
    subtitle: 'Api Kembar',
    desc: 'The flame splits in two. A pulse behind you as well as before you — at a price in reach and rhythm.',
    lines: [
      { text: '+1 Pulse Direction', good: true },
      { text: 'Pulse Range -25', good: false },
      { text: 'Cooldown +0.12s', good: false },
    ],
    apply(state) {
      const u = state.upgrades;
      u.pulseDirections += 1;
      u.rangeBonus -= 25;
      u.cooldownBonus += 0.12;
      clampLightToMax(state);
    },
    canOffer(state) {
      return state.upgrades.pulseDirections < UPGRADE_CAPS.pulseDirections;
    },
  },
];

export function createUpgrades() {
  return {
    damageBonus: 0,
    lightMaxBonus: 0,
    rangeBonus: 0,
    speedBonus: 0,
    cooldownBonus: 0,
    emberHealBonus: 0,
    pulseDirections: 1,
    scorePenalty: 0, // number of Ember Heart picks (score x 0.75 each)
    waveClearHeal: 0, // light healed on every wave clear
    picks: {}, // card id -> times taken, for caps and the TAKEN xN label
  };
}

// Roll 3 distinct offerable cards with the seeded RNG (Fisher-Yates over
// the eligible ids). Returns the chosen ids; fewer than 3 when most of the
// pool is capped, [] when everything is capped (caller must not strand the
// player on an empty upgrade screen — see enterUpgradeMode in main.js).
export function rollUpgradeChoices(state) {
  const eligible = UPGRADE_POOL.filter((card) => card.canOffer(state)).map((card) => card.id);
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = state.rng.int(0, i);
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  state.upgradeChoices = eligible.slice(0, 3);
  return state.upgradeChoices;
}

// Apply a pick: run the card's effect, count it, celebrate, then hand the
// night back — mode 'playing' and the next wave starts at once. Returns
// false when the id was not offered (stale click / double keypress).
export function chooseUpgrade(state, id) {
  if (!state.upgradeChoices || !state.upgradeChoices.includes(id)) return false;
  const card = UPGRADE_POOL.find((c) => c.id === id);
  if (!card) return false;
  card.apply(state);
  state.upgrades.picks[id] = (state.upgrades.picks[id] || 0) + 1;
  if (state.audio && state.audio.upgradePick) state.audio.upgradePick();
  if (state.particles && state.player) {
    state.particles.popup(state.player.x, state.player.y - 46, card.name + '!', '#ffd98a');
    state.particles.ring(state.player.x, state.player.y, '#ffd76a', 120);
  }
  state.mode = 'playing';
  state.upgradeChoices = [];
  state.upgradeCardRects = [];
  if (state.startWaveFn) state.startWaveFn(state);
  return true;
}

// Ember Heart's wave-clear heal, called from waves.js at wave clear.
// Clamped to the effective max light — never overheals past it.
export function applyWaveClearHeal(state) {
  if (!state.upgrades || !state.player || state.upgrades.waveClearHeal <= 0) return;
  const max = 200 + (state.upgrades.lightMaxBonus || 0);
  state.player.light = Math.min(max, state.player.light + state.upgrades.waveClearHeal);
}

// Ember Heart's score tax: each pick multiplies banish score by 0.75,
// floored at the end. No upgrades state (old scenes) = no tax.
export function banishScore(state, base) {
  if (!state.upgrades) return base;
  const picks = state.upgrades.picks['ember-heart'] || 0;
  return Math.floor(base * Math.pow(0.75, picks));
}

// A one-line build identity for the HUD and the screenshot: the first
// dominant shape of the run wins. Empty until the build has a shape.
// (Reconciled at integration: design §4/§5 stage the upgrade shot with
// ONE Heavy Wick pick — badge DMG x2 — AND the label BUILD: GLASS CANNON
// in the same frame, so the damage identity fires from the first pick.)
export function buildLabel(state) {
  if (!state.upgrades) return '';
  const u = state.upgrades;
  if (u.damageBonus >= 1) return 'GLASS CANNON';
  if (u.lightMaxBonus >= 100) return 'DEEP WELL';
  if (u.pulseDirections >= 2) return 'TWIN FLAME';
  if (u.speedBonus >= 40) return 'SWIFT KEEPER';
  if (u.rangeBonus >= 60) return 'LONG LANTERN';
  return '';
}

// Short permanent-build badges for the HUD (upgrades = permanent, pickups
// = timed — the two must never look alike). Only non-zero effects appear.
export function upgradeBadges(state) {
  if (!state.upgrades) return [];
  const u = state.upgrades;
  const badges = [];
  if (u.damageBonus > 0) badges.push('DMG x' + (1 + u.damageBonus));
  if (u.rangeBonus !== 0) badges.push('RANGE ' + (210 + u.rangeBonus));
  if (u.speedBonus !== 0) badges.push('SPD ' + (265 + u.speedBonus));
  if (u.lightMaxBonus !== 0) badges.push('LIGHT ' + (200 + u.lightMaxBonus));
  if (u.emberHealBonus !== 0) badges.push('HEAL +' + (6 + u.emberHealBonus));
  if (u.pulseDirections >= 2) badges.push('x2 PULSE');
  if (u.scorePenalty > 0) {
    const pct = Math.round((1 - Math.pow(0.75, u.scorePenalty)) * 100);
    badges.push('SCORE -' + pct + '%');
  }
  return badges;
}

// The permanent-build badge strip: gold 18px bold on a dark backplate,
// above the light meter (bottom-left). Drawn by main.js after drawHud.
// Skipped entirely until the run has a build worth showing.
export function drawUpgradeBadges(ctx, state) {
  if (!state || !state.upgrades) return;
  const badges = upgradeBadges(state);
  const label = buildLabel(state);
  if (badges.length === 0 && !label) return;
  // In upgrade mode the BUILD label is drawn centred under the cards by
  // drawUpgradeCards — the strip carries the stat badges only, so the two
  // never print the same words on the same y band (polish 17 Nov: the
  // strip's BUILD suffix collided with the centred label).
  const showLabel = Boolean(label) && state.mode !== 'upgrade';
  const buildText = (list) => {
    let t = list.join(' · ');
    if (showLabel) t += (t ? '  ·  ' : '') + 'BUILD: ' + label;
    return t;
  };
  // Fit the strip: shrink the font, then drop trailing badges, so a long
  // build never overflows the 640 px backplate (a 2-pick run already
  // overflowed it and ran into the centred BUILD label — polish 17 Nov).
  ctx.save();
  let size = 18;
  let display = badges.slice();
  let text = buildText(display);
  const fits = () => {
    ctx.font = 'bold ' + size + 'px Georgia, serif';
    return ctx.measureText(text).width + 28 <= 640;
  };
  while (size > 15 && !fits()) size -= 1;
  while (display.length > 1 && !fits()) {
    display.pop();
    text = buildText(display);
  }
  if (!text) { ctx.restore(); return; }
  const w = Math.min(640, ctx.measureText(text).width + 28);
  ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
  roundRect(ctx, 18, 612, w, 28, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, 18, 612, w, 28, 8);
  ctx.stroke();
  ctx.fillStyle = '#ffd98a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 30, 627);
  ctx.restore();
}

// The upgrade screen itself: the world stays visible behind a dim veil,
// three big cards in front. Rendered by main.js when mode === 'upgrade'.
export function drawUpgradeCards(ctx, state) {
  const W = state.world ? state.world.w : 1280;
  const H = state.world ? state.world.h : 720;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 5, 12, 0.66)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('CHOOSE YOUR LIGHT', W / 2, 120);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillText('The night pauses. Pick one — the next wave waits.', W / 2, 156);

  const cardW = 300;
  const cardH = 340;
  const gap = 40;
  const startX = (W - 3 * cardW - 2 * gap) / 2;
  const y = 190;
  const choices = Array.isArray(state.upgradeChoices) ? state.upgradeChoices : [];
  state.upgradeCardRects = [];

  for (let i = 0; i < choices.length && i < 3; i++) {
    const card = UPGRADE_POOL.find((c) => c.id === choices[i]);
    if (!card) continue;
    const x = startX + i * (cardW + gap);
    const cx = x + cardW / 2;

    ctx.fillStyle = 'rgba(5, 6, 15, 0.85)';
    roundRect(ctx, x, y, cardW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, cardW, cardH, 14);
    ctx.stroke();

    // Key number in a gold circle.
    ctx.beginPath();
    ctx.arc(x + 26, y + 26, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 179, 71, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText(String(i + 1), x + 26, y + 32);

    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.fillText(card.name, cx, y + 78);
    ctx.fillStyle = '#c9c4d6';
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillText(card.subtitle, cx, y + 104);

    ctx.strokeStyle = 'rgba(255, 179, 71, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 120);
    ctx.lineTo(x + cardW - 30, y + 120);
    ctx.stroke();

    // Description, wrapped to at most four lines: the pool descs run
    // 76–108 chars, and the old two-line cap cut every one mid-sentence
    // ("…hits harder, but" — polish 17 Nov). Four lines still leave room
    // for four effect lines + TAKEN inside the 340 px card.
    ctx.fillStyle = '#c9c4d6';
    ctx.font = 'italic 15px Georgia, serif';
    let ty = y + 146;
    for (const line of wrapText(ctx, card.desc, cardW - 60, 4)) {
      ctx.fillText(line, cx, ty);
      ty += 20;
    }

    // Effect lines: green for the gift, orange for the price.
    ctx.font = '18px Georgia, serif';
    ty += 8;
    for (const line of card.lines || []) {
      ctx.fillStyle = line.good ? '#8affc1' : '#ff9a6a';
      ctx.fillText(line.text, cx, ty);
      ty += 24;
    }

    const taken = state.upgrades && state.upgrades.picks ? (state.upgrades.picks[card.id] || 0) : 0;
    if (taken > 0) {
      ctx.fillStyle = '#ffd98a';
      ctx.font = '14px Georgia, serif';
      ctx.fillText('TAKEN x' + taken, cx, y + cardH - 16);
    }

    state.upgradeCardRects.push({ x, y, w: cardW, h: cardH, id: card.id });
  }

  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillText('PRESS 1 / 2 / 3  —  OR CLICK A CARD', W / 2, 580);

  const label = buildLabel(state);
  if (label) {
    // Between the cards (end y 530) and PRESS (y 580): the old y 616 shared
    // the badge strip's band and the two printed over each other (polish
    // 17 Nov).
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('BUILD: ' + label, W / 2, 556);
  }
  ctx.restore();
}

// Which card (if any) sits under a canvas point — for click-to-pick.
export function upgradeCardAt(state, x, y) {
  const rects = state && state.upgradeCardRects;
  if (!Array.isArray(rects)) return null;
  for (const r of rects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id;
  }
  return null;
}

// After a max-light change, current light must never sit above the new max.
// (No floor here: a keeper at 20 light who takes Heavy Wick stays at 20.)
export function clampLightToMax(state) {
  if (!state || !state.player || !state.upgrades) return;
  const max = 200 + (state.upgrades.lightMaxBonus || 0);
  if (state.player.light > max) state.player.light = max;
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}
