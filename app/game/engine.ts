import {
  ARTIFACTS,
  DEFAULT_CLOCK_RATE,
  ESCAPE_STAGES,
  FICTION_LOOP_SECONDS,
  GUARD_ROUTES,
  ITEM_SPAWNS,
  LOOP_MODIFIERS,
  MUSEUM_ROOMS,
  PAINTING_SPOTS,
  PLAYER_STARTS,
  SIM_HZ,
  STATIC_OBSTACLES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./model.ts";
import type {
  ArtifactId,
  CarryId,
  GameConfig,
  GameMessage,
  GameState,
  GuardState,
  IntelId,
  PlayerInput,
  PlayerState,
  PortalState,
  Rect,
  RewindSnapshot,
  RoleId,
  Vec2,
} from "./model.ts";

const PLAYER_RADIUS = 15;
const INTERACT_RADIUS = 54;
const REWIND_TICKS = SIM_HZ * 5;
const ESCAPE_STAGE_TICKS = SIM_HZ * 35;
const ZERO_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  interact: false,
  ability: false,
  sprint: false,
};

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
const distanceSquared = (a: Vec2, b: Vec2) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
const near = (a: Vec2, b: Vec2, radius: number) =>
  distanceSquared(a, b) <= radius * radius;

function mixedSeed(value: number): number {
  let result = value >>> 0;
  result ^= result >>> 16;
  result = Math.imul(result, 0x7feb352d);
  result ^= result >>> 15;
  result = Math.imul(result, 0x846ca68b);
  result ^= result >>> 16;
  return (result >>> 0) || 0x6d2b79f5;
}

function pushMessage(
  state: GameState,
  title: string,
  body: string,
  tone: GameMessage["tone"] = "info",
  ticksLeft = SIM_HZ * 4,
) {
  state.messageCounter += 1;
  state.messages.push({
    id: state.messageCounter,
    title,
    body,
    tone,
    ticksLeft,
  });
  if (state.messages.length > 6) state.messages.shift();
}

function makePlayers(config: GameConfig): PlayerState[] {
  const roles: RoleId[] =
    config.roles.length > 0 ? config.roles.slice(0, 4) : ["glitch"];
  return roles.map((role, id) => {
    const start = PLAYER_STARTS[id];
    return {
      id,
      role,
      x: start.x,
      y: start.y,
      previousX: start.x,
      previousY: start.y,
      directionX: 0,
      directionY: -1,
      lastSafeX: start.x,
      lastSafeY: start.y,
      carried: null,
      anchored: null,
      discoveries: [],
      abilityCooldown: 0,
      abilityActive: 0,
      caughtTicks: 0,
      invulnerableTicks: 0,
      portalCooldown: 0,
      noise: 0,
      disguised: false,
      mounted: false,
      interactHeld: false,
      abilityHeld: false,
      sprinting: false,
    };
  });
}

function makeGuards(remembersCrew = false): GuardState[] {
  return GUARD_ROUTES.map((definition, id) => {
    const start = definition.route[0];
    const next = definition.route[1];
    const dx = next.x - start.x;
    const dy = next.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      id,
      name: definition.name,
      x: start.x,
      y: start.y,
      previousX: start.x,
      previousY: start.y,
      directionX: dx / length,
      directionY: dy / length,
      route: definition.route.map((point) => ({ ...point })),
      routeIndex: 1,
      mode: "patrol",
      modeTicks: 0,
      suspicion: 0,
      targetPlayer: null,
      remembersCrew,
    };
  });
}

function makePortals(seed: number, loopNumber: number): PortalState[] {
  const roll = mixedSeed(seed ^ Math.imul(loopNumber, 0x9e3779b1));
  const first = roll % PAINTING_SPOTS.length;
  const second = (first + 1 + ((roll >>> 5) % 3)) % PAINTING_SPOTS.length;
  return PAINTING_SPOTS.map((spot, index) => {
    const pairedIndex = index === first ? second : index === second ? first : index;
    return {
      id: spot.id,
      x: spot.x,
      y: spot.y,
      destinationId: PAINTING_SPOTS[pairedIndex].id,
      active: index === first || index === second,
      discovered: false,
    };
  });
}

function makeCat() {
  const route = [
    { x: 700, y: 300 },
    { x: 900, y: 300 },
    { x: 985, y: 470 },
    { x: 800, y: 610 },
    { x: 610, y: 470 },
  ];
  return {
    x: route[0].x,
    y: route[0].y,
    previousX: route[0].x,
    previousY: route[0].y,
    route,
    routeIndex: 1,
    distractedTicks: 0,
    pulse: 0,
  };
}

function makeDinosaur() {
  return {
    x: 280,
    y: 205,
    previousX: 280,
    previousY: 205,
    awake: false,
    targetPlayer: null,
    chargeTicks: 0,
  };
}

