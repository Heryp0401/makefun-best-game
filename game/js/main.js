// Emberlight — main loop and game state. One job: own the state, run the
// frame (update → render), wire input/audio/waves/enemies together, and
// expose the deterministic ?shot= scene mode for screenshots.
//
// The game: you are the keeper of a lighthouse on a small island. Shadows rise
// from the sea each night. Your lantern light is your health AND your weapon:
// every hit shrinks it, every ember you gather feeds it back. Survive the
// waves. Every 5th wave, the Warden comes.

import { makeRng, mulberry32 } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createPlayer, updatePlayer, hurtPlayer, healLight, drawPlayer, effectiveCooldown, effectivePulseDamage, effectivePulseRange, effectiveEmberHeal, beaconSpeedMultiplier } from './player.js';
import { spawnEnemy, updateEnemies, damageEnemy, drawEnemy } from './enemies.js';
import { startWave, updateWaves } from './waves.js';
import { createUpgrades, rollUpgradeChoices, chooseUpgrade, drawUpgradeCards, drawUpgradeBadges, upgradeCardAt } from './upgrades.js';
import { updateBeacons, cancelBeaconChannel, drawBeacon, drawBeaconHudBar } from './beacons.js';
import { drawBackground, drawHud, drawTitle, drawPause, drawGameOver, drawVictory } from './screens.js';
import { applyShotScene } from './shots.js';

const WORLD = { w: 1280, h: 720 };
const BEST_KEY = 'emberlight-best-score';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const state = {
  mode: 'title', // title | playing | paused | upgrade | victory | gameover
  world: WORLD,
  time: 0,
  score: 0,
  best: 0,
  embers: 0,
  banished: 0,
  wave: 0,
  night: 48, // the logbook night — the judge takes the lamp on Night 48 (§2)
  won: false, // true once Wave 10 (Dawn) is cleared
  beacons: [], // beach lights, built per wave by waves.js startWave
  darkBeaconCount: 0,
  extraDrifters: 0, // banked +2 drifter penalty for dark beacons (§1c)
  darkBeaconBanner: null, // 'west' | 'east' | 'south', for the banner text
  thiefAlert: 0, // seconds left of the THIEF! HUD alert (enemies.js sets it)
  player: createPlayer(),
  upgrades: createUpgrades(),
  upgradeChoices: [],
  upgradeCardRects: [],
  enemies: [],
  bolts: [],
  pulses: [],
  embersList: [],
  pickups: [],
  spawnQueue: [],
  spawnTimer: 0,
  betweenWaves: 0,
  waveClearDone: false,
  banner: null,
  shake: 0,
  flash: 0,
  rng: makeRng((Date.now() % 2147483647) || 1),
  makeRng,
  particles: createParticles(),
  audio: createAudio(),
  spawnEnemy(kind, x, y) { return spawnEnemy(state, kind, x, y); },
  damagePlayer(amount, x, y) { return damagePlayer(state, amount, x, y); },
  startWaveFn: startWave, // upgrades.js calls this after a pick, no import cycle
  // Between-wave pause: roll 3 cards and wait for a pick. No timer — the
  // next wave starts only from chooseUpgrade. If every card is capped
  // (roll returns []), skip the screen and keep the night moving.
  enterUpgradeMode() {
    const choices = rollUpgradeChoices(state);
    if (choices.length === 0) {
      state.particles.popup(state.player.x, state.player.y - 46, 'THE LIGHT HOLDS — NO UPGRADES LEFT', '#ffd98a');
      startWave(state);
      return;
    }
    state.mode = 'upgrade';
    state.banner = null;
  },
};

try {
  state.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
} catch {
  state.best = 0;
}

const input = createInput(canvas);

function saveBest() {
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem(BEST_KEY, String(state.best)); } catch { /* private mode */ }
  }
}

// --- combat ---------------------------------------------------------------

