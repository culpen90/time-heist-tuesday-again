import {
  CONTROL_SCHEMES,
  EMPTY_INPUT,
  type PlayerInput,
} from "./model.ts";

const MAX_PLAYERS = 4;
const GAMEPAD_DEAD_ZONE = 0.2;

type ActionName = "interact" | "ability" | "sprint";

interface KeyboardBinding {
  up: readonly string[];
  down: readonly string[];
  left: readonly string[];
  right: readonly string[];
  interact: readonly string[];
  ability: readonly string[];
  sprint: readonly string[];
}

type MovementBinding = Pick<
  KeyboardBinding,
  "up" | "down" | "left" | "right"
>;

interface ActionLatch {
  interact: boolean;
  ability: boolean;
  sprint: boolean;
}

interface GamepadButtons {
  interact: boolean;
  ability: boolean;
  sprint: boolean;
  pause: boolean;
}

export interface InputFrame extends PlayerInput {
  /** Rising-edge helpers for UI code that does not keep its own held state. */
  interactPressed: boolean;
  abilityPressed: boolean;
  sprintPressed: boolean;
  pausePressed: boolean;
}

export type InputDevice =
  | { kind: "keyboard"; scheme: number }
  | { kind: "gamepad"; index: number; id: string };

export interface InputManagerOptions {
  target?: Window | null;
  gamepads?: () => readonly (Gamepad | null)[];
}

function isWindowTarget(value: InputManagerOptions | Window): value is Window {
  return (
    typeof (value as Window).addEventListener === "function" &&
    "navigator" in value
  );
}

const MOVE_KEYS: Record<
  (typeof CONTROL_SCHEMES)[number]["move"],
  MovementBinding
> = {
  WASD: {
    up: ["KeyW", "w"],
    down: ["KeyS", "s"],
    left: ["KeyA", "a"],
    right: ["KeyD", "d"],
  },
  ARROWS: {
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
  },
  IJKL: {
    up: ["KeyI", "i"],
    down: ["KeyK", "k"],
    left: ["KeyJ", "j"],
    right: ["KeyL", "l"],
  },
  "8456": {
    up: ["Numpad8", "Digit8", "8"],
    down: ["Numpad5", "Digit5", "5"],
    left: ["Numpad4", "Digit4", "4"],
    right: ["Numpad6", "Digit6", "6"],
  },
};

const ACTION_KEYS: Record<string, readonly string[]> = {
  E: ["KeyE", "e"],
  Q: ["KeyQ", "q"],
  SHIFT: ["ShiftLeft", "ShiftRight", "Shift"],
  ENTER: ["Enter", "NumpadEnter"],
  "/": ["Slash", "/"],
  ".": ["Period", "."],
  O: ["KeyO", "o"],
  U: ["KeyU", "u"],
  P: ["KeyP", "p"],
  "0": ["Numpad0", "Digit0", "0"],
  "1": ["Numpad1", "Digit1", "1"],
  "2": ["Numpad2", "Digit2", "2"],
};

export const KEYBOARD_BINDINGS: readonly KeyboardBinding[] =
  CONTROL_SCHEMES.map((scheme) => ({
    ...MOVE_KEYS[scheme.move],
    interact: ACTION_KEYS[scheme.interact],
    ability: ACTION_KEYS[scheme.ability],
    sprint: ACTION_KEYS[scheme.sprint],
  }));

const EMPTY_LATCH = (): ActionLatch => ({
  interact: false,
  ability: false,
  sprint: false,
});

const EMPTY_GAMEPAD_BUTTONS = (): GamepadButtons => ({
  interact: false,
  ability: false,
  sprint: false,
  pause: false,
});

function pressed(button: GamepadButton | undefined): boolean {
  return Boolean(button?.pressed || (button?.value ?? 0) > 0.5);
}

function clampPlayerCount(playerCount: number): number {
  if (!Number.isInteger(playerCount) || playerCount < 1 || playerCount > 4) {
    throw new RangeError("InputManager supports between one and four players.");
  }
  return playerCount;
}

