// Beacons — one job: the three beach lights. Each wave starts with some of
// them dark; stand still beside a dark one for 0.9 s (no pulse while you do)
// to relight it. A lit beacon burns shadows in its aura, pays light at wave
// clear, and doubles the wave-clear bonus when all three burn. A dark beacon
// slows the keeper and calls extra drifters next wave — ignoring the beacons
// is expensive, not free.

import { damageEnemy } from './enemies.js';
import { effectiveLightMax } from './player.js';

export const BEACONS = [
  { id: 'A', x: 348, y: 392 },
  { id: 'B', x: 932, y: 392 },
  { id: 'C', x: 640, y: 500 },
];
export const BEACON_RADIUS = 46;
export const BEACON_CHANNEL = 0.9;
export const BEACON_AURA = 130;
export const BEACON_AURA_DPS = 3;
export const BEACON_DARK_SPEED_PENALTY = 0.15;
export const BEACON_IFRAMES_ON_LIT = 0.6;
export const BEACON_LIT_WAVE_CLEAR_LIGHT = 15;
export const BEACON_DARK_DRIFTER_PENALTY = 2;
export const BEACON_DRIFTER_PENALTY_CAP = 4;

const BEACON_SIDE = { A: 'west', B: 'east', C: 'south' };

export function buildBeaconSet(state, wave) {
  if (!state) return;
  const darkCount = wave <= 3 ? 1 : wave <= 6 ? 2 : 3;
  const chosen = new Set();
  while (chosen.size < darkCount) {
    chosen.add(state.rng.int(0, BEACONS.length - 1));
  }
  state.beacons = BEACONS.map((b, i) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    lit: !chosen.has(i),
    channel: 0,
  }));
  if (wave === 1) state.extraDrifters = 0;
  state.darkBeaconCount = darkCount;
}

export function updateBeacons(state, dt) {
  if (!state || !state.beacons || !state.player) return;
  const p = state.player;

  // Channel: nearest dark beacon within reach, keeper standing still.
  let nearest = null;
  let nearestDist = Infinity;
  for (const b of state.beacons) {
    if (b.lit) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d <= BEACON_RADIUS && d < nearestDist) {
      nearest = b;
      nearestDist = d;
    }
  }

  if (nearest && !p.moving && p.light > 0) {
    nearest.channel += dt;
    p.channeling = true;
    if (nearest.channel >= BEACON_CHANNEL) {
      nearest.lit = true;
      nearest.channel = 0;
      p.channeling = false;
      p.invulnerable = BEACON_IFRAMES_ON_LIT;
      state.darkBeaconCount = Math.max(0, (state.darkBeaconCount || 0) - 1);
      state.audio.beaconLit();
      state.particles.ring(nearest.x, nearest.y, '#ffd98a', BEACON_AURA);
      state.particles.burst(nearest.x, nearest.y - 8, '#ffd76a', 18, 150, 0.6, 3);
      state.particles.popup(nearest.x, nearest.y - 40, 'BEACON ' + nearest.id + ' LIT!', '#ffd98a');
    }
  } else {
    // Moving, out of reach, or no dark beacon near: the channel breaks.
    for (const b of state.beacons) b.channel = 0;
    p.channeling = false;
  }

  // Aura: a lit beacon burns every shadow inside its light, 3 damage/sec.
  // Damage is accumulated per enemy and dealt in whole points so the
  // per-frame amount never depends on frame rate.
  for (const b of state.beacons) {
    if (!b.lit) continue;
    for (const e of [...state.enemies]) {
      if (state.enemies.indexOf(e) === -1) continue;
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      if (dx * dx + dy * dy > BEACON_AURA * BEACON_AURA) continue;
      e.auraAccum = (e.auraAccum || 0) + BEACON_AURA_DPS * dt;
      if (e.auraAccum >= 1) {
        const dmg = Math.floor(e.auraAccum);
        e.auraAccum -= dmg;
        damageEnemy(state, e, dmg);
      }
    }
  }
}

export function cancelBeaconChannel(state) {
  if (!state || !state.beacons) return;
  for (const b of state.beacons) b.channel = 0;
  if (state.player) state.player.channeling = false;
}

