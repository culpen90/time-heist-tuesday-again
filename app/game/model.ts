export const SIM_HZ = 60;
export const FICTION_LOOP_SECONDS = 12 * 60;
export const DEFAULT_CLOCK_RATE = 4;
export const DEFAULT_LOOP_TICKS =
  (FICTION_LOOP_SECONDS / DEFAULT_CLOCK_RATE) * SIM_HZ;
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;

export type SceneKind =
  | "heist"
  | "loop_summary"
  | "escape"
  | "victory";

export type RoleId = "glitch" | "talker" | "tinkerer" | "hamster";

export type CarryId =
  | "staff_badge"
  | "cat_treat"
  | "vault_phrase"
  | "portal_memory"
  | "guard_memory"
  | "mammoth_whistle"
  | "emp_coil";

export type ArtifactId =
  | "crown"
  | "tomorrow_egg"
  | "pocket_sun"
  | "moon_key"
  | "mona_alibi"
  | "bottled_bang";

export type IntelId =
  | "portal_pair"
  | "dinosaur_time"
  | "cat_weakness"
  | "vault_location"
  | "guard_routes"
  | "secret_passage";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: string;
}

export interface RoleDefinition {
  id: RoleId;
  name: string;
  callout: string;
  ability: string;
  description: string;
  color: string;
  dark: string;
  icon: string;
}

export interface CarryDefinition {
  id: CarryId;
  name: string;
  category: "ITEM" | "PASSWORD" | "MEMORY" | "DISGUISE";
  description: string;
  icon: string;
  color: string;
}

export interface ArtifactDefinition {
  id: ArtifactId;
  name: string;
  subtitle: string;
  hazard: string;
  color: string;
  glyph: string;
}

export interface PlayerInput {
  moveX: number;
  moveY: number;
  interact: boolean;
  ability: boolean;
  sprint: boolean;
}

export interface PlayerState {
  id: number;
  role: RoleId;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  directionX: number;
  directionY: number;
  lastSafeX: number;
  lastSafeY: number;
  carried: CarryId | null;
  anchored: CarryId | null;
  discoveries: CarryId[];
  abilityCooldown: number;
  abilityActive: number;
  caughtTicks: number;
  invulnerableTicks: number;
  portalCooldown: number;
  noise: number;
  disguised: boolean;
  mounted: boolean;
  interactHeld: boolean;
  abilityHeld: boolean;
  sprinting: boolean;
}

export type GuardMode =
  | "patrol"
  | "investigate"
  | "chase"
  | "stunned"
  | "persuaded";

export interface GuardState {
  id: number;
  name: string;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  directionX: number;
  directionY: number;
  route: Vec2[];
  routeIndex: number;
  mode: GuardMode;
  modeTicks: number;
  suspicion: number;
  targetPlayer: number | null;
  remembersCrew: boolean;
}

export interface WorldItemState {
  entityId: string;
  carryId: CarryId;
  x: number;
  y: number;
  active: boolean;
  room: string;
}

export interface PortalState {
  id: string;
  x: number;
  y: number;
  destinationId: string;
  active: boolean;
  discovered: boolean;
}

export interface CatState {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  route: Vec2[];
  routeIndex: number;
  distractedTicks: number;
  pulse: number;
}

export interface DinosaurState {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  awake: boolean;
  targetPlayer: number | null;
  chargeTicks: number;
}

export interface MammothState {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  active: boolean;
  riderId: number | null;
  directionX: number;
  directionY: number;
}

export interface SealState {
  id: "identity" | "chrono" | "psychic";
  label: string;
  x: number;
  y: number;
  disabled: boolean;
}

export interface ArtifactState {
  id: ArtifactId;
  x: number;
  y: number;
  stolen: boolean;
  carrierId: number | null;
}

export interface EscapeState {
  stage: number;
  ticksLeft: number;
  gateX: number;
  gateY: number;
  stageFlash: number;
}

export interface GameMessage {
  id: number;
  title: string;
  body: string;
  tone: "info" | "alarm" | "success" | "role";
  ticksLeft: number;
}