/**
 * Browser input adapter. The engine remains browser-free: callers sample this
 * class once per rendered frame and pass the returned PlayerInput values into
 * their fixed simulation steps.
 */
export class InputManager {
  private readonly target: Window | null;
  private readonly gamepads: () => readonly (Gamepad | null)[];
  private readonly heldKeys = new Set<string>();
  private readonly keyboardLatches = Array.from(
    { length: MAX_PLAYERS },
    EMPTY_LATCH,
  );
  private readonly previousGamepadButtons = new Map<number, GamepadButtons>();
  private readonly joinQueue: InputDevice[] = [];
  private readonly queuedDevices = new Set<string>();
  private pauseLatched = false;
  private activePlay = false;
  private destroyed = false;

  constructor(options: InputManagerOptions | Window = {}) {
    const resolved = isWindowTarget(options) ? { target: options } : options;
    this.target =
      resolved.target ?? (typeof window === "undefined" ? null : window);
    this.gamepads =
      resolved.gamepads ??
      (() => this.target?.navigator.getGamepads?.() ?? ([] as Gamepad[]));

    this.target?.addEventListener("keydown", this.onKeyDown, { passive: false });
    this.target?.addEventListener("keyup", this.onKeyUp, { passive: false });
    this.target?.addEventListener("blur", this.onBlur);
  }

  /** Only gameplay consumes browser shortcuts; lobby and menus behave normally. */
  setActivePlay(active: boolean): void {
    this.activePlay = active;
    if (!active) this.clearHeldState();
  }

  /**
   * Returns held inputs plus rising-edge fields. Keyboard scheme N and gamepad
   * N are merged, allowing either device to control that local player.
   */
  getFrames(playerCount: number): InputFrame[] {
    const count = clampPlayerCount(playerCount);
    const connected = this.connectedGamepads();
    this.detectGamepadJoins(connected);
    const pads = connected.slice(0, MAX_PLAYERS);
    const frames = Array.from({ length: count }, (_, playerIndex) =>
      this.frameForPlayer(playerIndex, pads[playerIndex] ?? null, count),
    );
    this.commitGamepadButtons(connected);

    for (let index = 0; index < count; index += 1) {
      this.keyboardLatches[index] = EMPTY_LATCH();
    }
    this.pauseLatched = false;
    return frames;
  }

  /** Alias suited to requestAnimationFrame-based callers. */
  sample(playerCount: number): InputFrame[] {
    return this.getFrames(playerCount);
  }

  /** Devices that pressed a join-capable action since the last call. */
  consumeJoinRequests(): InputDevice[] {
    // Poll here as well so a lobby can detect pads before a game has players.
    const connected = this.connectedGamepads();
    this.detectGamepadJoins(connected);
    this.commitGamepadButtons(connected);
    const requests = this.joinQueue.splice(0);
    this.queuedDevices.clear();
    return requests;
  }

  consumePausePressed(): boolean {
    const value = this.pauseLatched;
    this.pauseLatched = false;
    return value;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.target?.removeEventListener("keydown", this.onKeyDown);
    this.target?.removeEventListener("keyup", this.onKeyUp);
    this.target?.removeEventListener("blur", this.onBlur);
    this.clearHeldState();
    this.previousGamepadButtons.clear();
    this.joinQueue.length = 0;
    this.queuedDevices.clear();
  }

  /** Conventional cleanup alias for React effects. */
  dispose(): void {
    this.destroy();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.destroyed) return;
    if (this.activePlay && this.isControlledKey(event)) event.preventDefault();

    const tokens = this.eventTokens(event);
    const wasHeld = tokens.some((token) => this.heldKeys.has(token));
    tokens.forEach((token) => this.heldKeys.add(token));

    if (event.code === "Escape" || event.key === "Escape") {
      if (!wasHeld && !event.repeat) this.pauseLatched = true;
      return;
    }
    if (wasHeld || event.repeat) return;

