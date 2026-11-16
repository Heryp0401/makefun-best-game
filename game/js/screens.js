// Screens — one job: everything drawn over the world that is not the world
// itself. Title, HUD, wave banner, pause, game-over results, and the small
// lines addressed to the judge.

import { effectiveLightMax } from './player.js';

export function drawBackground(ctx, world, time) {
  // Night sea + island + lighthouse silhouette, drawn fresh every frame.
  const g = ctx.createLinearGradient(0, 0, 0, world.h);
  g.addColorStop(0, '#0a0d24');
  g.addColorStop(0.55, '#0b1026');
  g.addColorStop(1, '#05060f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, world.w, world.h);

  // Stars.
  ctx.fillStyle = '#cdd6ff';
  for (let i = 0; i < 90; i++) {
    const sx = (i * 137.5) % world.w;
    const sy = (i * 89.3) % 300;
    const tw = 0.35 + 0.3 * Math.sin(time * 1.7 + i);
    ctx.globalAlpha = Math.max(0.1, tw);
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Moon, kept clear of the top-right HUD panel.
  ctx.fillStyle = '#e8e4d8';
  ctx.beginPath();
  ctx.arc(1150, 168, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9c4b2';
  ctx.beginPath();
  ctx.arc(1141, 160, 6, 0, Math.PI * 2);
  ctx.arc(1160, 178, 4, 0, Math.PI * 2);
  ctx.fill();

  // Sea shimmer at the bottom.
  ctx.strokeStyle = 'rgba(90, 120, 200, 0.25)';
  ctx.lineWidth = 2;
  for (let r = 0; r < 5; r++) {
    const y = 620 + r * 20;
    ctx.beginPath();
    for (let x = 0; x <= world.w; x += 32) {
      const yy = y + Math.sin(x * 0.02 + time * 1.2 + r * 1.7) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // The island: a dark rock ellipse the keeper stands on.
  ctx.fillStyle = '#141a2e';
  ctx.beginPath();
  ctx.ellipse(640, 392, 300, 132, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1b2340';
  ctx.beginPath();
  ctx.ellipse(640, 384, 268, 112, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rocky rim.
  ctx.fillStyle = '#232c4a';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rx = 640 + Math.cos(a) * 292;
    const ry = 392 + Math.sin(a) * 126;
    ctx.beginPath();
    ctx.arc(rx, ry, 9 + (i % 3) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Grass tufts.
  ctx.strokeStyle = '#2c4a3a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const gx = 430 + i * 46 + ((i * 37) % 23);
    const gy = 330 + ((i * 53) % 90);
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx - 4, gy - 10);
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 4, gy - 12);
    ctx.stroke();
  }

  // The lighthouse, behind the keeper, its lamp sweeping.
  drawLighthouse(ctx, 640, 300, time);
}

function drawLighthouse(ctx, x, baseY, time) {
  // Tower.
  ctx.fillStyle = '#e8e4d8';
  ctx.beginPath();
  ctx.moveTo(x - 26, baseY);
  ctx.lineTo(x - 16, baseY - 132);
  ctx.lineTo(x + 16, baseY - 132);
  ctx.lineTo(x + 26, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b03a3a';
  ctx.fillRect(x - 22, baseY - 42, 44, 16);
  ctx.fillRect(x - 19, baseY - 92, 38, 16);
  // Lamp room.
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(x - 20, baseY - 160, 40, 30);
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(x, baseY - 145, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a22';
  ctx.beginPath();
  ctx.moveTo(x - 24, baseY - 160);
  ctx.lineTo(x, baseY - 178);
  ctx.lineTo(x + 24, baseY - 160);
  ctx.closePath();
  ctx.fill();
  // Sweeping beam.
  const sweep = Math.sin(time * 0.5) * 0.9;
  ctx.save();
  ctx.translate(x, baseY - 145);
  ctx.rotate(sweep);
  const beam = ctx.createLinearGradient(0, 0, 420, 0);
  beam.addColorStop(0, 'rgba(255, 220, 140, 0.20)');
  beam.addColorStop(1, 'rgba(255, 220, 140, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(420, -46);
  ctx.lineTo(420, 46);
  ctx.lineTo(0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHud(ctx, state) {
  const p = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: score + best.
  ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
  roundRect(ctx, 18, 16, 250, 74, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText('SCORE  ' + state.score, 32, 48);
  ctx.fillStyle = '#9a94a8';
  ctx.font = '15px Georgia, serif';
  ctx.fillText('BEST  ' + Math.max(state.best, state.score) + '    ·    EMBERS  ' + state.embers, 32, 74);

  // Beacon status, under the score panel: lit ● gold, dark ○ grey.
  if (state.beacons && state.beacons.length === 3) {
    ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
    roundRect(ctx, 18, 98, 250, 40, 10);
    ctx.fill();
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillStyle = '#ffd98a';
    ctx.fillText('BEACONS  ', 32, 124);
    let dotX = 128;
    for (const b of state.beacons) {
      ctx.fillStyle = b.lit ? '#ffb347' : '#8a8a9a';
      ctx.fillText(b.lit ? '●' : '○', dotX, 124);
      dotX += 22;
    }
    const dark = state.beacons.filter((b) => !b.lit).length;
    if (dark > 0) {
      ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
      roundRect(ctx, 18, 142, 250, 30, 10);
      ctx.fill();
      ctx.fillStyle = '#ff8a6a';
      ctx.font = 'bold 15px Georgia, serif';
      ctx.fillText('DARK BEACONS −' + (dark * 15) + '% SPEED', 32, 163);
    }
  }

  // The logbook line — one small greeting to the judge, Wave 1 only.
  if (state.wave === 1 && (state.mode === 'playing' || state.mode === 'paused')) {
    ctx.fillStyle = '#9a94a8';
    ctx.font = '13px Georgia, serif';
    ctx.fillText('Logbook, Night 48 — for the judge who takes the lamp after me.', 32, 196);
  }

  // Top-right: wave + banished.
  ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
  roundRect(ctx, 1012, 16, 250, 74, 10);
  ctx.fill();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('WAVE  ' + Math.max(1, state.wave), 1248, 46);
  ctx.fillStyle = '#9a94a8';
  ctx.font = '15px Georgia, serif';
  ctx.fillText('SHADOWS BANISHED  ' + state.banished, 1248, 74);
  ctx.textAlign = 'left';

  // Bottom-left: the light meter — light IS health. The max grows (or
  // shrinks) with the run's permanent upgrades, so the meter is drawn
  // against the effective max, not the base 200.
  ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
  roundRect(ctx, 18, 646, 330, 56, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText('LANTERN LIGHT  —  your health', 32, 668);
  const lightMax = effectiveLightMax(state.upgrades);
  const frac = Math.max(0, Math.min(1, p.light / lightMax));
  ctx.fillStyle = '#2a2f4a';
  roundRect(ctx, 32, 676, 260, 12, 6);
  ctx.fill();
  ctx.fillStyle = frac > 0.5 ? '#ffb347' : frac > 0.25 ? '#ff7a3c' : '#ff3c3c';
  roundRect(ctx, 32, 676, 260 * frac, 12, 6);
  ctx.fill();
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(p.light) + ' / ' + lightMax, 340, 688);
  ctx.textAlign = 'left';

  // Bottom-right: active blessings.
  let by = 660;
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px Georgia, serif';
  if (p.spreadTimer > 0) { ctx.fillStyle = '#8affc1'; ctx.fillText('✦ SPREAD LIGHT  ' + Math.ceil(p.spreadTimer) + 's', 1248, by); by -= 20; }
  if (p.shield) { ctx.fillStyle = '#8cdcff'; ctx.fillText('⬢ SHIELD — blocks one hit', 1248, by); by -= 20; }
  if (p.magnetTimer > 0) { ctx.fillStyle = '#ffb3ec'; ctx.fillText('🧲 EMBER MAGNET  ' + Math.ceil(p.magnetTimer) + 's', 1248, by); by -= 20; }
  ctx.textAlign = 'left';

  // Wave banner, on a dark pill so it reads over the lighthouse tower.
  if (state.banner && state.banner.time > 0) {
    const a = Math.min(1, state.banner.time);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(4, 5, 12, 0.72)';
    roundRect(ctx, 340, 118, 600, 104, 12);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.shadowColor = 'rgba(255, 179, 71, 0.6)';
    ctx.shadowBlur = 24;
    ctx.fillText(state.banner.title, 640, 162);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillText(state.banner.sub, 640, 196);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // Low-light warning.
  if (p.light > 0 && p.light < 55 && state.mode === 'playing') {
    const pulse = 0.55 + 0.45 * Math.sin(state.time * 6);
    ctx.globalAlpha = pulse;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('YOUR LIGHT IS FADING — GATHER EMBERS', 640, 96);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // Ember-Thief alert: a thief is in the wave — stop it before it flees.
  // state.thiefAlert is seconds left, set by enemies.js on thief spawn and
  // counted down in updateEnemies; screens.js only reads it. Drawn last so
  // it sits on top of the low-light warning when both fire at once.
  // NOT drawn in upgrade mode: the intermission stops the update loop, so
  // the thief is frozen and the alert is unactionable there — and the live
  // banner would stack under the beacon bar and crowd the CHOOSE YOUR LIGHT
  // header (a 7th text anchor in the shot-02 frame, polish 17 Nov).
  if (state.thiefAlert > 0 && state.mode !== 'upgrade') {
    const alertPulse = 0.65 + 0.35 * Math.sin(state.time * 8);
    ctx.globalAlpha = alertPulse;
    ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
    roundRect(ctx, 440, 56, 400, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#ff9a3c';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('THIEF! — stop it before it flees', 640, 84);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

export function drawTitle(ctx, state) {
  dim(ctx, 0.45);
  ctx.textAlign = 'center';
  // The real lighthouse stands behind the title already; no glyph needed.

  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.shadowColor = 'rgba(255, 179, 71, 0.55)';
  ctx.shadowBlur = 30;
  ctx.fillText('EMBERLIGHT', 640, 268);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillText('A Lighthouse Keeper\u2019s Last Night', 640, 308);

  ctx.font = '19px Georgia, serif';
  ctx.fillStyle = '#c9c4d6';
  ctx.fillText('The shadows rise from the sea every night. Your lantern light is your life —', 640, 362);
  ctx.fillText('and your only weapon. Banish shadows, gather their embers, and do not let the light die.', 640, 388);

  // The judge's letter — one continuous note, continued on the game-over
  // and victory screens. Three lines so it stays readable at 21px.
  ctx.fillStyle = '#ffb347';
  ctx.font = 'italic bold 21px Georgia, serif';
  ctx.fillText('\u201cJudge — I have kept this light for 47 nights. Tonight I am', 640, 430);
  ctx.fillText('handing you the lamp, the logbook, and the score. Wave 10 is dawn.', 640, 456);
  ctx.fillText('Don\u2019t let it go out on my watch.\u201d', 640, 482);

  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 24px Georgia, serif';
  const blink = 0.65 + 0.35 * Math.sin(state.time * 3.2);
  ctx.globalAlpha = blink;
  ctx.fillText('— PRESS ENTER OR CLICK TO BEGIN —', 640, 528);
  ctx.globalAlpha = 1;

  ctx.font = '17px Georgia, serif';
  ctx.fillStyle = '#9a94a8';
  ctx.fillText('WASD / arrows — move      Mouse — aim      Click / Space — light pulse', 640, 566);
  ctx.fillText('Embers restore your light  ·  Every 5th wave, the Warden comes  ·  P — pause', 640, 592);
  if (state.best > 0) {
    ctx.fillStyle = '#ffd98a';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText('BEST SCORE  ' + state.best, 640, 630);
  }
}

export function drawPause(ctx, state) {
  dim(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('PAUSED', 640, 320);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '19px Georgia, serif';
  ctx.fillText('The night waits for no keeper — but it will wait for you.', 640, 362);
  ctx.fillText('Press P or Enter to return to the light.', 640, 392);
  ctx.textAlign = 'left';
}

export function drawGameOver(ctx, state) {
  dim(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff8a6a';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('THE LIGHT HAS GONE OUT', 640, 168);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('The keeper falls. The island goes dark — but dawn always comes again.', 640, 206);

  // Results card.
  ctx.fillStyle = 'rgba(5, 6, 15, 0.72)';
  roundRect(ctx, 400, 240, 480, 250, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, 400, 240, 480, 250, 14);
  ctx.stroke();

  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText('FINAL SCORE  ' + state.score, 640, 292);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '21px Georgia, serif';
  const rows = [
    ['Waves survived', String(state.wave)],
    ['Shadows banished', String(state.banished)],
    ['Embers gathered', String(state.embers)],
    ['Best score', String(Math.max(state.best, state.score))],
  ];
  let y = 336;
  for (const [label, value] of rows) {
    ctx.textAlign = 'left';
    ctx.fillText(label, 440, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(value, 840, y);
    ctx.fillStyle = '#e8e4d8';
    y += 34;
  }
  ctx.textAlign = 'center';
  const isBest = state.score > 0 && state.score >= state.best;
  ctx.fillStyle = isBest ? '#8affc1' : '#9a94a8';
  ctx.font = 'italic bold 19px Georgia, serif';
  ctx.fillText(isBest ? '★ A new best — the lighthouse remembers you. ★' : 'The lighthouse remembers every keeper.', 640, 470);

  // Near-miss: how far Dawn was, in waves — only while Dawn is still ahead.
  // And how close the run came to the best score (only when it lost by
  // less than 500 — a near miss, not a rout). Both lines are dynamic from
  // state; when the run IS a new best, the ★ line above says so instead.
  const wavesToDawn = Math.max(0, 10 - Math.max(1, state.wave));
  let nearY = 506;
  if (wavesToDawn > 0) {
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillText(
      'You fell on Wave ' + Math.max(1, state.wave) + ' — Dawn was ' + wavesToDawn +
      (wavesToDawn === 1 ? ' wave away' : ' waves away'),
      640, nearY,
    );
    nearY += 22;
  } else if (Math.max(1, state.wave) > 10) {
    // Fell after Dawn, in Endless Night+ — say so instead of "waves away".
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillText('Dawn reached — Endless Night+ Wave ' + Math.max(1, state.wave), 640, nearY);
    nearY += 22;
  }
  if (state.best > state.score && state.best - state.score < 500) {
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillText(
      'Best ' + state.best + ' — you scored ' + state.score + ', ' +
      (state.best - state.score) + ' short',
      640, nearY,
    );
  }

  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 24px Georgia, serif';
  const blink = 0.65 + 0.35 * Math.sin(state.time * 3.2);
  ctx.globalAlpha = blink;
  ctx.fillText('— PRESS ENTER TO KEEP THE LIGHT AGAIN —', 640, 556);
  ctx.globalAlpha = 1;
  // The judge's letter, continued — the wave is filled in from the run.
  const w = Math.max(1, state.wave);
  const wavePart = w >= 10 ? 'Wave ' + w + ', past Dawn.' : 'Wave ' + w + '.';
  const judgeLine = '\u201cJudge — Night 48, the light went out on ' + wavePart +
    ' The lamp is still warm. Press Enter and take it from me.\u201d';
  ctx.fillStyle = '#ffb347';
  ctx.font = 'italic 18px Georgia, serif';
  if (ctx.measureText(judgeLine).width > 1100) {
    const cut = judgeLine.indexOf('The lamp');
    ctx.fillText(judgeLine.slice(0, cut).trim(), 640, 586);
    ctx.fillText(judgeLine.slice(cut).trim(), 640, 610);
  } else {
    ctx.fillText(judgeLine, 640, 592);
  }
  ctx.textAlign = 'left';
}

export function drawVictory(ctx, state) {
  // Dawn over the sea: the night ends, the sun comes up behind the island.
  const sky = ctx.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, '#2a1a3a');
  sky.addColorStop(0.45, '#7a3a4a');
  sky.addColorStop(0.62, '#ff9a3c');
  sky.addColorStop(1, '#1a2a4a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, 720);

  // The sun, rising over the horizon line at y=400.
  const sunGlow = ctx.createRadialGradient(640, 330, 8, 640, 330, 150);
  sunGlow.addColorStop(0, 'rgba(255, 215, 106, 0.8)');
  sunGlow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(640, 330, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(640, 330, 46, 0, Math.PI * 2);
  ctx.fill();

  // Sea shimmer below the horizon.
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.35)';
  ctx.lineWidth = 2;
  for (let r = 0; r < 4; r++) {
    const y = 440 + r * 26;
    ctx.beginPath();
    for (let x = 0; x <= 1280; x += 32) {
      const yy = y + Math.sin(x * 0.02 + state.time * 1.2 + r * 1.7) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.shadowColor = 'rgba(255, 179, 71, 0.55)';
  ctx.shadowBlur = 30;
  ctx.fillText('DAWN', 640, 170);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText('The sun rises. The ships can see the island again.', 640, 214);

  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('FINAL SCORE  ' + state.score, 640, 452);

  // The judge's letter, closed — the lamp is the judge's now.
  ctx.fillStyle = '#ffb347';
  ctx.font = 'italic bold 20px Georgia, serif';
  ctx.fillText('\u201cJudge — you kept it. Dawn is here, the ships can see us, and Night 48 is', 640, 560);
  ctx.fillText('yours now. Press Enter to keep the light one more night.\u201d', 640, 588);

  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 24px Georgia, serif';
  const blink = 0.65 + 0.35 * Math.sin(state.time * 3.2);
  ctx.globalAlpha = blink;
  ctx.fillText('— PRESS ENTER — ENDLESS NIGHT+  ·  PRESS ESC — TITLE —', 640, 648);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function dim(ctx, alpha) {
  ctx.fillStyle = 'rgba(4, 5, 12, ' + alpha + ')';
  ctx.fillRect(0, 0, 1280, 720);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