export interface RewindSnapshot {
  loopTick: number;
  alarm: number;
  players: Array<
    Pick<
      PlayerState,
      "x" | "y" | "carried" | "caughtTicks" | "mounted" | "disguised"
    >
  >;
  itemActive: boolean[];
  sealDisabled: boolean[];
  catDistractedTicks: number;
}

export interface GameStats {
  loops: number;
  detections: number;
  rewinds: number;
  guardsBaffled: number;
  exhibitsImprovised: number;
  portalsUsed: number;
  escapeTicks: number;
}

export interface GameState {
  scene: SceneKind;
  paused: boolean;
  seed: number;
  rng: number;
  tick: number;
  loopTick: number;
  loopTicksTotal: number;
  clockRate: number;
  loopNumber: number;
  alarm: number;
  alarmPeak: number;
  players: PlayerState[];
  guards: GuardState[];
  items: WorldItemState[];
  portals: PortalState[];
  cat: CatState;
  dinosaur: DinosaurState;
  mammoth: MammothState;
  seals: SealState[];
  artifact: ArtifactState;
  escape: EscapeState | null;
  intel: IntelId[];
  discoveredThisLoop: IntelId[];
  modifier: string;
  objective: string;
  messages: GameMessage[];
  messageCounter: number;
  timelineFlags: Record<string, boolean>;
  rewindHistory: RewindSnapshot[];
  stats: GameStats;
}

export interface GameConfig {
  roles: RoleId[];
  seed?: number;
  clockRate?: number;
}

export const EMPTY_INPUT: PlayerInput = {
  moveX: 0,
  moveY: 0,
  interact: false,
  ability: false,
  sprint: false,
};

export const ROLES: Record<RoleId, RoleDefinition> = {
  glitch: {
    id: "glitch",
    name: "The Glitch",
    callout: "Walls are a suggestion.",
    ability: "PHASE SHIFT",
    description: "Walk through walls and locked doors for two seconds.",
    color: "#49d6e9",
    dark: "#117783",
    icon: "G",
  },
  talker: {
    id: "talker",
    name: "The Talker",
    callout: "That badge? Conceptual.",
    ability: "ABSURD ALIBI",
    description: "Baffle nearby guards, calm suspicion, and charm the cat.",
    color: "#ff6b73",
    dark: "#9d3442",
    icon: "T",
  },
  tinkerer: {
    id: "tinkerer",
    name: "The Tinkerer",
    callout: "Every exhibit is a gadget.",
    ability: "IMPROVISED EMP",
    description: "Disable nearby guards, locks, and temporal machinery.",
    color: "#eab64d",
    dark: "#936719",
    icon: "K",
  },
  hamster: {
    id: "hamster",
    name: "Chrono Hamster",
    callout: "Small paws. Huge causality issues.",
    ability: "REWIND 5 SEC",
    description: "Rewind the crew, alarm, and loose items by five seconds.",
    color: "#64d98b",
    dark: "#267b47",
    icon: "H",
  },
};

export const CARRY_ITEMS: Record<CarryId, CarryDefinition> = {
  staff_badge: {
    id: "staff_badge",
    name: "Director's Badge",
    category: "DISGUISE",
    description: "Opens staff routes and satisfies the identity seal.",
    icon: "ID",
    color: "#ff6b73",
  },
  cat_treat: {
    id: "cat_treat",
    name: "Impossible Sardine",
    category: "ITEM",
    description: "Distracts the psychic security cat. It purrs in Latin.",
    icon: "<>",
    color: "#9b5de5",
  },
  vault_phrase: {
    id: "vault_phrase",
    name: "Pharaoh's Password",
    category: "PASSWORD",
    description: "The chrono lock accepts it, despite the hieroglyphic typo.",
    icon: "//",
    color: "#eab64d",
  },
  portal_memory: {
    id: "portal_memory",
    name: "Portal Coordinates",
    category: "MEMORY",
    description: "Reveals the two paintings that are having a doorway day.",
    icon: "OO",
    color: "#9b5de5",
  },
  guard_memory: {
    id: "guard_memory",
    name: "Guard Morrow's Memory",
    category: "MEMORY",
    description: "Morrow distinctly remembers approving your visit.",
    icon: "GM",
    color: "#49d6e9",
  },
  mammoth_whistle: {
    id: "mammoth_whistle",
    name: "Mammoth Whistle",
    category: "ITEM",
    description: "Turns the woolly mammoth from exhibit into transportation.",
    icon: "MW",
    color: "#f3ead7",
  },
  emp_coil: {
    id: "emp_coil",
    name: "Exhibit EMP Coil",
    category: "ITEM",
    description: "A permanent shortcut for temporarily disabling everything.",
    icon: "EMP",
    color: "#49d6e9",
  },
};

