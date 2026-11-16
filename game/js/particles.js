// Particles + floating text — one job: the visual feedback layer. Sparks,
// embers, shockwave rings and score popups; pooled so the game never allocates
// mid-frame in a hot loop.

export function createParticles() {
  const sparks = [];
  const rings = [];
  const texts = [];

  function burst(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i++) {
      if (sparks.length > 420) return;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      sparks.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: life * (0.6 + Math.random() * 0.4),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
      });
    }
  }

  return {
    sparks, rings, texts,
    burst,
    ring(x, y, color, maxRadius) {
      rings.push({ x, y, radius: 8, maxRadius, color, life: 0.45, maxLife: 0.45 });
    },
    popup(x, y, text, color) {
      texts.push({ x, y, text, color: color || '#ffd98a', life: 1.1, maxLife: 1.1 });
    },
    update(dt) {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life -= dt;
        if (p.life <= 0) { sparks.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life -= dt;
        if (r.life <= 0) { rings.splice(i, 1); continue; }
        const t = 1 - r.life / r.maxLife;
        r.radius = 8 + (r.maxRadius - 8) * (1 - (1 - t) * (1 - t));
      }
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.life -= dt;
        t.y -= 34 * dt;
        if (t.life <= 0) texts.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const p of sparks) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const r of rings) {
        const a = Math.max(0, r.life / r.maxLife);
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3 + 3 * a;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      for (const t of texts) {
        const a = Math.max(0, t.life / t.maxLife);
        ctx.globalAlpha = a;
        ctx.font = 'bold 20px Georgia, serif';
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      sparks.length = 0;
      rings.length = 0;
      texts.length = 0;
    },
  };
}