    KEYBOARD_BINDINGS.forEach((binding, scheme) => {
      const action = this.actionForTokens(binding, tokens);
      if (action) this.keyboardLatches[scheme][action] = true;

      const isJoinAction =
        action === "interact" ||
        action === "ability" ||
        this.tokensMatch(tokens, [
          ...binding.up,
          ...binding.down,
          ...binding.left,
          ...binding.right,
        ]);
      if (isJoinAction) {
        this.queueDevice(`keyboard:${scheme}`, { kind: "keyboard", scheme });
      }
    });
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.destroyed) return;
    if (this.activePlay && this.isControlledKey(event)) event.preventDefault();
    this.eventTokens(event).forEach((token) => this.heldKeys.delete(token));
  };

  private readonly onBlur = (): void => {
    this.clearHeldState();
  };

  private frameForPlayer(
    playerIndex: number,
    gamepad: Gamepad | null,
    playerCount: number,
  ): InputFrame {
    const binding = KEYBOARD_BINDINGS[playerIndex];
    const soloArrowBinding =
      playerCount === 1 && playerIndex === 0 ? MOVE_KEYS.ARROWS : undefined;
    const keyboard = this.keyboardFrame(binding, soloArrowBinding);
    const pad = gamepad ? this.gamepadFrame(gamepad) : null;
    const latch = this.keyboardLatches[playerIndex];
    const previousPad = gamepad
      ? this.previousGamepadButtons.get(gamepad.index) ?? EMPTY_GAMEPAD_BUTTONS()
      : EMPTY_GAMEPAD_BUTTONS();
    const currentPad = pad?.buttons ?? EMPTY_GAMEPAD_BUTTONS();

    const rawX = keyboard.moveX + (pad?.moveX ?? 0);
    const rawY = keyboard.moveY + (pad?.moveY ?? 0);
    const magnitude = Math.hypot(rawX, rawY);
    const moveX = magnitude > 1 ? rawX / magnitude : rawX;
    const moveY = magnitude > 1 ? rawY / magnitude : rawY;
    const pausePressed =
      this.pauseLatched || (currentPad.pause && !previousPad.pause);

    return {
      moveX,
      moveY,
      interact: keyboard.interact || currentPad.interact,
      ability: keyboard.ability || currentPad.ability,
      sprint: keyboard.sprint || currentPad.sprint,
      interactPressed:
        latch.interact || (currentPad.interact && !previousPad.interact),
      abilityPressed:
        latch.ability || (currentPad.ability && !previousPad.ability),
      sprintPressed:
        latch.sprint || (currentPad.sprint && !previousPad.sprint),
      pausePressed,
    };
  }

  private keyboardFrame(
    binding: KeyboardBinding,
    movementAlias?: MovementBinding,
  ): PlayerInput {
    const x =
      Number(
        this.anyHeld(binding.right) ||
          Boolean(movementAlias && this.anyHeld(movementAlias.right)),
      ) -
      Number(
        this.anyHeld(binding.left) ||
          Boolean(movementAlias && this.anyHeld(movementAlias.left)),
      );
    const y =
      Number(
        this.anyHeld(binding.down) ||
          Boolean(movementAlias && this.anyHeld(movementAlias.down)),
      ) -
      Number(
        this.anyHeld(binding.up) ||
          Boolean(movementAlias && this.anyHeld(movementAlias.up)),
      );
    const magnitude = Math.hypot(x, y);

    return {
      ...EMPTY_INPUT,
      moveX: magnitude > 1 ? x / magnitude : x,
      moveY: magnitude > 1 ? y / magnitude : y,
      interact: this.anyHeld(binding.interact),
      ability: this.anyHeld(binding.ability),
      sprint: this.anyHeld(binding.sprint),
    };
  }

  private gamepadFrame(gamepad: Gamepad): {
    moveX: number;
    moveY: number;
    buttons: GamepadButtons;
  } {
    const left = pressed(gamepad.buttons[14]);
    const right = pressed(gamepad.buttons[15]);
    const up = pressed(gamepad.buttons[12]);
    const down = pressed(gamepad.buttons[13]);
    let x = (gamepad.axes[0] ?? 0) + Number(right) - Number(left);
    let y = (gamepad.axes[1] ?? 0) + Number(down) - Number(up);

    if (Math.abs(x) < GAMEPAD_DEAD_ZONE) x = 0;
    if (Math.abs(y) < GAMEPAD_DEAD_ZONE) y = 0;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }

    return {
      moveX: x,
      moveY: y,
      buttons: {
        interact: pressed(gamepad.buttons[0]),
        ability: pressed(gamepad.buttons[2]),
        sprint: pressed(gamepad.buttons[7]) || pressed(gamepad.buttons[1]),
        pause: pressed(gamepad.buttons[9]),
      },
    };
  }

  private connectedGamepads(): Gamepad[] {
    return Array.from(this.gamepads()).filter(
      (gamepad): gamepad is Gamepad => Boolean(gamepad?.connected),
    );
  }

  private detectGamepadJoins(connected: readonly Gamepad[]): void {
    connected.forEach((gamepad) => {
      const current = this.gamepadFrame(gamepad).buttons;
      const previous =
        this.previousGamepadButtons.get(gamepad.index) ?? EMPTY_GAMEPAD_BUTTONS();
      if (
        (current.interact && !previous.interact) ||
        (current.pause && !previous.pause)
      ) {
        this.queueDevice(`gamepad:${gamepad.index}`, {
          kind: "gamepad",
          index: gamepad.index,
          id: gamepad.id,
        });
      }
    });
  }

  private commitGamepadButtons(connected: readonly Gamepad[]): void {
    const liveIndexes = new Set<number>();
    connected.forEach((gamepad) => {
      liveIndexes.add(gamepad.index);
      this.previousGamepadButtons.set(
        gamepad.index,
        this.gamepadFrame(gamepad).buttons,
      );
    });
    for (const index of this.previousGamepadButtons.keys()) {
      if (!liveIndexes.has(index)) this.previousGamepadButtons.delete(index);
    }
  }

  private anyHeld(keys: readonly string[]): boolean {
    return keys.some((key) => this.heldKeys.has(key));
  }

  private eventTokens(event: KeyboardEvent): string[] {
    return event.code === event.key ? [event.code] : [event.code, event.key];
  }

  private tokensMatch(tokens: readonly string[], keys: readonly string[]): boolean {
    return tokens.some((token) => keys.includes(token));
  }

  private actionForTokens(
    binding: KeyboardBinding,
    tokens: readonly string[],
  ): ActionName | null {
    if (this.tokensMatch(tokens, binding.interact)) return "interact";
    if (this.tokensMatch(tokens, binding.ability)) return "ability";
    if (this.tokensMatch(tokens, binding.sprint)) return "sprint";
    return null;
  }

  private isControlledKey(event: KeyboardEvent): boolean {
    const tokens = this.eventTokens(event);
    if (tokens.includes("Escape")) return true;
    return KEYBOARD_BINDINGS.some((binding) =>
      this.tokensMatch(tokens, [
        ...binding.up,
        ...binding.down,
        ...binding.left,
        ...binding.right,
        ...binding.interact,
        ...binding.ability,
        ...binding.sprint,
      ]),
    );
  }

  private queueDevice(key: string, device: InputDevice): void {
    if (this.queuedDevices.has(key)) return;
    this.queuedDevices.add(key);
    this.joinQueue.push(device);
  }

  private clearHeldState(): void {
    this.heldKeys.clear();
    for (let index = 0; index < MAX_PLAYERS; index += 1) {
      this.keyboardLatches[index] = EMPTY_LATCH();
    }
    this.pauseLatched = false;
  }
}
