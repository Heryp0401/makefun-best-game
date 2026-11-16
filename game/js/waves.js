// Waves — one job: the wave director. Builds each wave's spawn queue
// (composition grows with the wave number, every 5th wave a Warden), drips
// enemies in over time, and calls the wave-clear / wave-start hooks.
//
// Composition (revamp §1a): the totals stay close to the old curve, but
// each wave unlocks something new — Flicker on 3, Thief on 4, Shellback
// on 6 — so a late wave feels new, not just busier.
//
// Wave clear settles, in order: beacon rewards (beacons.js) + Ember Heart
// heal (upgrades.js), then the wave-clear bonus, then — wave 10 — Dawn
// (mode 'victory'), otherwise the 3 s breather ends in the upgrade screen
// (main.js enterUpgradeMode), never straight into the next wave.

import { buildBeaconSet, applyWaveClearBeacons } from './beacons.js';
import { applyWaveClearHeal } from './upgrades.js';

export function buildWave(state, wave) {
  const queue = [];
  // A dark beacon left burning calls +2 drifters total for the next wave
  // (banked in state.extraDrifters, capped +4 across the run — §1c).
  const drifters = 4 + wave + (state.extraDrifters || 0);
  const spitters = wave >= 2 ? 1 + Math.floor(wave * 0.6) : 0;
  const brutes = wave >= 3 ? Math.floor((wave - 1) / 2) : 0;
  const flickers = wave >= 3 ? Math.min(5, 1 + Math.floor((wave - 3) / 2)) : 0;
  const thieves = wave >= 4 ? Math.min(3, 1 + Math.floor((wave - 4) / 3)) : 0;
  const shellbacks = wave >= 6 ? Math.min(4, 1 + Math.floor((wave - 6) / 2)) : 0;
  for (let i = 0; i < drifters; i++) queue.push('drifter');
  for (let i = 0; i < spitters; i++) queue.push('spitter');
  for (let i = 0; i < brutes; i++) queue.push('brute');
  for (let i = 0; i < flickers; i++) queue.push('flicker');
  for (let i = 0; i < thieves; i++) queue.push('thief');
  for (let i = 0; i < shellbacks; i++) queue.push('shellback');
  // Shuffle with the seeded rng so a wave is the same for a seed.
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(state.rng.next() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (wave % 5 === 0) queue.unshift('warden');
  return queue;
}

// Named first-appearance milestones, shown as the wave banner sub-line.
export function waveMilestone(wave) {
  if (wave === 3) return 'FIRST FLICKER';
  if (wave === 4) return 'THE THIEF COMES';
  if (wave === 6) return 'SHELLBACK WALKS';
  return null;
}

export function startWave(state) {
  state.wave += 1;
  buildBeaconSet(state, state.wave);
  state.spawnQueue = buildWave(state, state.wave);
  state.spawnTimer = 0.6;
  state.betweenWaves = 0;
  state.waveClearDone = false;
  const isBoss = state.wave % 5 === 0;
  const milestone = waveMilestone(state.wave);
  state.banner = {
    title: isBoss ? 'WAVE ' + state.wave + ' — THE WARDEN' : 'WAVE ' + state.wave,
    sub: isBoss
      ? 'The keeper of the drowned light has come. Hold your flame.'
      : milestone || waveFlavor(state),
    time: 2.6,
  };
  if (isBoss) state.audio.bossRoar();
  else state.audio.horn();
}

export function waveFlavor(state) {
  const lines = [
    'The shadows rise from the sea.',
    'They smell the lantern oil.',
    'Hold the light. Do not run.',
    'The night grows bolder.',
    'Embers are your lifeline — gather them.',
    'The tide brings more of them.',
  ];
  return lines[(state.wave - 1) % lines.length];
}

export function updateWaves(state, dt) {
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = Math.max(0.45, 1.15 - state.wave * 0.05);
      const kind = state.spawnQueue.shift();
      spawnAtEdgeLocal(state, kind);
    }
  } else if (state.enemies.length === 0 && state.mode === 'playing') {
    // Wave cleared: bonus + pickup drop, then a breather before the next.
    // The bonus fires once, tracked by a flag (never a float comparison).
    state.betweenWaves += dt;
    if (!state.waveClearDone) {
      state.waveClearDone = true;
      // Beacons settle first: lit beacons heal, all three lit doubles the
      // bonus, a dark beacon banks +2 drifters for the next wave.
      const mult = applyWaveClearBeacons(state);
      // Endless Night+ past Dawn doubles every score source (§1d).
      const endlessMult = state.wave > 10 ? 2 : 1;
      const bonus = 100 * state.wave * mult * endlessMult;
      state.score += bonus;
      state.audio.waveClear();
      state.particles.popup(state.player.x, state.player.y - 46,
        mult === 2 ? 'WAVE CLEAR +' + bonus + ' · ALL BEACONS LIT ×2' : 'WAVE CLEAR  +' + bonus, '#8affc1');
      if (mult === 1 && state.darkBeaconBanner) {
        state.banner = {
          title: 'THE DARK BEACON CALLS',
          sub: 'The dark beacon calls them — +2 drifters from the ' + state.darkBeaconBanner + '.',
          time: 2.6,
        };
      }
      applyWaveClearHeal(state); // Ember Heart: +20 light per pick on clear
      dropPickup(state);
      // Dawn: clearing Wave 10 wins the night — no upgrade screen after it.
      if (state.wave === 10 && !state.won) {
        state.won = true;
        state.mode = 'victory';
      }
    }
    // Dawn won: the victory screen owns the flow now, never the upgrade
    // screen and never the next wave (Enter in victory starts Endless).
    if (state.mode === 'victory') return;
    // The 3 s breather ends in the upgrade screen, not in the next wave:
    // the next wave only starts once the keeper has picked 1 of 3 cards
    // (main.js enterUpgradeMode). No timer on the choice itself.
    if (state.betweenWaves > 3.0) state.enterUpgradeMode(state);
  }
}

function spawnAtEdgeLocal(state, kind) {
  // Local alias so waves.js does not need the enemies module's import cycle
  // in the other direction; the spawn itself lives here for the director.
  const m = 46;
  const side = state.rng.int(0, 3);
  let x, y;
  if (side === 0) { x = state.rng.range(m, state.world.w - m); y = -m; }
  else if (side === 1) { x = state.rng.range(m, state.world.w - m); y = state.world.h + m; }
  else if (side === 2) { x = -m; y = state.rng.range(m, state.world.h - m); }
  else { x = state.world.w + m; y = state.rng.range(m, state.world.h - m); }
  // A thief needs something worth stealing: seed the ground with embers
  // (at least 6) before it arrives, so its first act is a chase, not a wait.
  if (kind === 'thief') {
    while (state.embersList.length < 6) {
      state.embersList.push({
        x: state.rng.range(60, state.world.w - 60),
        y: state.rng.range(60, state.world.h - 60),
        vx: 0, vy: 0,
        value: 10, life: 14, bob: state.rng.range(0, Math.PI * 2),
      });
    }
  }
  // Imported lazily via the state's spawn hook to avoid a cycle.
  state.spawnEnemy(kind, x, y);
}

export function dropPickup(state) {
  const kinds = ['spread', 'shield', 'magnet'];
  const kind = kinds[state.rng.int(0, kinds.length - 1)];
  const a = state.rng.angle();
  state.pickups.push({
    kind,
    x: state.player.x + Math.cos(a) * 180,
    y: state.player.y + Math.sin(a) * 140,
    life: 12,
    bob: 0,
  });
}