function makeMammoth(active = false) {
  return {
    x: active ? 310 : 380,
    y: active ? 770 : 205,
    previousX: active ? 310 : 380,
    previousY: active ? 770 : 205,
    active,
    riderId: null,
    directionX: 1,
    directionY: 0,
  };
}

export function createGame(config: GameConfig): GameState {
  const seed = mixedSeed(config.seed ?? 0x54554553);
  const clockRate = clamp(
    Number.isFinite(config.clockRate) ? (config.clockRate as number) : DEFAULT_CLOCK_RATE,
    0.25,
    60,
  );
  const artifactIds = Object.keys(ARTIFACTS) as ArtifactId[];
  const artifactId = artifactIds[mixedSeed(seed ^ 0xa17f3c21) % artifactIds.length];
  const state: GameState = {
    scene: "heist",
    paused: false,
    seed,
    rng: mixedSeed(seed ^ 0xc0ffee),
    tick: 0,
    loopTick: 0,
    loopTicksTotal: Math.max(
      1,
      Math.round((FICTION_LOOP_SECONDS / clockRate) * SIM_HZ),
    ),
    clockRate,
    loopNumber: 1,
    alarm: 0,
    alarmPeak: 0,
    players: makePlayers(config),
    guards: makeGuards(false),
    items: ITEM_SPAWNS.map((item) => ({ ...item, active: true })),
    portals: makePortals(seed, 1),
    cat: makeCat(),
    dinosaur: makeDinosaur(),
    mammoth: makeMammoth(false),
    seals: [
      { id: "identity", label: "IDENTITY SEAL", x: 760, y: 272, disabled: false },
      { id: "chrono", label: "CHRONO SEAL", x: 800, y: 272, disabled: false },
      { id: "psychic", label: "PSYCHIC SEAL", x: 840, y: 272, disabled: false },
    ],
    artifact: { id: artifactId, x: 800, y: 142, stolen: false, carrierId: null },
    escape: null,
    intel: [],
    discoveredThisLoop: [],
    modifier: LOOP_MODIFIERS[0],
    objective: "Break the three vault seals.",
    messages: [],
    messageCounter: 0,
    timelineFlags: {},
    rewindHistory: [],
    stats: {
      loops: 1,
      detections: 0,
      rewinds: 0,
      guardsBaffled: 0,
      exhibitsImprovised: 0,
      portalsUsed: 0,
      escapeTicks: 0,
    },
  };
  pushMessage(
    state,
    "TUESDAY, AGAIN",
    `Find ${ARTIFACTS[artifactId].name} before the museum resets.`,
    "info",
    SIM_HZ * 6,
  );
  return state;
}

function discoverIntel(state: GameState, intel: IntelId, body: string) {
  if (!state.intel.includes(intel)) state.intel.push(intel);
  if (!state.discoveredThisLoop.includes(intel)) {
    state.discoveredThisLoop.push(intel);
    pushMessage(state, "NEW LOOP INTEL", body, "success");
  }
}

function circleHitsRect(x: number, y: number, radius: number, rect: Rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.w);
  const closestY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function vaultDoor(state: GameState): Rect | null {
  return state.seals.every((seal) => seal.disabled)
    ? null
    : { x: 754, y: 234, w: 92, h: 30, kind: "vault-door" };
}

function isBlocked(state: GameState, x: number, y: number, radius: number) {
  if (x - radius < 36 || x + radius > WORLD_WIDTH - 36) return true;
  if (y - radius < 40 || y + radius > WORLD_HEIGHT - 34) return true;
  const door = vaultDoor(state);
  if (door && circleHitsRect(x, y, radius, door)) return true;
  return STATIC_OBSTACLES.some((obstacle) =>
    circleHitsRect(x, y, radius, obstacle),
  );
}

function moveBody(
  state: GameState,
  body: Vec2,
  dx: number,
  dy: number,
  radius: number,
  phase = false,
) {
  const nextX = clamp(body.x + dx, radius + 36, WORLD_WIDTH - radius - 36);
  const nextY = clamp(body.y + dy, radius + 40, WORLD_HEIGHT - radius - 34);
  if (phase || !isBlocked(state, nextX, body.y, radius)) body.x = nextX;
  if (phase || !isBlocked(state, body.x, nextY, radius)) body.y = nextY;
}

function moveToward(body: Vec2, target: Vec2, speed: number) {
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  const length = Math.hypot(dx, dy);
  if (length <= speed || length === 0) {
    body.x = target.x;
    body.y = target.y;
    return { x: dx, y: dy, arrived: true };
  }
  body.x += (dx / length) * speed;
  body.y += (dy / length) * speed;
  return { x: dx / length, y: dy / length, arrived: false };
}

