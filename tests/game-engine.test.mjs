import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceLoop,
  checksumGame,
  createGame,
  formatMuseumTime,
  stepGame,
} from "../app/game/engine.ts";
import { EMPTY_INPUT, SIM_HZ } from "../app/game/model.ts";

const ROLES = ["glitch", "talker", "tinkerer", "hamster"];

function input(overrides = {}) {
  return { ...EMPTY_INPUT, ...overrides };
}

function inputsFor(state, playerId = -1, overrides = {}) {
  return state.players.map((player) =>
    player.id === playerId ? input(overrides) : input(),
  );
}

function stepMany(state, ticks, makeInputs = () => inputsFor(state)) {
  for (let tick = 0; tick < ticks; tick += 1) {
    stepGame(state, makeInputs(tick));
  }
  return state;
}

test("the same seed and inputs produce the same simulation checksum", () => {
  const config = { roles: ROLES, seed: 0x71e5da7, clockRate: 4 };
  const first = createGame(config);
  const second = createGame(config);

  const scriptedInput = (tick) =>
    first.players.map((_, player) =>
      input({
        moveX: player % 2 === 0 ? 0.6 : -0.35,
        moveY: tick % 120 < 60 ? -0.45 : 0.45,
        sprint: tick % 90 < 25,
        interact: tick % 137 === 0,
      }),
    );

  for (let tick = 0; tick < SIM_HZ * 4; tick += 1) {
    const frame = scriptedInput(tick);
    stepGame(first, frame.map((entry) => ({ ...entry })));
    stepGame(second, frame.map((entry) => ({ ...entry })));
  }

  assert.equal(checksumGame(first), checksumGame(second));
  assert.deepEqual(first, second);
});

test("the loop enters its summary on the exact configured timeout tick", () => {
  const state = createGame({ roles: ["glitch"], seed: 12, clockRate: 4 });
  const finalTick = state.loopTicksTotal;

  stepMany(state, finalTick - 1);
  assert.equal(state.scene, "heist");
  assert.equal(state.loopTick, finalTick - 1);
  assert.notEqual(formatMuseumTime(state), "00:00");

  stepGame(state, inputsFor(state));
  assert.equal(state.scene, "loop_summary");
  assert.equal(state.loopTick, finalTick);
  assert.equal(formatMuseumTime(state), "00:00");

  stepGame(state, inputsFor(state));
  assert.equal(state.scene, "loop_summary");
  assert.equal(state.loopTick, finalTick, "the summary must freeze simulation");
});

test("advanceLoop preserves exactly the selected anchor and resets the museum", () => {
  const state = createGame({ roles: ["glitch"], seed: 91, clockRate: 4 });
  const player = state.players[0];
  player.discoveries = ["staff_badge", "vault_phrase", "cat_treat"];
  player.carried = "staff_badge";
  player.anchored = "staff_badge";
  state.scene = "loop_summary";
  state.alarm = 93;
  state.seals.forEach((seal) => {
    seal.disabled = true;
  });
  state.items.forEach((item) => {
    item.active = false;
  });

  advanceLoop(state);

  assert.equal(state.scene, "heist");
  assert.equal(state.loopNumber, 2);
  assert.equal(state.loopTick, 0);
  assert.equal(state.alarm, 0);
  assert.equal(player.anchored, "staff_badge");
  assert.equal(player.carried, "staff_badge");
  assert.deepEqual(
    [...new Set([player.anchored, player.carried].filter(Boolean))],
    ["staff_badge"],
    "a player can never smuggle a second thing across the reset",
  );
  assert.ok(!player.discoveries.includes("vault_phrase"));
  assert.ok(!player.discoveries.includes("cat_treat"));
  assert.ok(state.seals.every((seal) => !seal.disabled));
});

test("each specialist ability produces its role-specific effect", async (t) => {
  await t.test("The Glitch phases", () => {
    const state = createGame({ roles: ["glitch"], seed: 1 });
    stepGame(state, inputsFor(state, 0, { ability: true }));
    assert.ok(state.players[0].abilityActive > 0);
    assert.ok(state.players[0].abilityCooldown > 0);
  });

  await t.test("The Talker baffles a nearby guard", () => {
    const state = createGame({ roles: ["talker"], seed: 2 });
    const player = state.players[0];
    const guard = state.guards[0];
    player.x = guard.x + 8;
    player.y = guard.y;
    stepGame(state, inputsFor(state, 0, { ability: true }));
    assert.equal(guard.mode, "persuaded");
    assert.ok(state.stats.guardsBaffled > 0);
  });

  await t.test("The Tinkerer disables nearby machinery", () => {
    const state = createGame({ roles: ["tinkerer"], seed: 3 });
    const player = state.players[0];
    const seal = state.seals[0];
    player.x = seal.x + 8;
    player.y = seal.y;
    stepGame(state, inputsFor(state, 0, { ability: true }));
    assert.ok(seal.disabled || state.guards.some((guard) => guard.mode === "stunned"));
    assert.ok(state.stats.exhibitsImprovised > 0);
  });

  await t.test("Chrono Hamster restores a five-second snapshot", () => {
    const state = createGame({ roles: ["hamster"], seed: 4 });
    const player = state.players[0];
    const snapshotX = player.x - 80;
    state.loopTick = SIM_HZ * 6;
    state.alarm = 72;
    player.x += 120;
    state.rewindHistory = [
      {
        loopTick: SIM_HZ,
        alarm: 11,
        players: [
          {
            x: snapshotX,
            y: player.y,
            carried: null,
            caughtTicks: 0,
            mounted: false,
            disguised: false,
          },
        ],
        itemActive: state.items.map((item) => item.active),
        sealDisabled: state.seals.map((seal) => seal.disabled),
        catDistractedTicks: 0,
      },
    ];

    stepGame(state, inputsFor(state, 0, { ability: true }));
    assert.equal(player.x, snapshotX);
    assert.equal(state.alarm, 11);
    assert.equal(state.stats.rewinds, 1);
    assert.ok(player.abilityCooldown > 0);
  });
});

test("new run seeds vary the final artifact", () => {
  const artifactIds = new Set();
  for (let seed = 1; seed <= 32; seed += 1) {
    artifactIds.add(createGame({ roles: ["glitch"], seed }).artifact.id);
  }

  assert.ok(artifactIds.size >= 3, "the artifact should materially vary by seed");
  assert.equal(
    createGame({ roles: ["glitch"], seed: 808 }).artifact.id,
    createGame({ roles: ["glitch"], seed: 808 }).artifact.id,
  );
});

test("stealing the artifact leads through a reachable escape to victory", () => {
  const state = createGame({ roles: ["glitch"], seed: 55 });
  const player = state.players[0];
  state.seals.forEach((seal) => {
    seal.disabled = true;
  });
  state.cat.distractedTicks = SIM_HZ * 30;
  player.x = state.artifact.x;
  player.y = state.artifact.y;

  stepGame(state, inputsFor(state, 0, { interact: true }));
  assert.equal(state.scene, "escape");
  assert.equal(state.artifact.stolen, true);
  assert.equal(state.artifact.carrierId, player.id);

  for (let stage = 0; stage < 8 && state.scene === "escape"; stage += 1) {
    assert.ok(state.escape, "escape state must exist until the getaway");
    player.x = state.escape.gateX;
    player.y = state.escape.gateY;
    state.artifact.carrierId = player.id;
    stepGame(state, inputsFor(state));
  }

  assert.equal(state.scene, "victory");
  assert.equal(state.artifact.carrierId, player.id);
});