export const ARTIFACTS: Record<ArtifactId, ArtifactDefinition> = {
  crown: {
    id: "crown",
    name: "The Crown of Last Tuesday",
    subtitle: "Worn once. Technically worn forever.",
    hazard: "FREEZE PULSES",
    color: "#eab64d",
    glyph: "C",
  },
  tomorrow_egg: {
    id: "tomorrow_egg",
    name: "The Tomorrow Egg",
    subtitle: "It is already disappointed in you.",
    hazard: "TEMPORAL RAPTORS",
    color: "#64d98b",
    glyph: "O",
  },
  pocket_sun: {
    id: "pocket_sun",
    name: "The Pocket Sun",
    subtitle: "Museum policy says do not pocket the sun.",
    hazard: "HEAT BLACKOUTS",
    color: "#ff9f43",
    glyph: "*",
  },
  moon_key: {
    id: "moon_key",
    name: "The Moon's Spare Key",
    subtitle: "The moon has been looking everywhere.",
    hazard: "LOW GRAVITY",
    color: "#d9e5ff",
    glyph: "K",
  },
  mona_alibi: {
    id: "mona_alibi",
    name: "Mona Lisa's Alibi",
    subtitle: "She was smiling somewhere else entirely.",
    hazard: "LIVING PORTRAITS",
    color: "#ff6b73",
    glyph: "A",
  },
  bottled_bang: {
    id: "bottled_bang",
    name: "The Bottled Big Bang",
    subtitle: "Shake gently. Or, ideally, never.",
    hazard: "REALITY SHOCKWAVES",
    color: "#9b5de5",
    glyph: "!",
  },
};

export const MUSEUM_ROOMS = [
  { id: "fossils", label: "FOSSIL HALL", x: 40, y: 50, w: 470, h: 315, color: "#19383d" },
  { id: "gallery", label: "WEST GALLERY", x: 40, y: 390, w: 470, h: 285, color: "#332a48" },
  { id: "gift", label: "GIFT SHOP", x: 40, y: 700, w: 470, h: 160, color: "#4a2d3f" },
  { id: "vault", label: "ARTIFACT WING", x: 620, y: 45, w: 360, h: 210, color: "#40361f" },
  { id: "atrium", label: "GRAND ATRIUM", x: 535, y: 285, w: 530, h: 575, color: "#222947" },
  { id: "ancient", label: "ANCIENT COLLECTION", x: 1090, y: 50, w: 470, h: 315, color: "#493429" },
  { id: "future", label: "FUTURE THAT WAS", x: 1090, y: 390, w: 470, h: 285, color: "#162f4a" },
  { id: "staff", label: "STAFF ONLY(ISH)", x: 1090, y: 700, w: 470, h: 160, color: "#293247" },
] as const;

export const STATIC_OBSTACLES: Rect[] = [
  { x: 510, y: 50, w: 24, h: 245, kind: "wall" },
  { x: 510, y: 440, w: 24, h: 420, kind: "wall" },
  { x: 1066, y: 50, w: 24, h: 245, kind: "wall" },
  { x: 1066, y: 440, w: 24, h: 420, kind: "wall" },
  { x: 620, y: 45, w: 20, h: 210, kind: "vault-wall" },
  { x: 960, y: 45, w: 20, h: 210, kind: "vault-wall" },
  { x: 620, y: 45, w: 360, h: 20, kind: "vault-wall" },
  { x: 620, y: 235, w: 135, h: 20, kind: "vault-wall" },
  { x: 845, y: 235, w: 135, h: 20, kind: "vault-wall" },
  { x: 125, y: 115, w: 120, h: 50, kind: "exhibit" },
  { x: 310, y: 235, w: 130, h: 45, kind: "exhibit" },
  { x: 120, y: 475, w: 110, h: 46, kind: "exhibit" },
  { x: 310, y: 555, w: 115, h: 48, kind: "exhibit" },
  { x: 655, y: 410, w: 120, h: 58, kind: "exhibit" },
  { x: 825, y: 510, w: 125, h: 58, kind: "exhibit" },
  { x: 1160, y: 120, w: 115, h: 52, kind: "exhibit" },
  { x: 1340, y: 235, w: 130, h: 48, kind: "exhibit" },
  { x: 1160, y: 480, w: 110, h: 48, kind: "exhibit" },
  { x: 1345, y: 565, w: 120, h: 48, kind: "exhibit" },
];