function recordSnapshot(state: GameState) {
  if (!state.players.some((player) => player.role === "hamster")) return;
  const snapshot: RewindSnapshot = {
    loopTick: state.loopTick,
    alarm: state.alarm,
    players: state.players.map((player) => ({
      x: player.x,
      y: player.y,
      carried: player.carried,
      caughtTicks: player.caughtTicks,
      mounted: player.mounted,
      disguised: player.disguised,
    })),
    itemActive: state.items.map((item) => item.active),
    sealDisabled: state.seals.map((seal) => seal.disabled),
    catDistractedTicks: state.cat.distractedTicks,
  };
  state.rewindHistory.push(snapshot);
  const oldest = Math.max(0, state.loopTick - REWIND_TICKS);
  while (
    state.rewindHistory.length > 1 &&
    state.rewindHistory[1].loopTick <= oldest
  ) {
    state.rewindHistory.shift();
  }
  while (state.rewindHistory.length > REWIND_TICKS + 2) {
    state.rewindHistory.shift();
  }
}

function rewind(state: GameState, hamster: PlayerState) {
  const target = Math.max(0, state.loopTick - REWIND_TICKS);
  let snapshot = state.rewindHistory[0];
  for (const candidate of state.rewindHistory) {
    if (candidate.loopTick <= target) snapshot = candidate;
    else break;
  }
  if (!snapshot) return false;
  state.loopTick = snapshot.loopTick;
  state.alarm = snapshot.alarm;
  state.players.forEach((player, index) => {
    const old = snapshot.players[index];
    if (!old) return;
    player.x = old.x;
    player.y = old.y;
    player.previousX = old.x;
    player.previousY = old.y;
    player.carried = old.carried;
    player.caughtTicks = old.caughtTicks;
    player.mounted = old.mounted;
    player.disguised = old.disguised;
  });
  state.items.forEach((item, index) => {
    if (snapshot.itemActive[index] !== undefined) {
      item.active = snapshot.itemActive[index];
    }
  });
  state.seals.forEach((seal, index) => {
    if (snapshot.sealDisabled[index] !== undefined) {
      seal.disabled = snapshot.sealDisabled[index];
    }
  });
  state.cat.distractedTicks = snapshot.catDistractedTicks;
  state.rewindHistory = state.rewindHistory.filter(
    (candidate) => candidate.loopTick <= snapshot.loopTick,
  );
  const mounted = state.players.find((player) => player.mounted);
  state.mammoth.riderId = mounted?.id ?? null;
  if (mounted) {
    state.mammoth.x = mounted.x;
    state.mammoth.y = mounted.y;
  }
  hamster.abilityCooldown = SIM_HZ * 15;
  hamster.abilityActive = 20;
  state.timelineFlags.rewound_this_tick = true;
  state.stats.rewinds += 1;
  pushMessage(state, "FIVE SECONDS UNHAPPENED", "The hamster remembers both versions.", "role");
  return true;
}

function activateAbility(state: GameState, player: PlayerState) {
  if (!getAbilityReady(player)) return;
  if (player.role === "glitch") {
    player.abilityActive = SIM_HZ * 2;
    player.abilityCooldown = SIM_HZ * 10;
    pushMessage(state, "PHASE SHIFT", "Walls have temporarily lost the argument.", "role");
    return;
  }
  if (player.role === "talker") {
    let baffled = 0;
    for (const guard of state.guards) {
      if (!near(player, guard, 270)) continue;
      guard.mode = "persuaded";
      guard.modeTicks = SIM_HZ * 6;
      guard.targetPlayer = null;
      guard.suspicion = 0;
      baffled += 1;
    }
    if (near(player, state.cat, 270)) state.cat.distractedTicks = SIM_HZ * 8;
    const identity = state.seals.find((seal) => seal.id === "identity");
    if (identity && near(player, identity, 125)) identity.disabled = true;
    state.stats.guardsBaffled += baffled;
    state.alarm = Math.max(0, state.alarm - 24);
    player.abilityActive = SIM_HZ * 2;
    player.abilityCooldown = SIM_HZ * 10;
    pushMessage(state, "ABSURD ALIBI", "Everyone nearby recalls authorizing this.", "role");
    return;
  }
  if (player.role === "tinkerer") {
    const radius = player.carried === "emp_coil" ? 360 : 230;
    for (const guard of state.guards) {
      if (!near(player, guard, radius)) continue;
      guard.mode = "stunned";
      guard.modeTicks = SIM_HZ * 4;
      guard.targetPlayer = null;
    }
    for (const seal of state.seals) {
      if (near(player, seal, radius)) seal.disabled = true;
    }
    if (near(player, state.cat, radius)) state.cat.distractedTicks = SIM_HZ * 5;
    state.stats.exhibitsImprovised += 1;
    player.abilityActive = 30;
    player.abilityCooldown = SIM_HZ * 12;
    pushMessage(state, "IMPROVISED EMP", "Several priceless exhibits are now a circuit.", "role");
    return;
  }
  rewind(state, player);
}

function addDiscovery(player: PlayerState, carry: CarryId) {
  if (!player.discoveries.includes(carry)) player.discoveries.push(carry);
}

function returnItem(state: GameState, carry: CarryId) {
  const item = state.items.find((candidate) => candidate.carryId === carry);
  if (item) item.active = true;
}