// Wave clear, called once by the wave director. Heals the keeper for every
// lit beacon, returns the wave-clear score multiplier (2 when all three burn,
// else 1), and — when any beacon is still dark — banks +2 drifters for the
// next wave (capped at +4 across the whole run) and remembers which side
// called them, for the banner text.
export function applyWaveClearBeacons(state) {
  if (!state || !state.beacons || !state.player) return 1;
  const p = state.player;
  const litBeacons = state.beacons.filter((b) => b.lit);
  // Heal clamps to the EFFECTIVE max (Deep Reservoir can raise it past 200).
  const maxLight = effectiveLightMax(state.upgrades);
  for (const b of litBeacons) {
    p.light = Math.min(maxLight, p.light + BEACON_LIT_WAVE_CLEAR_LIGHT);
    state.particles.popup(b.x, b.y - 40, '+' + BEACON_LIT_WAVE_CLEAR_LIGHT + ' LIGHT — BEACON ' + b.id, '#ffd98a');
  }
  if (litBeacons.length === state.beacons.length) return 2;
  state.extraDrifters = Math.min(
    BEACON_DRIFTER_PENALTY_CAP,
    (state.extraDrifters || 0) + BEACON_DARK_DRIFTER_PENALTY,
  );
  const dark = state.beacons.find((b) => !b.lit);
  if (dark) state.darkBeaconBanner = BEACON_SIDE[dark.id] || null;
  return 1;
}

export function darkBeaconCount(state) {
  if (state && typeof state.darkBeaconCount === 'number') return state.darkBeaconCount;
  if (!state || !state.beacons) return 0;
  return state.beacons.filter((b) => !b.lit).length;
}

function beaconRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawBeacon(ctx, b, time, state) {
  ctx.save();
  ctx.textAlign = 'center';

  // The lit beacon's glow goes down first, under post and flame.
  if (b.lit) {
    const glow = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, BEACON_AURA);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.16)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BEACON_AURA, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stone post + bowl.
  ctx.fillStyle = '#2a3049';
  ctx.fillRect(b.x - 5, b.y - 4, 10, 26);
  ctx.fillStyle = '#3a4266';
  ctx.beginPath();
  ctx.arc(b.x, b.y - 4, 11, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  if (b.lit) {
    // Orange flame, flickering.
    const flicker = Math.sin(time * 9 + b.x) * 1.5;
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.arc(b.x, b.y - 14, 9 + flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(b.x, b.y - 14, 4.5 + flicker * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText(b.id, b.x, b.y - 32);
    ctx.font = '13px Georgia, serif';
    ctx.fillText('LIT', b.x, b.y + 38);
  } else {
    // Grey smoke drifting up from a cold bowl.
    ctx.fillStyle = 'rgba(138, 138, 154, 0.7)';
    for (let i = 0; i < 3; i++) {
      const rise = ((time * 14 + i * 12) % 30);
      ctx.beginPath();
      ctx.arc(b.x - 6 + i * 6 + Math.sin(time * 2 + i) * 3, b.y - 14 - rise, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#8a8a9a';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText(b.id, b.x, b.y - 32);
    ctx.font = '13px Georgia, serif';
    ctx.fillText('DARK', b.x, b.y + 38);
  }

  // Channel in progress: progress ring + gold tether + RELIGHTING text.
  if (b.channel > 0 && state && state.player) {
    const frac = Math.min(1, b.channel / BEACON_CHANNEL);
    ctx.strokeStyle = 'rgba(255, 217, 138, 0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = '#ffd98a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillText('RELIGHTING…', b.x, b.y - 52);
  }
  ctx.restore();
}

// Top-centre bar, only while a beacon is being relit.
export function drawBeaconHudBar(ctx, state) {
  if (!state || !state.beacons) return;
  const ch = state.beacons.find((b) => b.channel > 0);
  if (!ch) return;
  ctx.save();
  ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
  beaconRoundRect(ctx, 470, 16, 340, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'left';
  const pct = Math.round((ch.channel / BEACON_CHANNEL) * 100);
  ctx.fillText('BEACON ' + ch.id + ': RELIGHTING ' + pct + '%', 484, 39);
  ctx.restore();
}