function firePulse() {
  const p = state.player;
  if (p.channeling) return; // relighting a beacon takes both hands
  if (p.pulseTimer > 0) return;
  // Cooldown, damage and range come from the run's permanent upgrades;
  // the spread pickup only adds extra angles around each direction.
  p.pulseTimer = effectiveCooldown(state.upgrades);
  state.audio.pulse();
  const baseDirs = state.upgrades.pulseDirections >= 2 ? [0, Math.PI] : [0];
  const dirs = [];
  for (const base of baseDirs) {
    dirs.push(base);
    if (p.spreadTimer > 0) {
      dirs.push(base - 0.42);
      dirs.push(base + 0.42);
    }
  }
  const range = effectivePulseRange(state.upgrades);
  const damage = effectivePulseDamage(state.upgrades);
  for (const off of dirs) {
    state.pulses.push({
      x: p.x, y: p.y,
      angle: p.aim + off,
      radius: 26,
      maxRadius: range,
      life: 0.38, maxLife: 0.38,
      damage,
    });
  }
  state.particles.ring(p.x, p.y, '#ffd76a', range);
  state.flash = Math.max(state.flash, 0.12);
}

function damagePlayer(state, amount, x, y) {
  if (state.mode !== 'playing') return;
  const result = hurtPlayer(state.player, amount);
  if (result === false) return;
  state.shake = Math.max(state.shake, 10);
  state.flash = Math.max(state.flash, 0.22);
  if (result === 'shield') {
    state.audio.pickup();
    state.particles.popup(state.player.x, state.player.y - 40, 'SHIELD HELD', '#8cdcff');
    state.particles.burst(state.player.x, state.player.y, '#8cdcff', 16, 160, 0.5, 3);
    return;
  }
  state.audio.hit();
  cancelBeaconChannel(state); // a hit breaks the relight channel
  state.particles.burst(state.player.x, state.player.y, '#ff5a3c', 22, 200, 0.6, 3.5);
  if (result === 'dead') {
    state.mode = 'gameover';
    saveBest();
    state.audio.gameOver();
    state.particles.burst(state.player.x, state.player.y, '#ffd76a', 40, 260, 1.0, 4);
    state.particles.ring(state.player.x, state.player.y, '#ffd76a', 300);
  }
}

function updatePulses(dt) {
  for (let i = state.pulses.length - 1; i >= 0; i--) {
    const pulse = state.pulses[i];
    pulse.life -= dt;
    const t = 1 - pulse.life / pulse.maxLife;
    pulse.radius = 26 + (pulse.maxRadius - 26) * (1 - (1 - t) * (1 - t));
    // Damage any enemy the expanding ring touches, once per enemy per pulse.
    for (const enemy of [...state.enemies]) {
      if (pulse.hit && pulse.hit.has(enemy)) continue;
      const d = Math.hypot(enemy.x - pulse.x, enemy.y - pulse.y);
      if (d < pulse.radius + enemy.radius * 0.5) {
        if (!pulse.hit) pulse.hit = new Set();
        pulse.hit.add(enemy);
        damageEnemy(state, enemy, pulse.damage);
      }
    }
    if (pulse.life <= 0) state.pulses.splice(i, 1);
  }
}

function updateEmbers(dt) {
  const p = state.player;
  for (let i = state.embersList.length - 1; i >= 0; i--) {
    const e = state.embersList[i];
    e.life -= dt;
    e.bob += dt * 4;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vx *= 0.96;
    e.vy *= 0.96;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    const pull = p.magnetTimer > 0 ? 520 : d < 90 ? 340 : 0;
    if (pull > 0) {
      e.x += ((p.x - e.x) / (d || 1)) * pull * dt;
      e.y += ((p.y - e.y) / (d || 1)) * pull * dt;
    }
    if (d < 26) {
      state.embersList.splice(i, 1);
      state.embers += 1;
      // Endless Night+ (§1d): ALL score doubles past Dawn — banish score
      // (enemies.js), wave-clear bonus (waves.js) and ember pickups (here).
      // The heal is NOT doubled; only the score is.
      const emberScore = e.value * (state.wave > 10 ? 2 : 1);
      state.score += emberScore;
      healLight(p, effectiveEmberHeal(state.upgrades), state.upgrades);
      state.audio.ember();
      state.particles.burst(e.x, e.y, '#ffd76a', 8, 110, 0.4, 2.5);
      state.particles.popup(e.x, e.y - 10, '+' + emberScore, '#ffd98a');
      continue;
    }
    if (e.life <= 0) state.embersList.splice(i, 1);
  }
}

