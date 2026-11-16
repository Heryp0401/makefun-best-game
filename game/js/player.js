// The lighthouse keeper — one job: the player. Movement, the light radius
// (which IS the health bar), pulsing, pickups and drawing the keeper + lantern.

export const PLAYER = {
  radius: 16,
  speed: 265,
  lightStart: 150,
  lightMax: 200,
  lightMin: 34,
  pulseCooldown: 0.55,
  pulseRange: 210,
  pulseDamage: 1,
};

export function createPlayer() {
  return {
    x: 640,
    y: 360,
    vx: 0,
    vy: 0,
    aim: 0,
    light: PLAYER.lightStart,
    pulseTimer: 0,
    spreadTimer: 0,
    shield: false,
    magnetTimer: 0,
    invulnerable: 0,
    channeling: false, // true while relighting a beacon — pulse is blocked
    moving: false,
    walkPhase: 0,
  };
}

// Every dark beacon drags the keeper's speed down 15% — a hyper-kiter who
// ignores the beacons ends up at 55% speed with all three dark. The
// multiplier is read from state so updatePlayer stays a pure movement step.
export function beaconSpeedMultiplier(state) {
  const dark = state && typeof state.darkBeaconCount === 'number' ? state.darkBeaconCount : 0;
  return Math.max(0.55, 1 - 0.15 * dark);
}

export function updatePlayer(player, input, dt, world, upgrades, speedMul) {
  // upgrades = the run's permanent build (effective speed); speedMul = the
  // beacon darkness penalty (1 when every beacon burns). Both default safe.
  const mul = typeof speedMul === 'number' ? speedMul : 1;
  player.vx = input.moveX * effectiveSpeed(upgrades) * mul;
  player.vy = input.moveY * effectiveSpeed(upgrades) * mul;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.max(28, Math.min(world.w - 28, player.x));
  player.y = Math.max(28, Math.min(world.h - 28, player.y));
  player.moving = input.moveX !== 0 || input.moveY !== 0;
  if (player.moving) player.walkPhase += dt * 11;
  player.aim = Math.atan2(input.aimY - player.y, input.aimX - player.x);
  player.pulseTimer = Math.max(0, player.pulseTimer - dt);
  player.spreadTimer = Math.max(0, player.spreadTimer - dt);
  player.magnetTimer = Math.max(0, player.magnetTimer - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
}

export function hurtPlayer(player, amount) {
  if (player.invulnerable > 0) return false;
  if (!Number.isFinite(amount)) amount = 0;
  if (player.shield) {
    player.shield = false;
    player.invulnerable = 1.0;
    return 'shield';
  }
  player.light = Math.max(0, player.light - amount);
  player.invulnerable = 0.9;
  return player.light <= 0 ? 'dead' : 'hit';
}

export function healLight(player, amount, upgrades) {
  player.light = Math.min(effectiveLightMax(upgrades), player.light + amount);
}

// --- effective stats: PLAYER defaults plus the run's permanent upgrades.
// Every helper is defensive — no upgrades state (old scenes, tests) means
// the base value. The upgrade numbers live in upgrades.js; these functions
// only translate the accumulated bonuses into the stat the game uses.
export function effectiveLightMax(upgrades) {
  return PLAYER.lightMax + (upgrades && typeof upgrades.lightMaxBonus === 'number' ? upgrades.lightMaxBonus : 0);
}

export function effectivePulseDamage(upgrades) {
  return PLAYER.pulseDamage + (upgrades && typeof upgrades.damageBonus === 'number' ? upgrades.damageBonus : 0);
}

export function effectivePulseRange(upgrades) {
  return PLAYER.pulseRange + (upgrades && typeof upgrades.rangeBonus === 'number' ? upgrades.rangeBonus : 0);
}

export function effectiveCooldown(upgrades) {
  const bonus = upgrades && typeof upgrades.cooldownBonus === 'number' ? upgrades.cooldownBonus : 0;
  return Math.max(0.30, PLAYER.pulseCooldown + bonus);
}

export function effectiveSpeed(upgrades) {
  return PLAYER.speed + (upgrades && typeof upgrades.speedBonus === 'number' ? upgrades.speedBonus : 0);
}

export function effectiveEmberHeal(upgrades) {
  return 6 + (upgrades && typeof upgrades.emberHealBonus === 'number' ? upgrades.emberHealBonus : 0);
}

export function drawPlayer(ctx, player, time) {
  const bob = player.moving ? Math.sin(player.walkPhase) * 2 : Math.sin(time * 2) * 1.2;
  const flicker = 1 + Math.sin(time * 9.3) * 0.02 + Math.sin(time * 23.7) * 0.015;

  // Lantern glow (the light itself). Radius clamped so a bad value can never
  // throw inside createRadialGradient and kill the frame loop.
  const glowRadius = Math.max(0, player.light * flicker);
  const glow = ctx.createRadialGradient(
    player.x, player.y, 10,
    player.x, player.y, glowRadius,
  );
  glow.addColorStop(0, 'rgba(255, 214, 130, 0.55)');
  glow.addColorStop(0.35, 'rgba(255, 179, 71, 0.20)');
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(player.x, player.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Aim beam — a soft cone toward the mouse.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.aim);
  const beam = ctx.createLinearGradient(0, 0, 150, 0);
  beam.addColorStop(0, 'rgba(255, 220, 140, 0.28)');
  beam.addColorStop(1, 'rgba(255, 220, 140, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(150, -44);
  ctx.lineTo(150, 44);
  ctx.lineTo(0, 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Keeper: hooded figure with a lantern.
  ctx.save();
  ctx.translate(player.x, player.y + bob * 0.4);
  // Cloak.
  ctx.fillStyle = '#2e3a5c';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.quadraticCurveTo(13, -8, 12, 12);
  ctx.quadraticCurveTo(0, 18, -12, 12);
  ctx.quadraticCurveTo(-13, -8, 0, -18);
  ctx.fill();
  ctx.strokeStyle = '#ffb347';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Hood + face glow.
  ctx.fillStyle = '#232c47';
  ctx.beginPath();
  ctx.arc(0, -8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.arc(0, -7, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Lantern held toward the aim.
  const lx = Math.cos(player.aim) * 22;
  const ly = Math.sin(player.aim) * 22;
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(lx - 4, ly - 7, 8, 14);
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(lx, ly, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Shield ring.
  if (player.shield) {
    ctx.strokeStyle = 'rgba(140, 220, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 30 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Invulnerability blink.
  if (player.invulnerable > 0 && Math.floor(time * 14) % 2 === 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 24, 0, Math.PI * 2);
    ctx.stroke();
  }
}