export const PAINTING_SPOTS = [
  { id: "violet", x: 565, y: 180 },
  { id: "coral", x: 565, y: 560 },
  { id: "cyan", x: 1035, y: 180 },
  { id: "gold", x: 1035, y: 560 },
] as const;

export const ITEM_SPAWNS: Array<{
  entityId: string;
  carryId: CarryId;
  x: number;
  y: number;
  room: string;
}> = [
  { entityId: "badge-desk", carryId: "staff_badge", x: 1320, y: 780, room: "Staff Wing" },
  { entityId: "cat-fish", carryId: "cat_treat", x: 180, y: 775, room: "Gift Shop" },
  { entityId: "pharaoh-console", carryId: "vault_phrase", x: 1295, y: 205, room: "Ancient Collection" },
  { entityId: "portal-sketch", carryId: "portal_memory", x: 250, y: 430, room: "West Gallery" },
  { entityId: "morrow-locker", carryId: "guard_memory", x: 1450, y: 785, room: "Staff Wing" },
  { entityId: "mammoth-whistle", carryId: "mammoth_whistle", x: 410, y: 100, room: "Fossil Hall" },
  { entityId: "future-coil", carryId: "emp_coil", x: 1420, y: 445, room: "Future That Was" },
];

export const PLAYER_STARTS: Vec2[] = [
  { x: 745, y: 795 },
  { x: 785, y: 795 },
  { x: 825, y: 795 },
  { x: 865, y: 795 },
];

export const GUARD_ROUTES: Array<{ name: string; route: Vec2[] }> = [
  {
    name: "Morrow",
    route: [
      { x: 620, y: 340 },
      { x: 975, y: 340 },
      { x: 975, y: 640 },
      { x: 620, y: 640 },
    ],
  },
  {
    name: "Tuesday",
    route: [
      { x: 95, y: 325 },
      { x: 455, y: 325 },
      { x: 455, y: 650 },
      { x: 90, y: 650 },
    ],
  },
  {
    name: "Aster",
    route: [
      { x: 1140, y: 325 },
      { x: 1510, y: 325 },
      { x: 1510, y: 650 },
      { x: 1140, y: 650 },
    ],
  },
  {
    name: "Temp",
    route: [
      { x: 680, y: 285 },
      { x: 925, y: 285 },
      { x: 800, y: 430 },
    ],
  },
];

export const ESCAPE_STAGES = [
  { name: "CRETACEOUS — 66 MILLION YEARS EARLY", x: 160, y: 170, color: "#64d98b" },
  { name: "MEDIEVAL — ARMOUR HAS UNIONIZED", x: 1430, y: 170, color: "#eab64d" },
  { name: "NEON FUTURE — TUESDAY PREMIUM", x: 1420, y: 760, color: "#49d6e9" },
  { name: "THE GIFT SHOP — GETAWAY CLOCK", x: 250, y: 780, color: "#ff6b73" },
] as const;

export const LOOP_MODIFIERS = [
  "BASELINE TUESDAY",
  "THE DINOSAUR IS EARLY",
  "GIFT SHOP STAMPEDE",
  "GUARDS REMEMBER YOUR VIBE",
  "EVERY PAINTING FEELS DOOR-SHAPED",
] as const;

export const CONTROL_SCHEMES = [
  { move: "WASD", interact: "E", ability: "Q", sprint: "SHIFT" },
  { move: "ARROWS", interact: "ENTER", ability: "/", sprint: "." },
  { move: "IJKL", interact: "O", ability: "U", sprint: "P" },
  { move: "8456", interact: "0", ability: "1", sprint: "2" },
] as const;