function updatePickups(dt) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    pk.life -= dt;
    pk.bob += dt * 3;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < 34) {
      state.pickups.splice(i, 1);
      state.audio.pickup();
      if (pk.kind === 'spread') {
        p.spreadTimer = 12;
        state.particles.popup(p.x, p.y - 40, 'SPREAD LIGHT!', '#8affc1');
      } else if (pk.kind === 'shield') {
        p.shield = true;
        state.particles.popup(p.x, p.y - 40, 'SHIELD UP!', '#8cdcff');
      } else {
        p.magnetTimer = 12;
        state.particles.popup(p.x, p.y - 40, 'EMBER MAGNET!', '#ffb3ec');
      }
      state.particles.burst(pk.x, pk.y, '#ffffff', 14, 140, 0.5, 3);
      continue;
    }
    if (pk.life <= 0) state.pickups.splice(i, 1);
  }
}

// --- flow -----------------------------------------------------------------

function startGame() {
  state.audio.unlock();
  state.score = 0;
  state.embers = 0;
  state.banished = 0;
  state.wave = 0;
  state.player = createPlayer();
  state.upgrades = createUpgrades();
  state.upgradeChoices = [];
  state.upgradeCardRects = [];
  state.beacons = [];
  state.darkBeaconCount = 0;
  state.extraDrifters = 0;
  state.darkBeaconBanner = null;
  state.thiefAlert = 0;
  state.won = false;
  state.enemies.length = 0;
  state.bolts.length = 0;
  state.pulses.length = 0;
  state.embersList.length = 0;
  state.pickups.length = 0;
  state.spawnQueue.length = 0;
  state.banner = null;
  state.particles.clear();
  state.rng = makeRng((Date.now() % 2147483647) || 1);
  state.mode = 'playing';
  startWave(state);
}

function togglePause() {
  if (state.mode === 'playing') state.mode = 'paused';
  else if (state.mode === 'paused') state.mode = 'playing';
}

// --- update / render ------------------------------------------------------

function update(dt) {
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt * 26);
  state.flash = Math.max(0, state.flash - dt * 1.4);
  if (state.banner) {
    state.banner.time -= dt;
    if (state.banner.time <= 0) state.banner = null;
  }
  state.particles.update(dt);

  if (state.mode === 'playing') {
    updatePlayer(state.player, input, dt, WORLD, state.upgrades, beaconSpeedMultiplier(state));
    if (input.pulseQueued) firePulse();
    updatePulses(dt);
    updateEnemies(state, dt);
    updateBeacons(state, dt);
    updateWaves(state, dt);
    updateEmbers(dt);
    updatePickups(dt);
  }
  // Dawn won: bank the best score once the victory screen is up.
  // (saveBest only writes when the score beats the best, so this is a no-op
  // on every frame after the first.)
  if (state.mode === 'victory') saveBest();
  // Upgrade pick from keys 1/2/3 (set by input.js). The world is frozen in
  // 'upgrade' mode, so this branch is the only way out of it besides a click.
  if (state.mode === 'upgrade' && input.choiceQueued >= 1 && input.choiceQueued <= 3) {
    const id = state.upgradeChoices[input.choiceQueued - 1];
    if (id) chooseUpgrade(state, id);
  }
  input.pulseQueued = false;
  input.choiceQueued = 0;
}

