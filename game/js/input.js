// Keyboard + mouse input — one job: turn raw DOM events into a clean,
// per-frame input state the game loop reads (move vector, aim point, pulses).

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    moveX: 0,
    moveY: 0,
    aimX: 640,
    aimY: 360,
    pulseQueued: false,
    choiceQueued: 0, // upgrade pick 1/2/3, consumed by the loop in 'upgrade' mode
    anyKey: false,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  function refreshMove() {
    input.moveX = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    input.moveY = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    if (input.moveX !== 0 && input.moveY !== 0) {
      const inv = 1 / Math.SQRT2;
      input.moveX *= inv;
      input.moveY *= inv;
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.anyKey = true;
    const action = KEYMAP[event.code];
    if (action) {
      keys.add(action);
      refreshMove();
      event.preventDefault();
    }
    if (event.code === 'Space') {
      input.pulseQueued = true;
      event.preventDefault();
    }
    if (event.code === 'Digit1' || event.code === 'Numpad1') input.choiceQueued = 1;
    if (event.code === 'Digit2' || event.code === 'Numpad2') input.choiceQueued = 2;
    if (event.code === 'Digit3' || event.code === 'Numpad3') input.choiceQueued = 3;
  });

  window.addEventListener('keyup', (event) => {
    const action = KEYMAP[event.code];
    if (action) {
      keys.delete(action);
      refreshMove();
    }
  });

  function aimFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    input.aimX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    input.aimY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  }

  canvas.addEventListener('mousemove', aimFromEvent);
  canvas.addEventListener('mousedown', (event) => {
    aimFromEvent(event);
    input.pulseQueued = true;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // Touch fallback: drag to move, tap to pulse.
  let touchId = null;
  canvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    const touch = event.changedTouches[0];
    touchId = touch.identifier;
    aimFromEvent(touch);
    input.pulseQueued = true;
  }, { passive: false });
  canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      if (touch.identifier === touchId) aimFromEvent(touch);
    }
  }, { passive: false });

  return input;
}