function enterPortal(state: GameState, player: PlayerState, portal: PortalState) {
  const destination = state.portals.find(
    (candidate) => candidate.id === portal.destinationId,
  );
  if (!destination) return;
  player.x = destination.x + (player.id % 2 === 0 ? 28 : -28);
  player.y = destination.y;
  player.previousX = player.x;
  player.previousY = player.y;
  player.portalCooldown = SIM_HZ;
  portal.discovered = true;
  destination.discovered = true;
  state.stats.portalsUsed += 1;
  discoverIntel(state, "portal_pair", "Two suspicious paintings share the same inside.");
}

function canBreakSeal(state: GameState, player: PlayerState, sealId: string) {
  if (sealId === "identity") {
    return (
      player.carried === "staff_badge" ||
      player.carried === "guard_memory" ||
      (player.role === "talker" && player.abilityActive > 0)
    );
  }
  if (sealId === "chrono") {
    return (
      player.carried === "vault_phrase" ||
      player.carried === "emp_coil" ||
      player.role === "tinkerer"
    );
  }
  return (
    state.cat.distractedTicks > 0 ||
    player.carried === "cat_treat" ||
    (player.role === "talker" && player.abilityActive > 0)
  );
}

function interact(state: GameState, player: PlayerState) {
  if (player.mounted) {
    player.mounted = false;
    state.mammoth.riderId = null;
    return;
  }
  if (
    !state.artifact.stolen &&
    near(player, state.artifact, INTERACT_RADIUS) &&
    state.seals.every((seal) => seal.disabled) &&
    (state.cat.distractedTicks > 0 ||
      player.carried === "cat_treat" ||
      player.role === "talker")
  ) {
    state.artifact.stolen = true;
    state.artifact.carrierId = player.id;
    state.scene = "escape";
    state.escape = {
      stage: 0,
      ticksLeft: ESCAPE_STAGE_TICKS,
      gateX: ESCAPE_STAGES[0].x,
      gateY: ESCAPE_STAGES[0].y,
      stageFlash: SIM_HZ,
    };
    state.objective = `Escape: ${ESCAPE_STAGES[0].name}`;
    pushMessage(state, "ARTIFACT ACQUIRED", "History has noticed. Run.", "alarm", SIM_HZ * 6);
    return;
  }
  const catClose = near(player, state.cat, INTERACT_RADIUS + 12);
  if (catClose && player.carried === "cat_treat") {
    state.cat.distractedTicks = SIM_HZ * 18;
    discoverIntel(state, "cat_weakness", "The psychic cat cannot read minds while chewing.");
    return;
  }
  if (near(player, state.mammoth, INTERACT_RADIUS + 18)) {
    if (state.mammoth.active && state.mammoth.riderId === null) {
      state.mammoth.riderId = player.id;
      player.mounted = true;
      return;
    }
    if (player.carried === "mammoth_whistle") {
      state.mammoth.active = true;
      state.mammoth.riderId = player.id;
      player.mounted = true;
      pushMessage(state, "MAMMOTH ONLINE", "Gift shop policy has no clause for this.", "role");
      return;
    }
  }
  const seal = state.seals.find(
    (candidate) => !candidate.disabled && near(player, candidate, INTERACT_RADIUS),
  );
  if (seal && canBreakSeal(state, player, seal.id)) {
    seal.disabled = true;
    pushMessage(state, `${seal.label} BROKEN`, "One less objection from the vault.", "success");
    return;
  }
  const portal = state.portals.find(
    (candidate) =>
      candidate.active && player.portalCooldown <= 0 && near(player, candidate, INTERACT_RADIUS),
  );
  if (portal) {
    enterPortal(state, player, portal);
    return;
  }
  let closest = null as GameState["items"][number] | null;
  let closestDistance = Infinity;
  for (const item of state.items) {
    if (!item.active) continue;
    const d = distanceSquared(player, item);
    if (d <= INTERACT_RADIUS * INTERACT_RADIUS && d < closestDistance) {
      closest = item;
      closestDistance = d;
    }
  }
  if (!closest) return;
  if (player.carried) returnItem(state, player.carried);
  player.carried = closest.carryId;
  player.disguised = closest.carryId === "staff_badge";
  addDiscovery(player, closest.carryId);
  closest.active = false;
  if (closest.carryId === "portal_memory") {
    state.portals.filter((p) => p.active).forEach((p) => (p.discovered = true));
    discoverIntel(state, "portal_pair", "The portal coordinates reveal today's pair.");
  } else if (closest.carryId === "guard_memory") {
    discoverIntel(state, "guard_routes", "Morrow patrols clockwise and hates improvisation.");
  } else if (closest.carryId === "vault_phrase") {
    discoverIntel(state, "vault_location", "The chrono seal accepts a badly spelled pharaoh.");
  }
  pushMessage(state, "ONE HAND FULL", `Picked up ${closest.carryId.replaceAll("_", " ")}.`, "success");
}

