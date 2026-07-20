import assert from "node:assert/strict";
import test from "node:test";

import { InputManager } from "../app/game/input.ts";

class FakeWindow {
  navigator = {};
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      listeners.filter((candidate) => candidate !== listener),
    );
  }

  dispatchKey(type, code, key = code) {
    const event = {
      code,
      key,
      repeat: false,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
}

function createInput() {
  const target = new FakeWindow();
  const input = new InputManager({ target, gamepads: () => [] });
  input.setActivePlay(true);
  return { input, target };
}

test("arrow keys move the player in a solo game", () => {
  const directions = [
    ["ArrowUp", 0, -1],
    ["ArrowDown", 0, 1],
    ["ArrowLeft", -1, 0],
    ["ArrowRight", 1, 0],
  ];

  for (const [code, moveX, moveY] of directions) {
    const { input, target } = createInput();
    const keyDown = target.dispatchKey("keydown", code);
    const frame = input.getFrames(1)[0];

    assert.equal(keyDown.defaultPrevented, true);
    assert.deepEqual(
      { moveX: frame.moveX, moveY: frame.moveY },
      { moveX, moveY },
    );

    target.dispatchKey("keyup", code);
    const released = input.getFrames(1)[0];
    assert.deepEqual(
      { moveX: released.moveX, moveY: released.moveY },
      { moveX: 0, moveY: 0 },
    );
    input.destroy();
  }
});

test("arrow keys remain exclusive to player two in multiplayer", () => {
  const { input, target } = createInput();
  target.dispatchKey("keydown", "ArrowRight");

  const [playerOne, playerTwo] = input.getFrames(2);
  assert.deepEqual(
    { moveX: playerOne.moveX, moveY: playerOne.moveY },
    { moveX: 0, moveY: 0 },
  );
  assert.deepEqual(
    { moveX: playerTwo.moveX, moveY: playerTwo.moveY },
    { moveX: 1, moveY: 0 },
  );
  input.destroy();
});