function drawEmber(ctx2d, e, time) {
  const bobY = Math.sin(e.bob) * 3;
  const glow = ctx2d.createRadialGradient(e.x, e.y + bobY, 1, e.x, e.y + bobY, 14);
  glow.addColorStop(0, 'rgba(255, 215, 106, 0.9)');
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx2d.fillStyle = glow;
  ctx2d.beginPath();
  ctx2d.arc(e.x, e.y + bobY, 14, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.fillStyle = '#ffd76a';
  ctx2d.beginPath();
  ctx2d.arc(e.x, e.y + bobY, 4.5, 0, Math.PI * 2);
  ctx2d.fill();
}

function drawPickup(ctx2d, pk) {
  const y = pk.y + Math.sin(pk.bob) * 4;
  ctx2d.save();
  ctx2d.translate(pk.x, y);
  ctx2d.rotate(Math.sin(pk.bob * 0.5) * 0.15);
  ctx2d.fillStyle = 'rgba(5, 6, 15, 0.6)';
  ctx2d.beginPath();
  ctx2d.arc(0, 0, 17, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.lineWidth = 2;
  if (pk.kind === 'spread') {
    ctx2d.strokeStyle = '#8affc1';
    ctx2d.fillStyle = '#8affc1';
    ctx2d.beginPath();
    ctx2d.arc(0, 0, 5, 0, Math.PI * 2);
    ctx2d.fill();
    for (const a of [-0.5, 0, 0.5]) {
      ctx2d.beginPath();
      ctx2d.moveTo(0, 0);
      ctx2d.lineTo(Math.cos(a - Math.PI / 2) * 13, Math.sin(a - Math.PI / 2) * 13);
      ctx2d.stroke();
    }
  } else if (pk.kind === 'shield') {
    ctx2d.strokeStyle = '#8cdcff';
    ctx2d.beginPath();
    ctx2d.moveTo(0, -11);
    ctx2d.lineTo(9, -6);
    ctx2d.lineTo(9, 2);
    ctx2d.quadraticCurveTo(9, 10, 0, 13);
    ctx2d.quadraticCurveTo(-9, 10, -9, 2);
    ctx2d.lineTo(-9, -6);
    ctx2d.closePath();
    ctx2d.stroke();
  } else {
    ctx2d.strokeStyle = '#ffb3ec';
    ctx2d.beginPath();
    ctx2d.arc(0, -2, 7, 0, Math.PI * 2);
    ctx2d.stroke();
    ctx2d.beginPath();
    ctx2d.moveTo(0, 5);
    ctx2d.lineTo(-3, 12);
    ctx2d.lineTo(3, 12);
    ctx2d.closePath();
    ctx2d.stroke();
  }
  ctx2d.restore();
}

function render() {
  ctx.save();
  if (state.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground(ctx, WORLD, state.time);

  // Embers and pickups under the actors.
  for (const e of state.embersList) drawEmber(ctx, e, state.time);
  for (const pk of state.pickups) drawPickup(ctx, pk);

  // Pulse rings.
  for (const pulse of state.pulses) {
    const a = Math.max(0, pulse.life / pulse.maxLife);
    ctx.globalAlpha = a * 0.85;
    ctx.strokeStyle = '#ffe9b0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = a * 0.25;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Beacons stand on the island under the actors; the keeper walks in front.
  if (state.beacons) {
    for (const b of state.beacons) drawBeacon(ctx, b, state.time, state);
  }

  for (const enemy of state.enemies) drawEnemy(ctx, enemy, state.time);

  // Enemy bolts.
  for (const b of state.bolts) {
    ctx.fillStyle = '#e08aff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.mode !== 'title') drawPlayer(ctx, state.player, state.time);
  state.particles.draw(ctx);

  // Hit flash.
  if (state.flash > 0) {
    ctx.fillStyle = 'rgba(255, 240, 200, ' + (state.flash * 1.4) + ')';
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  }

  // Darkness beyond the light: the night presses in everywhere the lantern
  // does not reach. (Skipped on title/gameover so those screens stay readable.)
  if (state.mode === 'playing' || state.mode === 'paused') {
    const p = state.player;
    const lit = Math.max(0, p.light);
    const dark = ctx.createRadialGradient(p.x, p.y, lit * 0.85, p.x, p.y, 560);
    dark.addColorStop(0, 'rgba(3, 4, 10, 0)');
    dark.addColorStop(1, 'rgba(3, 4, 10, 0.62)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  }
  ctx.restore();

  if (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'upgrade') {
    drawHud(ctx, state);
    drawUpgradeBadges(ctx, state);
    // The beacon bar is drawn AFTER the upgrade cards in upgrade mode, so
    // it stays bright above the dim veil (it is a required shot-02 anchor:
    // BEACON B: RELIGHTING 60%). In playing/paused it draws here as before.
    if (state.mode !== 'upgrade') drawBeaconHudBar(ctx, state);
  }
  if (state.mode === 'upgrade') {
    drawUpgradeCards(ctx, state);
    drawBeaconHudBar(ctx, state);
  }
  if (state.mode === 'title') drawTitle(ctx, state);
  if (state.mode === 'paused') drawPause(ctx, state);
  if (state.mode === 'gameover') drawGameOver(ctx, state);
  if (state.mode === 'victory') drawVictory(ctx, state);
}

// --- keys for menus --------------------------------------------------------

window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter') {
    if (state.mode === 'title' || state.mode === 'gameover') startGame();
    else if (state.mode === 'paused') state.mode = 'playing';
    else if (state.mode === 'victory') {
      // Dawn is won — keep the light one more night: Endless Night+,
      // wave 11+, scaling +15%/wave and score ×2 (enemies.js / waves.js).
      state.mode = 'playing';
      startWave(state);
    }
  }
  if (event.code === 'Escape' && state.mode === 'victory') state.mode = 'title';
  if (event.code === 'KeyP') togglePause();
  if (event.code === 'KeyM') state.audio.toggleMute();
});
canvas.addEventListener('mousedown', (event) => {
  if (state.mode === 'title' || state.mode === 'gameover') startGame();
  if (state.mode === 'upgrade') {
    const rect = canvas.getBoundingClientRect();
    const mx = (event.clientX - rect.left) * (canvas.width / rect.width);
    const my = (event.clientY - rect.top) * (canvas.height / rect.height);
    const id = upgradeCardAt(state, mx, my);
    if (id) chooseUpgrade(state, id);
  }
});

// --- boot -----------------------------------------------------------------

const params = new URLSearchParams(location.search);
const shotScene = params.get('shot');
const shotSeed = Number(params.get('seed') || 7);

if (shotScene) {
  // Deterministic screenshot mode: build the scene, render once, signal ready.
  // Seed Math.random too: staging calls particles.burst(), which draws its
  // sparks from Math.random() — without this, two renders of the same scene
  // differed by a few spark pixels (polish 17 Nov). The live loop keeps the
  // real Math.random; only the shot path is seeded. render() itself uses no
  // wall clock and no Math.random (shake is 0 in every staged scene).
  Math.random = mulberry32(shotSeed);
  applyShotScene(state, shotScene, shotSeed);
  render();
  window.__shotReady = true;
} else {
  // Testing hook: lets an automated play-test freeze the frame loop so a
  // screenshot can be captured under software rendering (the live loop can
  // starve the compositor's capture there). Harmless in normal play.
  let frozen = false;
  window.__emberlight = {
    state,
    freeze() { frozen = true; },
    resume() { frozen = false; },
  };
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!frozen) {
      // One bad frame must never kill the loop: a throw here used to stop
      // requestAnimationFrame from ever being scheduled again.
      try {
        update(dt);
        render();
      } catch (error) {
        console.error('Emberlight frame error (recovered):', error);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