function updatePlayers(state: GameState, inputs: PlayerInput[]) {
  for (const player of state.players) {
    const input = inputs[player.id] ?? ZERO_INPUT;
    player.previousX = player.x;
    player.previousY = player.y;
    if (player.abilityCooldown > 0) player.abilityCooldown -= 1;
    if (player.abilityActive > 0) player.abilityActive -= 1;
    if (player.invulnerableTicks > 0) player.invulnerableTicks -= 1;
    if (player.portalCooldown > 0) player.portalCooldown -= 1;
    player.noise = Math.max(0, player.noise - 1.2);
    if (player.caughtTicks > 0) {
      player.caughtTicks -= 1;
      if (player.caughtTicks === 0) {
        const start = PLAYER_STARTS[player.id];
        player.x = start.x;
        player.y = start.y;
        player.previousX = start.x;
        player.previousY = start.y;
      }
      player.interactHeld = input.interact;
      player.abilityHeld = input.ability;
      continue;
    }
    if (input.ability && !player.abilityHeld) activateAbility(state, player);
    let moveX = clamp(Number.isFinite(input.moveX) ? input.moveX : 0, -1, 1);
    let moveY = clamp(Number.isFinite(input.moveY) ? input.moveY : 0, -1, 1);
    const length = Math.hypot(moveX, moveY);
    if (length > 1) {
      moveX /= length;
      moveY /= length;
    }
    if (length > 0.05) {
      player.directionX = moveX;
      player.directionY = moveY;
    }
    player.sprinting = Boolean(input.sprint && length > 0.05);
    const phase = player.role === "glitch" && player.abilityActive > 0;
    if (player.mounted && state.mammoth.riderId === player.id) {
      const speed = player.sprinting ? 7.2 : 5.7;
      state.mammoth.previousX = state.mammoth.x;
      state.mammoth.previousY = state.mammoth.y;
      moveBody(state, state.mammoth, moveX * speed, moveY * speed, 30, false);
      if (length > 0.05) {
        state.mammoth.directionX = moveX;
        state.mammoth.directionY = moveY;
      }
      player.x = state.mammoth.x;
      player.y = state.mammoth.y;
      player.noise = 100;
    } else {
      const speed = player.sprinting ? 4.7 : 3.25;
      const wasBlocked = isBlocked(state, player.x + moveX * speed, player.y + moveY * speed, PLAYER_RADIUS);
      moveBody(state, player, moveX * speed, moveY * speed, PLAYER_RADIUS, phase);
      if (phase && wasBlocked) {
        discoverIntel(state, "secret_passage", "The Glitch found a route architecture denies exists.");
      }
      if (player.sprinting) player.noise = 80;
      if (!phase && !isBlocked(state, player.x, player.y, PLAYER_RADIUS + 1)) {
        player.lastSafeX = player.x;
        player.lastSafeY = player.y;
      }
    }
    if (input.interact && !player.interactHeld) interact(state, player);
    player.interactHeld = input.interact;
    player.abilityHeld = input.ability;
  }
}

function sightBlocked(a: Vec2, b: Vec2) {
  for (let step = 1; step < 8; step += 1) {
    const t = step / 8;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    if (STATIC_OBSTACLES.some((rect) => circleHitsRect(x, y, 2, rect))) return true;
  }
  return false;
}

function capturePlayer(state: GameState, player: PlayerState) {
  if (player.invulnerableTicks > 0 || player.caughtTicks > 0) return;
  if (player.role === "glitch" && player.abilityActive > 0) return;
  if (player.carried) returnItem(state, player.carried);
  player.carried = null;
  player.disguised = false;
  player.caughtTicks = SIM_HZ + 30;
  player.invulnerableTicks = SIM_HZ * 2;
  if (player.mounted) {
    player.mounted = false;
    state.mammoth.riderId = null;
  }
  state.alarm = clamp(state.alarm + 18, 0, 100);
  pushMessage(state, "TEMPORARILY ARRESTED", "The loop has terrible legal representation.", "alarm");
}

function detectPlayer(state: GameState, guard: GuardState, player: PlayerState) {
  if (player.caughtTicks > 0) return false;
  if (guard.name === "Morrow" && player.carried === "guard_memory") return false;
  const range = player.disguised && !player.sprinting ? 68 : 185;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const d = Math.hypot(dx, dy);
  const facing = d > 0 ? (dx / d) * guard.directionX + (dy / d) * guard.directionY : 1;
  const seen = d <= range && facing > 0.12 && !sightBlocked(guard, player);
  const heard = player.noise > 25 && d <= 90 + player.noise;
  return seen || heard;
}

