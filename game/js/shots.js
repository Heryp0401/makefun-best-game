// Screenshot scenes — one job: deterministic, seeded stage sets for the four
// screenshots. Each scene builds a fixed state (fixed simulated time, no wall
// clock), renders one frame, and sets window.__shotReady so the capture
// script knows the frame is complete.
//
// Revamp staging (REVAMP-DESIGN.md §4/§5): the gameplay scene is the
// upgrade intermission itself — the world dimmed behind three cards —
// the boss scene is Warden phase 2 (12 bolts, THE WARDEN RAGES), and the
// game-over scene shows both near-miss lines with the judge's Wave 7 text.
// All staged state is set explicitly here (never via the live loop), so a
// scene is the same for a seed.

import { createPlayer } from './player.js';
import { spawnEnemy } from './enemies.js';
import { createUpgrades, rollUpgradeChoices } from './upgrades.js';

export const SHOT_SCENES = ['title', 'gameplay', 'boss', 'gameover'];

export function applyShotScene(state, scene, seed) {
  state.rng = state.makeRng(seed);
  state.time = 12.4; // fixed simulated time: lighthouse beam + star twinkle frozen
  state.particles.clear();
  state.enemies.length = 0;
  state.bolts.length = 0;
  state.pulses.length = 0;
  state.embersList.length = 0;
  state.pickups.length = 0;
  state.shake = 0;
  state.flash = 0;
  state.thiefAlert = 0;
  state.banner = null;

  if (scene === 'title') {
    state.mode = 'title';
    state.best = 1240;
    state.score = 0;
    state.wave = 1;
    state.player = createPlayer();
    state.player.x = 640;
    state.player.y = 430;
    state.player.aim = -0.5;
    return;
  }

  if (scene === 'gameplay') {
    // The upgrade intermission at Wave 4: the world stays visible (dimmed)
    // behind three cards. One Heavy Wick + one Far Beam picked before, so
    // the badge reads DMG x2 · RANGE 270 and the build is GLASS CANNON.
    state.mode = 'upgrade';
    state.score = 1875;
    state.best = 1875;
    state.embers = 23;
    state.banished = 31;
    state.wave = 4;
    state.player = createPlayer();
    state.player.x = 600;
    state.player.y = 400;
    state.player.light = 142;
    state.player.aim = 0.35;
    state.player.spreadTimer = 8;
    state.upgrades = createUpgrades();
    state.upgrades.damageBonus = 1;
    state.upgrades.rangeBonus = 60;
    // The matching trade-offs of those two real picks, so the staged state
    // is what a live run would hold after 1x Heavy Wick + 1x Far Beam:
    // Heavy Wick −10 max light, Far Beam +0.08 s cooldown, −1 ember heal,
    // +15 speed. (Without this the meter read 142 / 200; a real pick reads
    // 142 / 190. Polish 17 Nov.)
    state.upgrades.lightMaxBonus = -10;
    state.upgrades.cooldownBonus = 0.18;
    state.upgrades.emberHealBonus = -1;
    state.upgrades.speedBonus = 15;
    state.upgrades.picks = { 'heavy-wick': 1, 'far-beam': 1 };
    rollUpgradeChoices(state); // seeded 3-card roll for the cards on screen
    // Design §4 names these three cards for this frame; the seeded roll is
    // kept for live play, the shot stages the §4 trio explicitly. All three
    // are legally offerable in this state (caps checked in canOffer).
    state.upgradeChoices = ['heavy-wick', 'deep-reservoir', 'far-beam'];
    // Beacons, staged exactly per §5: A lit, B dark and mid-channel (60%),
    // C lit — the gold tether and the RELIGHTING bar are drawn from this.
    state.beacons = [
      { id: 'A', x: 348, y: 392, lit: true, channel: 0 },
      { id: 'B', x: 932, y: 392, lit: false, channel: 0.54 },
      { id: 'C', x: 640, y: 500, lit: true, channel: 0 },
    ];
    state.darkBeaconCount = 1;
    // The world behind the cards: a Flicker in its ×2 window, a Thief
    // closing on embers, a cracked Shellback, a Spitter at range.
    // Staged in the VISIBLE margins, not the card zone: the three cards
    // cover x 150–1130, y 190–530, so actors staged there were invisible
    // behind the cards in the first render (polish 17 Nov). The beacons
    // themselves stay at their game positions (behind the cards) — their
    // presence is carried by the beacon bar, the dots panel and the tether.
    // The thief's THIEF! banner is suppressed in upgrade mode (screens.js):
    // the intermission freezes the thief, so the alert is unactionable.
    const flicker = spawnEnemy(state, 'flicker', 1210, 300);
    flicker.vulnerableTimer = 0.4;
    flicker.hidden = false;
    state.particles.popup(1210, 300 - flicker.radius - 6, '×2!', '#ffd76a');
    const thief = spawnEnemy(state, 'thief', 950, 660);
    thief.stolenEmbers = 1;
    // Bottom band, clear of the cards (end y 530), the PRESS line (y 580)
    // and the badge strip (y 612): the old left-strip spot put the
    // 20 px SHELL CRACKED popup half off the left screen edge ("HELL
    // CRACKED" — polish 17 Nov).
    const shellback = spawnEnemy(state, 'shellback', 300, 580);
    shellback.shellBroken = true;
    state.particles.popup(300, 580 - shellback.radius - 6, 'SHELL CRACKED', '#7fb2ff');
    spawnEnemy(state, 'spitter', 70, 250);
    for (let i = 0; i < 6; i++) {
      state.embersList.push({
        x: 860 + i * 24, y: 695,
        vx: 0, vy: 0, value: 10, life: 14, bob: i * 1.1,
      });
    }
    state.pulses.push({ x: 600, y: 400, radius: 150, maxRadius: 270, life: 0.3, maxLife: 0.35, damage: 2 });
    state.particles.burst(1210, 300, '#e8e4ff', 10, 90, 0.5, 3);
    state.particles.ring(600, 400, '#ffd76a', 270);
    state.bolts.push({ x: 130, y: 300, vx: -170, vy: 20, radius: 7, life: 3, damage: 12 });
    return;
  }

  if (scene === 'boss') {
    state.mode = 'playing';
    state.score = 4210;
    state.best = 4210;
    state.embers = 41;
    state.banished = 58;
    state.wave = 5;
    state.player = createPlayer();
    state.player.x = 520;
    state.player.y = 480;
    state.player.light = 118;
    state.player.aim = -0.7;
    state.player.shield = true;
    // Warden stands clear of the lighthouse tower (tower spans x 614-666),
    // so the boss reads at a glance. Phase 2 is set EXPLICITLY: the shot
    // uses HP 17/31 = 55%, above the 50% enrage threshold, so the phase
    // field — not HP — is what the draw reads.
    const warden = spawnEnemy(state, 'warden', 830, 300);
    warden.hp = 17;
    warden.phase = 2;
    warden.raged = true;
    warden.color = '#ff5a3c';
    warden.speed = 40;
    warden.burstTimer = 2.4;
    spawnEnemy(state, 'drifter', 350, 330);
    spawnEnemy(state, 'drifter', 1010, 380);
    spawnEnemy(state, 'spitter', 1040, 500);
    // Phase-2 burst: 12 bolts, not 8.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      state.bolts.push({
        x: 830 + Math.cos(a) * 90, y: 300 + Math.sin(a) * 90,
        vx: Math.cos(a) * 130, vy: Math.sin(a) * 130,
        radius: 7, life: 4, damage: 12,
      });
    }
    state.particles.burst(830, 300, '#d4a24f', 20, 160, 0.6, 3.5);
    state.particles.ring(830, 300, '#ff5a3c', 160);
    state.pulses.push({ x: 520, y: 480, radius: 120, maxRadius: 210, life: 0.28, maxLife: 0.35, damage: 1 });
    state.banner = {
      title: 'WAVE 5 — THE WARDEN',
      sub: 'The keeper of the drowned light has come. Hold your flame.',
      time: 2.2,
    };
    return;
  }

  if (scene === 'gameover') {
    state.mode = 'gameover';
    // ONE coherent run across all four shots (polish 17 Nov): the best score
    // can only grow through a run, so the game-over best must clear the boss
    // shot's 4210 — the old staging (score 3420, best 3457) contradicted the
    // boss frame. Counters are monotonic vs the boss shot (4210 / 58 / 41)
    // and the gameplay shot (1875 / 31 / 23); the near-miss lines are kept
    // exactly: 37 short of best, Dawn 3 waves away.
    state.score = 6840;
    // Best 6877: the second near-miss line needs a best the run lost to by
    // 37 (< 500) — "37 short of your best".
    state.best = 6877;
    state.embers = 52;
    state.banished = 71;
    state.wave = 7;
    state.player = createPlayer();
    state.player.x = 640;
    state.player.y = 430;
    state.player.light = 0;
    state.player.aim = -0.5;
    spawnEnemy(state, 'drifter', 380, 260);
    spawnEnemy(state, 'drifter', 900, 300);
    spawnEnemy(state, 'spitter', 760, 520);
    state.particles.burst(640, 430, '#ffd76a', 22, 170, 0.7, 3.5);
    return;
  }

  // Unknown scene: fall back to the title.
  state.mode = 'title';
}
