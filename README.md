# makefun-best-game
[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Heryp0401/makefun-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Heryp0401/makefun-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Emberlight — A Lighthouse Keeper's Last Night.** A 2D top-down arena survival game in plain JavaScript, no libraries, no network: all art drawn in code, all sound synthesized live with WebAudio.

You are the keeper of a lighthouse on a small island. Every night, shadows rise from the sea. Your lantern light is your life *and* your weapon — every hit shrinks it, every ember you gather feeds it back. Banish drifters, spitters and brutes, survive the growing waves, and face the Warden every fifth wave. Pick up spread light, shields and ember magnets along the way. How many nights can you keep the light alive?

**Revamp — the night got deeper.** Three new shadows hunt you differently: the Flicker blinks and is only open for 0.4 s after it reappears, the Ember-Thief steals embers off the ground and runs for the edge, the Shellback's shell eats your first pulse. Between waves you pick 1 of 3 upgrade cards — Heavy Wick, Deep Reservoir, Far Beam and more — and build a permanent loadout. Three beach beacons must be relit (stand still 0.9 s, no pulse while you do) or they slow you and call extra drifters. Survive to Wave 10 and Dawn breaks — then Endless Night+ begins, harder and worth double.

- **Controls:** WASD / arrows to move, mouse to aim, click / Space to fire a light pulse, P to pause, M to mute.
- **Goal:** survive as many waves as you can; score from banished shadows, gathered embers and wave bonuses. Best score is saved locally.
- **Tech:** static files under `game/` — open `game/index.html` in any desktop browser. No build step, no external assets.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html`.

<sub>Entered on [make.fun](https://make.fun/?ref=k67zx4h5&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