function updateGuards(state: GameState) {
  for (const guard of state.guards) {
    guard.previousX = guard.x;
    guard.previousY = guard.y;
    if (guard.mode === "stunned" || guard.mode === "persuaded") {
      guard.modeTicks -= 1;
      if (guard.modeTicks <= 0) guard.mode = "patrol";
      continue;
    }
    if (guard.mode === "chase") {
      const target = state.players.find((player) => player.id === guard.targetPlayer);
      if (!target || target.caughtTicks > 0 || distanceSquared(guard, target) > 520 * 520) {
        guard.mode = "investigate";
        guard.modeTicks = SIM_HZ * 2;
        guard.targetPlayer = null;
      } else {
        const before = { x: guard.x, y: guard.y };
        const movement = moveToward(guard, target, 2.8 + state.alarm * 0.009);
        guard.directionX = movement.x;
        guard.directionY = movement.y;
        if (isBlocked(state, guard.x, guard.y, 12)) {
          guard.x = before.x;
          guard.y = before.y;
        }
        if (near(guard, target, 27)) capturePlayer(state, target);
      }
    } else {
      const routeTarget = guard.route[guard.routeIndex];
      const movement = moveToward(guard, routeTarget, guard.mode === "investigate" ? 1.8 : 1.35);
      guard.directionX = movement.x;
      guard.directionY = movement.y;
      if (movement.arrived) guard.routeIndex = (guard.routeIndex + 1) % guard.route.length;
      if (guard.mode === "investigate") {
        guard.modeTicks -= 1;
        if (guard.modeTicks <= 0) guard.mode = "patrol";
      }
    }
    if (guard.mode !== "chase") {
      const target = state.players.find((player) => detectPlayer(state, guard, player));
      if (target) {
        guard.mode = "chase";
        guard.targetPlayer = target.id;
        guard.suspicion = 100;
        state.alarm = clamp(state.alarm + 10, 0, 100);
        state.stats.detections += 1;
        discoverIntel(state, "guard_routes", "Guards repeat their routes, even their dramatic turns.");
      }
    }
  }
}

function updateCat(state: GameState) {
  const cat = state.cat;
  cat.previousX = cat.x;
  cat.previousY = cat.y;
  if (cat.distractedTicks > 0) {
    cat.distractedTicks -= 1;
    return;
  }
  const target = cat.route[cat.routeIndex];
  if (moveToward(cat, target, 1.05).arrived) cat.routeIndex = (cat.routeIndex + 1) % cat.route.length;
  cat.pulse = (cat.pulse + 1) % (SIM_HZ * 3);
  if (cat.pulse !== 0) return;
  const victim = state.players.find(
    (player) =>
      player.caughtTicks <= 0 &&
      player.carried !== "cat_treat" &&
      near(cat, player, 220) &&
      !sightBlocked(cat, player),
  );
  if (!victim) return;
  state.alarm = clamp(state.alarm + 12, 0, 100);
  discoverIntel(state, "cat_weakness", "The cat's psychic sweep arrives every three seconds.");
  const closest = state.guards.reduce((best, guard) =>
    distanceSquared(guard, victim) < distanceSquared(best, victim) ? guard : best,
  );
  if (closest.mode !== "persuaded" && closest.mode !== "stunned") {
    closest.mode = "chase";
    closest.targetPlayer = victim.id;
  }
}

function updateDinosaur(state: GameState) {
  const dinosaur = state.dinosaur;
  dinosaur.previousX = dinosaur.x;
  dinosaur.previousY = dinosaur.y;
  const wakeSecond = state.modifier === "THE DINOSAUR IS EARLY" ? 150 : 420;
  const fictionalElapsed = (state.loopTick / SIM_HZ) * state.clockRate;
  if (state.scene === "escape" && state.escape?.stage === 0) dinosaur.awake = true;
  if (fictionalElapsed >= wakeSecond) dinosaur.awake = true;
  if (!dinosaur.awake) return;
  if (!state.timelineFlags.dinosaur_awake) {
    state.timelineFlags.dinosaur_awake = true;
    discoverIntel(state, "dinosaur_time", `The skeleton wakes at ${Math.floor(wakeSecond / 60)}:${String(wakeSecond % 60).padStart(2, "0")}.`);
  }
  const targets = state.players.filter((player) => player.caughtTicks <= 0);
  if (targets.length === 0) return;
  const target = targets.reduce((best, player) =>
    distanceSquared(dinosaur, player) < distanceSquared(dinosaur, best) ? player : best,
  );
  dinosaur.targetPlayer = target.id;
  dinosaur.chargeTicks += 1;
  moveToward(dinosaur, target, dinosaur.chargeTicks > SIM_HZ * 2 ? 3.7 : 2.35);
  if (near(dinosaur, target, 31) && !target.mounted) capturePlayer(state, target);
}

function updateMammothImpacts(state: GameState) {
  if (!state.mammoth.active || state.mammoth.riderId === null) return;
  for (const guard of state.guards) {
    if (!near(state.mammoth, guard, 48)) continue;
    guard.mode = "stunned";
    guard.modeTicks = SIM_HZ * 4;
    guard.targetPlayer = null;
  }
  if (state.dinosaur.awake && near(state.mammoth, state.dinosaur, 58)) {
    state.dinosaur.chargeTicks = 0;
    state.dinosaur.x = 280;
    state.dinosaur.y = 205;
  }
}

function updateObjective(state: GameState) {
  if (state.scene === "escape" && state.escape) {
    state.objective = `Reach ${ESCAPE_STAGES[state.escape.stage].name}`;
    return;
  }
  if (state.scene !== "heist") return;
  const remaining = state.seals.filter((seal) => !seal.disabled).length;
  if (remaining > 0) state.objective = `Break ${remaining} vault seal${remaining === 1 ? "" : "s"}.`;
  else if (state.cat.distractedTicks <= 0) state.objective = "Distract the psychic security cat.";
  else state.objective = `Steal ${ARTIFACTS[state.artifact.id].name}.`;
}

function finishLoop(state: GameState, body: string) {
  state.scene = "loop_summary";
  state.loopTick = state.loopTicksTotal;
  state.escape = null;
  state.artifact.stolen = false;
  state.artifact.carrierId = null;
  state.objective = "Choose one thing each thief will anchor into the next loop.";
  pushMessage(state, "TUESDAY RESET", body, "alarm", SIM_HZ * 10);
}

function updateEscape(state: GameState) {
  const escape = state.escape;
  if (!escape) return;
  state.stats.escapeTicks += 1;
  escape.ticksLeft -= 1;
  if (escape.stageFlash > 0) escape.stageFlash -= 1;
  if (escape.ticksLeft <= 0) {
    finishLoop(state, "The getaway missed its historical connection.");
    return;
  }
  const carrier = state.players.find((player) => player.id === state.artifact.carrierId);
  if (!carrier || !near(carrier, { x: escape.gateX, y: escape.gateY }, 65)) return;
  if (escape.stage >= ESCAPE_STAGES.length - 1) {
    state.scene = "victory";
    state.objective = "Tuesday has finally been stolen back.";
    escape.stageFlash = SIM_HZ * 2;
    pushMessage(state, "HEIST COMPLETE", "Tomorrow is somebody else's problem.", "success", SIM_HZ * 20);
    return;
  }
  escape.stage += 1;
  escape.ticksLeft = ESCAPE_STAGE_TICKS;
  escape.gateX = ESCAPE_STAGES[escape.stage].x;
  escape.gateY = ESCAPE_STAGES[escape.stage].y;
  escape.stageFlash = SIM_HZ;
  state.players.forEach((player, index) => {
    player.x = PLAYER_STARTS[index].x;
    player.y = PLAYER_STARTS[index].y;
    player.previousX = player.x;
    player.previousY = player.y;
  });
  pushMessage(state, `TIME BREACH ${escape.stage + 1}/4`, ESCAPE_STAGES[escape.stage].name, "alarm");
}

export function stepGame(state: GameState, inputs: PlayerInput[]): GameState {
  if (state.paused || state.scene === "loop_summary" || state.scene === "victory") return state;
  state.messages.forEach((message) => (message.ticksLeft -= 1));
  state.messages = state.messages.filter((message) => message.ticksLeft > 0);
  if (state.scene === "heist") recordSnapshot(state);
  state.tick += 1;
  updatePlayers(state, inputs);
  updateGuards(state);
  updateCat(state);
  updateDinosaur(state);
  updateMammothImpacts(state);
  const activeAlarm = state.guards.some((guard) => guard.mode === "chase");
  if (!activeAlarm && !state.timelineFlags.rewound_this_tick) {
    state.alarm = Math.max(0, state.alarm - 0.025);
  }
  delete state.timelineFlags.rewound_this_tick;
  state.alarmPeak = Math.max(state.alarmPeak, state.alarm);
  if (state.scene === "escape") updateEscape(state);
  else if (state.scene === "heist") {
    state.loopTick += 1;
    if (state.loopTick >= state.loopTicksTotal) {
      finishLoop(state, "The museum snaps back. Your knowledge does not.");
    }
  }
  updateObjective(state);
  return state;
}

export function advanceLoop(state: GameState): GameState {
  if (state.scene !== "loop_summary") return state;
  const anchors = new Set<CarryId>();
  for (const player of state.players) {
    let anchor = player.anchored ?? player.carried;
    if (anchor && anchors.has(anchor)) anchor = null;
    if (anchor) anchors.add(anchor);
    const start = PLAYER_STARTS[player.id];
    player.anchored = anchor;
    player.carried = anchor;
    player.discoveries = [];
    player.x = start.x;
    player.y = start.y;
    player.previousX = start.x;
    player.previousY = start.y;
    player.lastSafeX = start.x;
    player.lastSafeY = start.y;
    player.abilityCooldown = 0;
    player.abilityActive = 0;
    player.caughtTicks = 0;
    player.invulnerableTicks = SIM_HZ;
    player.portalCooldown = 0;
    player.noise = 0;
    player.disguised = anchor === "staff_badge";
    player.mounted = false;
    player.interactHeld = false;
    player.abilityHeld = false;
    player.sprinting = false;
  }
  state.loopNumber += 1;
  state.stats.loops += 1;
  state.scene = "heist";
  state.loopTick = 0;
  state.alarm = 0;
  state.alarmPeak = 0;
  state.modifier = LOOP_MODIFIERS[
    mixedSeed(state.seed ^ Math.imul(state.loopNumber, 0x45d9f3b)) % LOOP_MODIFIERS.length
  ];
  state.items = ITEM_SPAWNS.map((item) => ({
    ...item,
    active: !anchors.has(item.carryId),
  }));
  state.portals = makePortals(state.seed, state.loopNumber);
  if (anchors.has("portal_memory")) {
    state.portals.filter((portal) => portal.active).forEach((portal) => (portal.discovered = true));
  }
  state.guards = makeGuards(state.modifier === "GUARDS REMEMBER YOUR VIBE");
  if (anchors.has("guard_memory")) {
    const morrow = state.guards.find((guard) => guard.name === "Morrow");
    if (morrow) {
      morrow.mode = "persuaded";
      morrow.modeTicks = state.loopTicksTotal;
    }
  }
  state.cat = makeCat();
  state.dinosaur = makeDinosaur();
  state.mammoth = makeMammoth(state.modifier === "GIFT SHOP STAMPEDE");
  state.seals.forEach((seal) => (seal.disabled = false));
  state.artifact.stolen = false;
  state.artifact.carrierId = null;
  state.escape = null;
  state.discoveredThisLoop = [];
  state.timelineFlags = {};
  state.rewindHistory = [];
  state.messages = [];
  state.objective = "Break the three vault seals.";
  pushMessage(state, `LOOP ${state.loopNumber}`, state.modifier, "info", SIM_HZ * 6);
  return state;
}

export function getMuseumSecondsRemaining(state: GameState) {
  const simulatedTicks = Math.max(0, state.loopTicksTotal - state.loopTick);
  return Math.ceil((simulatedTicks / SIM_HZ) * state.clockRate);
}

export function formatMuseumTime(state: GameState): string {
  const seconds = getMuseumSecondsRemaining(state);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function getAbilityReady(player: PlayerState): boolean {
  return player.abilityCooldown <= 0 && player.caughtTicks <= 0;
}

export function getLoopProgress(state: GameState): number {
  return clamp(state.loopTick / Math.max(1, state.loopTicksTotal), 0, 1);
}

export function getAlarmLabel(state: GameState): string {
  if (state.alarm >= 80) return "TEMPORAL LOCKDOWN";
  if (state.alarm >= 55) return "FULL PURSUIT";
  if (state.alarm >= 25) return "SUSPICIOUSLY TUESDAY";
  return "MUSEUM CALM(ISH)";
}

export function getObjectiveProgress(state: GameState) {
  const seals = state.seals.filter((seal) => seal.disabled).length;
  return {
    label: state.objective,
    completed: state.scene === "victory" ? 4 : state.scene === "escape" ? state.escape?.stage ?? 0 : seals,
    total: state.scene === "escape" || state.scene === "victory" ? 4 : 3,
  };
}

export function getInteractionPrompt(state: GameState, playerId: number): string | null {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || player.caughtTicks > 0) return null;
  if (player.mounted) return "Dismount mammoth";
  if (!state.artifact.stolen && near(player, state.artifact, INTERACT_RADIUS)) {
    return state.seals.every((seal) => seal.disabled) ? "Steal the artifact" : "Vault seals are active";
  }
  const seal = state.seals.find((candidate) => !candidate.disabled && near(player, candidate, INTERACT_RADIUS));
  if (seal) return canBreakSeal(state, player, seal.id) ? `Break ${seal.label}` : `${seal.label} needs another trick`;
  if (state.items.some((item) => item.active && near(player, item, INTERACT_RADIUS))) {
    return player.carried ? "Swap carried thing" : "Pick up one thing";
  }
  if (state.portals.some((portal) => portal.active && near(player, portal, INTERACT_RADIUS))) return "Enter suspicious painting";
  if (near(player, state.mammoth, INTERACT_RADIUS + 18)) return "Ride woolly mammoth";
  if (near(player, state.cat, INTERACT_RADIUS + 12) && player.carried === "cat_treat") return "Distract psychic cat";
  return null;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(",")}}`;
}

export function checksumGame(state: GameState): string {
  const serialized = canonical(state);
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const stateChecksum = checksumGame;

export function getRoomAt(point: Vec2): string {
  const room = MUSEUM_ROOMS.find(
    (candidate) =>
      point.x >= candidate.x &&
      point.x <= candidate.x + candidate.w &&
      point.y >= candidate.y &&
      point.y <= candidate.y + candidate.h,
  );
  return room?.label ?? "BETWEEN EXHIBITS";
}
