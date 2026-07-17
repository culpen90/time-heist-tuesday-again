import {
  ARTIFACTS,
  CARRY_ITEMS,
  ESCAPE_STAGES,
  MUSEUM_ROOMS,
  PAINTING_SPOTS,
  ROLES,
  STATIC_OBSTACLES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type ArtifactId,
  type CarryId,
  type GameState,
  type GuardMode,
  type PlayerState,
  type Rect,
  type RoleId,
} from "./model";

const INK = "#11152b";
const IVORY = "#f3ead7";
const BRASS = "#eab64d";
const CYAN = "#49d6e9";
const CORAL = "#ff6b73";
const VIOLET = "#9b5de5";
const MINT = "#64d98b";
const UI_FONT = '"Avenir Next", "Trebuchet MS", sans-serif';
const DISPLAY_FONT = '"Arial Black", "Avenir Next", sans-serif';
const MONO_FONT = 'ui-monospace, "SFMono-Regular", Consolas, monospace';

type MuseumRoom = (typeof MUSEUM_ROOMS)[number];
type EscapeStage = (typeof ESCAPE_STAGES)[number];

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function hash01(seed: number): number {
  const value = Math.sin(seed * 91.3458 + 17.317) * 43758.5453;
  return value - Math.floor(value);
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillStroke(
  ctx: CanvasRenderingContext2D,
  fill: string,
  stroke = INK,
  lineWidth = 3,
): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  family = UI_FONT,
  weight = 700,
): void {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function beginWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background = "#090d1e",
): number {
  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const scale = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  const offsetX = (width - WORLD_WIDTH * scale) / 2;
  const offsetY = (height - WORLD_HEIGHT * scale) / 2;
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  return scale;
}

function endWorld(ctx: CanvasRenderingContext2D): void {
  ctx.restore();
}

function drawRoomPattern(
  ctx: CanvasRenderingContext2D,
  room: MuseumRoom,
  time: number,
  reducedMotion: boolean,
): void {
  const { id, x, y, w, h } = room;
  ctx.save();
  roundedRect(ctx, x + 5, y + 5, w - 10, h - 10, 13);
  ctx.clip();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = IVORY;
  ctx.fillStyle = IVORY;
  ctx.lineWidth = 2;

  if (id === "fossils") {
    for (let px = x + 55; px < x + w; px += 92) {
      ctx.beginPath();
      ctx.arc(px, y + h * 0.55, 46, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, y + h * 0.55 - 45);
      ctx.lineTo(px, y + h * 0.55 + 25);
      ctx.stroke();
    }
  } else if (id === "gallery") {
    for (let py = y - 30; py < y + h + 40; py += 42) {
      for (let px = x - 30; px < x + w + 40; px += 42) {
        const offset = Math.floor((py - y) / 42) % 2 === 0 ? 0 : 21;
        ctx.save();
        ctx.translate(px + offset, py);
        ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.restore();
      }
    }
  } else if (id === "gift") {
    ctx.lineWidth = 13;
    for (let px = x - h; px < x + w + h; px += 44) {
      ctx.beginPath();
      ctx.moveTo(px, y + h);
      ctx.lineTo(px + h, y);
      ctx.stroke();
    }
  } else if (id === "vault") {
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    for (let radius = 34; radius < 190; radius += 30) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle) * 190, centerY + Math.sin(angle) * 190);
      ctx.stroke();
    }
  } else if (id === "atrium") {
    for (let index = 0; index < 90; index += 1) {
      const px = x + 16 + hash01(index * 2 + 5) * (w - 32);
      const py = y + 16 + hash01(index * 2 + 6) * (h - 32);
      const radius = 1.5 + hash01(index + 99) * 3;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 84, y + 96, w - 168, h - 192);
  } else if (id === "ancient") {
    for (let py = y + 38; py < y + h; py += 40) {
      for (let px = x; px < x + w; px += 40) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + 20, py - 14);
        ctx.lineTo(px + 40, py);
        ctx.stroke();
      }
    }
  } else if (id === "future") {
    const drift = reducedMotion ? 0 : (time * 7) % 36;
    for (let px = x + drift; px < x + w; px += 36) {
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + h);
      ctx.stroke();
    }
    for (let py = y + drift; py < y + h; py += 36) {
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x + w, py);
      ctx.stroke();
    }
  } else if (id === "staff") {
    ctx.setLineDash([10, 13]);
    for (let py = y + 35; py < y + h; py += 38) {
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x + w, py);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawMuseumBase(
  ctx: CanvasRenderingContext2D,
  time: number,
  reducedMotion: boolean,
  dimmed = false,
): void {
  const base = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  base.addColorStop(0, "#0d1329");
  base.addColorStop(1, "#10172d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.save();
  ctx.globalAlpha = dimmed ? 0.55 : 1;
  for (const room of MUSEUM_ROOMS) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.42)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 7;
    roundedRect(ctx, room.x, room.y, room.w, room.h, 16);
    fillStroke(ctx, room.color, "#0b1024", 5);
    ctx.restore();

    drawRoomPattern(ctx, room, time, reducedMotion);

    ctx.save();
    ctx.globalAlpha = 0.58;
    roundedRect(ctx, room.x + 13, room.y + 13, room.w - 26, room.h - 26, 10);
    ctx.strokeStyle = room.id === "vault" ? BRASS : "rgba(243,234,215,.32)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    roundedRect(ctx, room.x + 23, room.y + 18, Math.min(room.w - 46, room.label.length * 8.3 + 32), 28, 7);
    ctx.fillStyle = "rgba(11,16,36,.78)";
    ctx.fill();
    label(ctx, room.label, room.x + 38, room.y + 33, 12, IVORY, "left", DISPLAY_FONT, 800);
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(234,182,77,.32)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 10]);
  ctx.strokeRect(18, 24, WORLD_WIDTH - 36, WORLD_HEIGHT - 48);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawRouteIntel(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (!state.intel.includes("guard_routes")) return;
  ctx.save();
  ctx.strokeStyle = "rgba(73,214,233,.34)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  for (const guard of state.guards) {
    if (guard.route.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(guard.route[0].x, guard.route[0].y);
    for (let index = 1; index < guard.route.length; index += 1) {
      ctx.lineTo(guard.route[index].x, guard.route[index].y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function normalizedAlarm(alarm: number): number {
  return clamp(alarm > 1 ? alarm / 100 : alarm);
}

function drawVisionCone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  mode: GuardMode,
  suspicion: number,
): void {
  if (mode === "stunned" || mode === "persuaded") return;
  const length = mode === "chase" ? 250 : mode === "investigate" ? 215 : 175;
  const halfAngle = mode === "chase" ? 0.49 : 0.39;
  const angle = Math.atan2(directionY || 0.001, directionX || 1);
  const normalizedSuspicion = clamp(suspicion > 1 ? suspicion / 100 : suspicion);
  const cone = ctx.createRadialGradient(x, y, 4, x, y, length);
  cone.addColorStop(0, mode === "chase" ? "rgba(255,107,115,.34)" : "rgba(234,182,77,.24)");
  cone.addColorStop(0.75, mode === "chase" ? "rgba(255,107,115,.18)" : "rgba(234,182,77,.11)");
  cone.addColorStop(1, "rgba(234,182,77,0)");
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, length, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = cone;
  ctx.fill();
  ctx.strokeStyle = mode === "chase" ? `rgba(255,107,115,${0.26 + normalizedSuspicion * 0.34})` : "rgba(234,182,77,.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawWall(ctx: CanvasRenderingContext2D, rect: Rect): void {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.48)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 5;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(7, rect.w / 3, rect.h / 3));
  fillStroke(ctx, rect.kind === "vault-wall" ? "#2c291f" : "#202844", INK, 3);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = rect.kind === "vault-wall" ? "rgba(234,182,77,.64)" : "rgba(243,234,215,.24)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rect.x + 4, rect.y + 4);
  ctx.lineTo(rect.x + rect.w - 4, rect.y + 4);
  ctx.stroke();
  ctx.restore();
}

function drawPlinth(ctx: CanvasRenderingContext2D, rect: Rect): void {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.42)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 5;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 11);
  fillStroke(ctx, "#d8ccb6", INK, 3);
  ctx.restore();
  roundedRect(ctx, rect.x + 7, rect.y + 6, rect.w - 14, rect.h - 16, 7);
  ctx.fillStyle = "#29304d";
  ctx.fill();
  ctx.strokeStyle = "rgba(243,234,215,.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = BRASS;
  ctx.fillRect(rect.x + rect.w / 2 - 17, rect.y + rect.h - 8, 34, 5);
}

function drawFossilExhibit(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2 - 3;
  ctx.save();
  ctx.strokeStyle = IVORY;
  ctx.fillStyle = IVORY;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(centerX - 43, centerY);
  ctx.quadraticCurveTo(centerX, centerY - 17, centerX + 36, centerY + 2);
  ctx.stroke();
  for (let index = -3; index <= 3; index += 1) {
    const px = centerX + index * 11;
    ctx.beginPath();
    ctx.moveTo(px, centerY - 5);
    ctx.lineTo(px - 5, centerY + 11 + Math.abs(index) * 1.4);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(centerX + 40, centerY - 2, 10, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(centerX + 43, centerY - 4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGalleryExhibit(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  ctx.save();
  ctx.translate(centerX, centerY - 3);
  ctx.rotate(-0.18);
  ctx.beginPath();
  ctx.moveTo(-28, 10);
  ctx.bezierCurveTo(-19, -19, -4, -19, 0, -4);
  ctx.bezierCurveTo(10, -25, 28, -14, 22, 10);
  ctx.closePath();
  fillStroke(ctx, VIOLET, INK, 3);
  ctx.beginPath();
  ctx.arc(-10, -7, 4, 0, Math.PI * 2);
  ctx.arc(12, -11, 4, 0, Math.PI * 2);
  ctx.fillStyle = CORAL;
  ctx.fill();
  ctx.restore();
}

function drawAtriumExhibit(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2 - 2;
  ctx.save();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 4;
  for (let radius = 9; radius <= 25; radius += 8) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI * 0.2, Math.PI * 1.45);
    ctx.stroke();
  }
  ctx.fillStyle = BRASS;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = IVORY;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + 3, centerY - 17);
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + 12, centerY + 7);
  ctx.stroke();
  ctx.restore();
}

function drawAncientExhibit(ctx: CanvasRenderingContext2D, rect: Rect): void {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  ctx.save();
  roundedRect(ctx, centerX - 29, centerY - 16, 58, 32, 13);
  fillStroke(ctx, "#b77945", INK, 3);
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX - 18, centerY - 9);
  ctx.lineTo(centerX + 18, centerY + 9);
  ctx.moveTo(centerX + 18, centerY - 9);
  ctx.lineTo(centerX - 18, centerY + 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY - 4, 5, 0, Math.PI * 2);
  ctx.fillStyle = IVORY;
  ctx.fill();
  ctx.restore();
}

function drawFutureExhibit(ctx: CanvasRenderingContext2D, rect: Rect, time: number): void {
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  ctx.save();
  roundedRect(ctx, centerX - 27, centerY - 16, 54, 32, 12);
  fillStroke(ctx, "#152035", INK, 3);
  ctx.fillStyle = CYAN;
  ctx.beginPath();
  ctx.arc(centerX - 11, centerY - 2, 4, 0, Math.PI * 2);
  ctx.arc(centerX + 11, centerY - 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = VIOLET;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 22 + Math.sin(time * 2.4) * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawExhibit(ctx: CanvasRenderingContext2D, rect: Rect, time: number): void {
  drawPlinth(ctx, rect);
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  if (centerX < 510 && centerY < 365) {
    drawFossilExhibit(ctx, rect);
  } else if (centerX < 510 && centerY < 690) {
    drawGalleryExhibit(ctx, rect);
  } else if (centerX > 1090 && centerY < 365) {
    drawAncientExhibit(ctx, rect);
  } else if (centerX > 1090 && centerY < 690) {
    drawFutureExhibit(ctx, rect, time);
  } else {
    drawAtriumExhibit(ctx, rect);
  }
}

function drawObstacles(ctx: CanvasRenderingContext2D, time: number): void {
  for (const obstacle of STATIC_OBSTACLES) {
    if (obstacle.kind === "wall" || obstacle.kind === "vault-wall") {
      drawWall(ctx, obstacle);
    } else {
      drawExhibit(ctx, obstacle, time);
    }
  }

  // Door thresholds make the traversable gaps read instantly.
  const doors = [
    { x: 506, y: 295, w: 32, h: 145 },
    { x: 1062, y: 295, w: 32, h: 145 },
    { x: 755, y: 231, w: 90, h: 28 },
  ];
  ctx.save();
  for (const door of doors) {
    ctx.fillStyle = "rgba(234,182,77,.28)";
    ctx.fillRect(door.x, door.y, door.w, door.h);
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.strokeRect(door.x + 3, door.y + 3, door.w - 6, door.h - 6);
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function portalColor(id: string, index: number): string {
  const lower = id.toLowerCase();
  if (lower.includes("coral")) return CORAL;
  if (lower.includes("cyan")) return CYAN;
  if (lower.includes("gold")) return BRASS;
  if (lower.includes("violet")) return VIOLET;
  return [VIOLET, CORAL, CYAN, BRASS][index % 4];
}

function drawPortalPainting(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  active: boolean,
  discovered: boolean,
  time: number,
  reducedMotion: boolean,
): void {
  const wave = reducedMotion ? 0 : Math.sin(time * 3.2 + x * 0.013) * 2.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = active ? color : "transparent";
  ctx.shadowBlur = active ? 18 : 0;
  roundedRect(ctx, -25, -41, 50, 82, 5);
  fillStroke(ctx, BRASS, INK, 4);
  roundedRect(ctx, -18, -34, 36, 68, 3);
  ctx.fillStyle = active ? "#17112b" : "#25283a";
  ctx.fill();
  ctx.clip();

  const interior = ctx.createLinearGradient(0, -34, 0, 34);
  interior.addColorStop(0, active ? color : "#3a3c4b");
  interior.addColorStop(0.52, "#15162e");
  interior.addColorStop(1, active ? "#f3ead7" : "#222637");
  ctx.globalAlpha = active ? 0.88 : 0.52;
  ctx.fillStyle = interior;
  ctx.fillRect(-18, -34, 36, 68);

  ctx.strokeStyle = active ? IVORY : "#6a6b75";
  ctx.lineWidth = 2;
  for (let row = -26; row <= 29; row += 11) {
    ctx.beginPath();
    ctx.moveTo(-22, row);
    for (let px = -18; px <= 22; px += 4) {
      const py = row + Math.sin(px * 0.25 + time * (active ? 3 : 0) + row) * (2 + wave * 0.25);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();

  if (discovered) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 24, y - 39, 7, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, "✓", x + 24, y - 39, 9, INK, "center", DISPLAY_FONT, 900);
    ctx.restore();
  }
}

function drawPortals(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number,
  reducedMotion: boolean,
): void {
  if (state.portals.length > 0) {
    state.portals.forEach((portal, index) => {
      drawPortalPainting(
        ctx,
        portal.x,
        portal.y,
        portalColor(portal.id, index),
        portal.active,
        portal.discovered,
        time,
        reducedMotion,
      );
    });
    return;
  }
  PAINTING_SPOTS.forEach((spot, index) => {
    drawPortalPainting(ctx, spot.x, spot.y, portalColor(spot.id, index), false, false, time, reducedMotion);
  });
}

function drawSeal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: "identity" | "chrono" | "psychic",
  disabled: boolean,
  time: number,
): void {
  const color = disabled ? MINT : id === "psychic" ? VIOLET : id === "chrono" ? BRASS : CORAL;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = disabled ? 5 : 14;
  ctx.beginPath();
  for (let point = 0; point < 8; point += 1) {
    const angle = -Math.PI / 2 + (point / 8) * Math.PI * 2;
    const px = Math.cos(angle) * 18;
    const py = Math.sin(angle) * 18;
    if (point === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  fillStroke(ctx, disabled ? "#243d35" : "#242238", color, 3);
  const glyph = disabled ? "✓" : id === "identity" ? "ID" : id === "chrono" ? "12" : "Ψ";
  label(ctx, glyph, 0, 1, id === "identity" ? 9 : 12, color, "center", MONO_FONT, 900);
  if (!disabled) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.38;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(time * 3 + x) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawArtifactShape(
  ctx: CanvasRenderingContext2D,
  id: ArtifactId,
  x: number,
  y: number,
  scale: number,
  time: number,
): void {
  const definition = ARTIFACTS[id];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = definition.color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = definition.color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3 / scale;

  if (id === "crown") {
    ctx.beginPath();
    ctx.moveTo(-19, 13);
    ctx.lineTo(-22, -10);
    ctx.lineTo(-8, 1);
    ctx.lineTo(0, -17);
    ctx.lineTo(9, 1);
    ctx.lineTo(22, -10);
    ctx.lineTo(18, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (id === "tomorrow_egg") {
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = IVORY;
    ctx.beginPath();
    ctx.arc(-3, 2, 7, -1.3, 1.4);
    ctx.stroke();
  } else if (id === "pocket_sun") {
    for (let ray = 0; ray < 10; ray += 1) {
      const angle = (ray / 10) * Math.PI * 2 + time * 0.12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
      ctx.lineTo(Math.cos(angle) * 27, Math.sin(angle) * 27);
      ctx.strokeStyle = definition.color;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else if (id === "moon_key") {
    ctx.strokeStyle = definition.color;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-8, -6, 9, 0, Math.PI * 2);
    ctx.moveTo(-1, 0);
    ctx.lineTo(17, 18);
    ctx.moveTo(10, 11);
    ctx.lineTo(18, 4);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (id === "mona_alibi") {
    roundedRect(ctx, -17, -22, 34, 44, 2);
    fillStroke(ctx, BRASS, INK, 3);
    ctx.beginPath();
    ctx.ellipse(0, -4, 8, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = CORAL;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-11, 18);
    ctx.quadraticCurveTo(0, 5, 11, 18);
    ctx.closePath();
    ctx.fill();
  } else {
    roundedRect(ctx, -12, -21, 24, 42, 8);
    fillStroke(ctx, "rgba(155,93,229,.72)", INK, 3);
    ctx.beginPath();
    ctx.moveTo(-7, -22);
    ctx.lineTo(7, -22);
    ctx.lineTo(6, -29);
    ctx.lineTo(-6, -29);
    ctx.closePath();
    fillStroke(ctx, BRASS, INK, 2);
    label(ctx, "!", 0, 2, 18, IVORY, "center", DISPLAY_FONT, 900);
  }
  ctx.restore();
}

function drawVault(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const artifactX = state.artifact.x;
  const artifactY = state.artifact.y;

  ctx.save();
  ctx.globalAlpha = 0.38;
  for (const seal of state.seals) {
    if (seal.disabled || state.artifact.stolen) continue;
    ctx.strokeStyle = seal.id === "psychic" ? VIOLET : seal.id === "chrono" ? BRASS : CORAL;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(seal.x, seal.y);
    ctx.lineTo(artifactX, artifactY);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.translate(artifactX, artifactY);
  ctx.fillStyle = "rgba(17,21,43,.74)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 49, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 5, 37, 17, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  for (const seal of state.seals) {
    drawSeal(ctx, seal.x, seal.y, seal.id, seal.disabled, time);
  }

  if (!state.artifact.stolen) {
    const bob = Math.sin(time * 2.2) * 4;
    drawArtifactShape(ctx, state.artifact.id, artifactX, artifactY - 18 + bob, 1, time);
    const definition = ARTIFACTS[state.artifact.id];
    roundedRect(ctx, artifactX - 73, artifactY + 32, 146, 22, 6);
    ctx.fillStyle = "rgba(11,16,36,.9)";
    ctx.fill();
    label(ctx, definition.name.toUpperCase(), artifactX, artifactY + 43, 9, definition.color, "center", DISPLAY_FONT, 800);
  }

  // Heavy sliding vault door above the atrium entrance.
  ctx.save();
  ctx.fillStyle = "#24283a";
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 3;
  roundedRect(ctx, 760, 230, 80, 17, 5);
  ctx.fill();
  ctx.stroke();
  for (let index = 0; index < 5; index += 1) {
    ctx.fillStyle = index < state.seals.filter((seal) => seal.disabled).length ? MINT : CORAL;
    ctx.beginPath();
    ctx.arc(779 + index * 11, 238, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawItemIcon(
  ctx: CanvasRenderingContext2D,
  carryId: CarryId,
  x: number,
  y: number,
  scale = 1,
): void {
  const item = CARRY_ITEMS[carryId];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = INK;
  ctx.fillStyle = item.color;
  ctx.lineWidth = 2.5 / scale;
  if (carryId === "staff_badge") {
    roundedRect(ctx, -9, -12, 18, 24, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = IVORY;
    ctx.fillRect(-5, 3, 10, 2);
    ctx.beginPath();
    ctx.arc(0, -4, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (carryId === "cat_treat") {
    ctx.beginPath();
    ctx.ellipse(-2, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.moveTo(7, 0);
    ctx.lineTo(15, -7);
    ctx.lineTo(15, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (carryId === "vault_phrase") {
    roundedRect(ctx, -11, -10, 22, 20, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, -4);
    ctx.moveTo(-6, 1);
    ctx.lineTo(3, 1);
    ctx.moveTo(-6, 6);
    ctx.lineTo(6, 6);
    ctx.stroke();
  } else if (carryId === "portal_memory") {
    ctx.beginPath();
    ctx.arc(-6, 0, 8, 0, Math.PI * 2);
    ctx.arc(6, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (carryId === "guard_memory") {
    ctx.beginPath();
    ctx.arc(-4, 0, 7, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(4, 0, 7, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
  } else if (carryId === "mammoth_whistle") {
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.quadraticCurveTo(5, -9, 12, 2);
    ctx.lineTo(8, 8);
    ctx.quadraticCurveTo(0, 1, -12, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 1.7);
    ctx.stroke();
    ctx.fillStyle = IVORY;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawItems(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number,
  reducedMotion: boolean,
): void {
  for (const worldItem of state.items) {
    if (!worldItem.active) continue;
    const item = CARRY_ITEMS[worldItem.carryId];
    const bob = reducedMotion ? 0 : Math.sin(time * 3.1 + worldItem.x) * 3;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.ellipse(worldItem.x, worldItem.y + 10, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = item.color;
    ctx.globalAlpha = 0.52;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(worldItem.x, worldItem.y + bob, 20 + Math.sin(time * 2.5) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawItemIcon(ctx, worldItem.carryId, worldItem.x, worldItem.y - 2 + bob, 0.9);
  }
}

function drawGuardFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  mode: GuardMode,
  name: string,
  suspicion: number,
  remembersCrew: boolean,
  time: number,
): void {
  const angle = Math.atan2(directionY || 0.001, directionX || 1);
  const modeColor = mode === "chase" ? CORAL : mode === "stunned" ? CYAN : mode === "persuaded" ? MINT : BRASS;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(5,8,20,.5)";
  ctx.beginPath();
  ctx.ellipse(0, 13, 17, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(angle + Math.PI / 2);
  roundedRect(ctx, -11, -13, 22, 30, 9);
  fillStroke(ctx, mode === "persuaded" ? "#275445" : "#303a5a", INK, 3);
  ctx.beginPath();
  ctx.arc(0, -15, 9, 0, Math.PI * 2);
  fillStroke(ctx, "#d6a77c", INK, 2.5);
  ctx.fillStyle = modeColor;
  ctx.fillRect(-12, -23, 24, 5);
  ctx.fillStyle = IVORY;
  ctx.fillRect(-3, -9, 6, 12);
  ctx.fillStyle = modeColor;
  ctx.beginPath();
  ctx.moveTo(-3, -8);
  ctx.lineTo(3, -8);
  ctx.lineTo(0, 1);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(-(angle + Math.PI / 2));

  if (remembersCrew) {
    label(ctx, "!", 15, -23, 12, CORAL, "center", DISPLAY_FONT, 900);
  }
  if (mode === "stunned") {
    label(ctx, "✦", -13, -28 + Math.sin(time * 4) * 2, 12, CYAN, "center", DISPLAY_FONT, 900);
    label(ctx, "✦", 12, -32 - Math.sin(time * 4) * 2, 9, CYAN, "center", DISPLAY_FONT, 900);
  } else if (mode === "persuaded") {
    roundedRect(ctx, 11, -38, 27, 18, 8);
    ctx.fillStyle = MINT;
    ctx.fill();
    label(ctx, "OK", 24.5, -29, 8, INK, "center", DISPLAY_FONT, 900);
  }

  const normalizedSuspicion = clamp(suspicion > 1 ? suspicion / 100 : suspicion);
  if (normalizedSuspicion > 0.05) {
    ctx.strokeStyle = modeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -16, 15, -Math.PI * 0.9, -Math.PI * 0.9 + normalizedSuspicion * Math.PI * 1.8);
    ctx.stroke();
  }
  label(ctx, name.toUpperCase(), 0, 30, 8, "rgba(243,234,215,.78)", "center", DISPLAY_FONT, 800);
  ctx.restore();
}

function drawPlayerSilhouette(
  ctx: CanvasRenderingContext2D,
  role: RoleId,
  id: number,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  abilityActive: boolean,
  disguised: boolean,
  mounted: boolean,
  caught: boolean,
  invulnerable: boolean,
  time: number,
  opacity = 1,
): void {
  const definition = ROLES[role];
  const angle = Math.atan2(directionY || 0.001, directionX || 1);
  const moving = Math.abs(directionX) + Math.abs(directionY) > 0.08;
  const bob = moving ? Math.sin(time * 11 + id) * 1.8 : Math.sin(time * 2 + id) * 0.5;
  const scale = role === "hamster" ? 0.86 : 1;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y + bob);

  if (role === "glitch" && abilityActive) {
    ctx.globalAlpha = opacity * 0.28;
    ctx.fillStyle = CORAL;
    roundedRect(ctx, -19, -16, 23, 32, 8);
    ctx.fill();
    ctx.fillStyle = CYAN;
    roundedRect(ctx, -4, -18, 23, 32, 8);
    ctx.fill();
    ctx.globalAlpha = opacity;
  }

  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(5,8,20,.55)";
  ctx.beginPath();
  ctx.ellipse(0, 14, role === "hamster" ? 17 : 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (role === "hamster") {
    ctx.strokeStyle = abilityActive ? MINT : "rgba(243,234,215,.72)";
    ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(100,217,139,.12)";
    ctx.beginPath();
    ctx.arc(0, -1, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-8, -12, 7, 0, Math.PI * 2);
    ctx.arc(8, -12, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#d9a66f";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -2, 16, 14, 0, 0, Math.PI * 2);
    fillStroke(ctx, "#d9a66f", INK, 3);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-5, -5, 2, 0, Math.PI * 2);
    ctx.arc(5, -5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.arc(0, 1, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = MINT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(0, 13);
    ctx.moveTo(-4, 10);
    ctx.lineTo(4, 10);
    ctx.stroke();
  } else {
    ctx.save();
    ctx.rotate(angle + Math.PI / 2);
    roundedRect(ctx, -12, -13, 24, 31, 9);
    fillStroke(ctx, disguised ? "#6c7080" : definition.color, INK, 3);
    ctx.beginPath();
    ctx.arc(0, -16, 9, 0, Math.PI * 2);
    fillStroke(ctx, "#d6a77c", INK, 2.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.lineTo(-11, 21);
    ctx.moveTo(8, 12);
    ctx.lineTo(11, 21);
    ctx.stroke();
    ctx.fillStyle = IVORY;
    ctx.beginPath();
    ctx.moveTo(-4, -9);
    ctx.lineTo(0, 0);
    ctx.lineTo(4, -9);
    ctx.closePath();
    ctx.fill();

    if (role === "talker") {
      ctx.strokeStyle = CORAL;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, -7);
      ctx.lineTo(-2, 1);
      ctx.moveTo(10, -7);
      ctx.lineTo(2, 1);
      ctx.stroke();
      if (abilityActive) {
        ctx.strokeStyle = IVORY;
        ctx.lineWidth = 2;
        for (let index = 0; index < 3; index += 1) {
          ctx.beginPath();
          ctx.arc(0, -27, 12 + index * 7, -2.65, -0.5);
          ctx.stroke();
        }
      }
    } else if (role === "tinkerer") {
      roundedRect(ctx, -16, -7, 8, 19, 3);
      fillStroke(ctx, BRASS, INK, 2);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.lineTo(-17, -18);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-18, -20, 3, 0, Math.PI * 2);
      ctx.fillStyle = abilityActive ? CYAN : BRASS;
      ctx.fill();
    } else if (role === "glitch") {
      ctx.fillStyle = CYAN;
      ctx.fillRect(-15, -4, 8, 4);
      ctx.fillRect(8, 5, 9, 4);
      ctx.fillStyle = CORAL;
      ctx.fillRect(-16, 6, 6, 3);
    }
    ctx.restore();
  }

  if (disguised) {
    roundedRect(ctx, 10, -20, 16, 13, 3);
    ctx.fillStyle = CORAL;
    ctx.fill();
    label(ctx, "ID", 18, -13.5, 7, IVORY, "center", MONO_FONT, 900);
  }
  if (mounted) {
    label(ctx, "RIDE", 0, -36, 8, BRASS, "center", DISPLAY_FONT, 900);
  }
  if (caught) {
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-5, 3, 5, 0, Math.PI * 2);
    ctx.arc(5, 3, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (invulnerable) {
    ctx.strokeStyle = CYAN;
    ctx.globalAlpha = opacity * 0.66;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -1, 26 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = opacity;
  ctx.fillStyle = definition.color;
  ctx.beginPath();
  ctx.arc(-16, -24, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  label(ctx, String(id + 1), -16, -23.5, 9, INK, "center", DISPLAY_FONT, 900);
  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  alpha: number,
  time: number,
): void {
  drawPlayerSilhouette(
    ctx,
    player.role,
    player.id,
    lerp(player.previousX, player.x, alpha),
    lerp(player.previousY, player.y, alpha),
    player.directionX,
    player.directionY,
    player.abilityActive > 0,
    player.disguised,
    player.mounted,
    player.caughtTicks > 0,
    player.invulnerableTicks > 0,
    time,
  );
}

function drawCat(
  ctx: CanvasRenderingContext2D,
  state: Pick<GameState, "cat">,
  alpha: number,
  time: number,
  reducedMotion: boolean,
): void {
  const x = lerp(state.cat.previousX, state.cat.x, alpha);
  const y = lerp(state.cat.previousY, state.cat.y, alpha);
  const distracted = state.cat.distractedTicks > 0;
  const pulse = reducedMotion ? 0 : Math.sin(time * 3.4 + state.cat.pulse) * 4;
  ctx.save();
  ctx.translate(x, y);
  if (!distracted) {
    ctx.strokeStyle = "rgba(155,93,229,.42)";
    ctx.lineWidth = 2;
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, 23 + ring * 11 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(5,8,20,.5)";
  ctx.beginPath();
  ctx.ellipse(0, 11, 19, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-16, 9);
  ctx.lineTo(0, -15);
  ctx.lineTo(17, 9);
  ctx.closePath();
  fillStroke(ctx, "#151424", VIOLET, 3);
  ctx.beginPath();
  ctx.moveTo(-10, -7);
  ctx.lineTo(-13, -19);
  ctx.lineTo(-2, -11);
  ctx.moveTo(10, -7);
  ctx.lineTo(13, -19);
  ctx.lineTo(2, -11);
  ctx.fillStyle = "#151424";
  ctx.fill();
  ctx.strokeStyle = VIOLET;
  ctx.stroke();
  ctx.strokeStyle = "#151424";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(14, 5);
  ctx.quadraticCurveTo(31, -3, 23, -17);
  ctx.stroke();
  ctx.fillStyle = distracted ? MINT : VIOLET;
  ctx.beginPath();
  ctx.ellipse(0, -5, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = IVORY;
  ctx.beginPath();
  ctx.arc(0, -5, 1.4, 0, Math.PI * 2);
  ctx.fill();
  if (distracted) {
    drawItemIcon(ctx, "cat_treat", 21, -20, 0.55);
  } else {
    label(ctx, "PSYCHIC", 0, 26, 8, VIOLET, "center", DISPLAY_FONT, 900);
  }
  ctx.restore();
}

function drawDinosaur(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
  time: number,
): void {
  const x = lerp(state.dinosaur.previousX, state.dinosaur.x, alpha);
  const y = lerp(state.dinosaur.previousY, state.dinosaur.y, alpha);
  let angle = 0;
  const target = state.players.find((player) => player.id === state.dinosaur.targetPlayer);
  if (target) angle = Math.atan2(target.y - y, target.x - x);
  const charge = state.dinosaur.awake ? Math.sin(time * 9) * 1.5 : 0;
  ctx.save();
  ctx.translate(x, y + charge);
  ctx.rotate(angle);
  ctx.strokeStyle = IVORY;
  ctx.fillStyle = IVORY;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-62, 0);
  ctx.quadraticCurveTo(-15, -20, 35, -5);
  ctx.lineTo(58, -17);
  ctx.stroke();
  for (let index = -3; index <= 3; index += 1) {
    const px = index * 11;
    ctx.beginPath();
    ctx.moveTo(px, -11 - Math.abs(index) * 0.7);
    ctx.quadraticCurveTo(px - 8, 9, px - 3, 19);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-5, 8);
  ctx.lineTo(-15, 32);
  ctx.lineTo(-27, 36);
  ctx.moveTo(17, 5);
  ctx.lineTo(21, 30);
  ctx.lineTo(33, 34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(40, -7);
  ctx.lineTo(50, 9);
  ctx.lineTo(60, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(46, -20);
  ctx.lineTo(71, -23);
  ctx.lineTo(78, -12);
  ctx.lineTo(56, -7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(65, -18, 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (state.dinosaur.awake) {
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(59, -8);
    ctx.lineTo(76, -3);
    ctx.stroke();
  } else {
    label(ctx, "Z", 66, -41, 12, CYAN, "center", DISPLAY_FONT, 900);
    label(ctx, "Z", 78, -51, 9, CYAN, "center", DISPLAY_FONT, 900);
  }
  ctx.restore();
}

function drawMammoth(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const { mammoth } = state;
  const direction = mammoth.directionX < -0.05 ? -1 : 1;
  ctx.save();
  ctx.translate(mammoth.x, mammoth.y);
  ctx.scale(direction, 1);
  ctx.globalAlpha = mammoth.active ? 1 : 0.65;
  ctx.fillStyle = "rgba(5,8,20,.5)";
  ctx.beginPath();
  ctx.ellipse(0, 22, 45, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-5, 0, 41, 29, 0, 0, Math.PI * 2);
  fillStroke(ctx, mammoth.active ? "#7a513f" : "#716b67", INK, 4);
  ctx.beginPath();
  ctx.ellipse(34, 2, 23, 24, 0, 0, Math.PI * 2);
  fillStroke(ctx, mammoth.active ? "#8e5e46" : "#77716e", INK, 4);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-24, 17);
  ctx.lineTo(-25, 34);
  ctx.moveTo(10, 17);
  ctx.lineTo(12, 34);
  ctx.stroke();
  ctx.strokeStyle = mammoth.active ? "#8e5e46" : "#77716e";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(48, 10);
  ctx.quadraticCurveTo(57, 31, 45, 39 + Math.sin(time * 3) * 2);
  ctx.stroke();
  ctx.strokeStyle = IVORY;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(43, 8);
  ctx.quadraticCurveTo(57, 11, 58, 24);
  ctx.moveTo(34, 10);
  ctx.quadraticCurveTo(46, 16, 45, 28);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(43, -4, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BRASS;
  roundedRect(ctx, -20, -23, 38, 14, 4);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  if (!mammoth.active) {
    roundedRect(ctx, -46, -43, 92, 20, 5);
    ctx.fillStyle = "rgba(17,21,43,.9)";
    ctx.fill();
    label(ctx, "PLEASE DO NOT RIDE", 0, -33, 8, IVORY, "center", DISPLAY_FONT, 900);
  }
  ctx.restore();
}

function drawCarriedArtifact(ctx: CanvasRenderingContext2D, state: GameState, alpha: number, time: number): void {
  if (!state.artifact.stolen || state.artifact.carrierId === null) return;
  const carrier = state.players.find((player) => player.id === state.artifact.carrierId);
  if (!carrier) return;
  const x = lerp(carrier.previousX, carrier.x, alpha);
  const y = lerp(carrier.previousY, carrier.y, alpha);
  drawArtifactShape(ctx, state.artifact.id, x + 17, y - 32, 0.58, time);
}

function drawInteractionPrompts(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number,
  reducedMotion: boolean,
): void {
  let closest:
    | { carryId: CarryId; x: number; y: number; distanceSquared: number }
    | undefined;
  for (const item of state.items) {
    if (!item.active) continue;
    for (const player of state.players) {
      const dx = item.x - player.x;
      const dy = item.y - player.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > 105 * 105) continue;
      if (!closest || distanceSquared < closest.distanceSquared) {
        closest = { carryId: item.carryId, x: item.x, y: item.y, distanceSquared };
      }
    }
  }
  if (!closest) return;
  const item = CARRY_ITEMS[closest.carryId];
  const y = closest.y - 46 + (reducedMotion ? 0 : Math.sin(time * 4) * 2);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.5)";
  ctx.shadowBlur = 8;
  roundedRect(ctx, closest.x - 80, y - 15, 160, 30, 10);
  ctx.fillStyle = "rgba(11,16,36,.94)";
  ctx.fill();
  ctx.strokeStyle = item.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  roundedRect(ctx, closest.x - 72, y - 9, 28, 18, 5);
  ctx.fillStyle = item.color;
  ctx.fill();
  label(ctx, "E", closest.x - 58, y, 10, INK, "center", MONO_FONT, 900);
  label(ctx, item.name.toUpperCase(), closest.x - 36, y, 9, IVORY, "left", DISPLAY_FONT, 800);
  ctx.restore();
}

function drawEscapeAtmosphere(
  ctx: CanvasRenderingContext2D,
  stage: EscapeStage,
  stageIndex: number,
  time: number,
  reducedMotion: boolean,
): void {
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = stage.color;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.strokeStyle = stage.color;
  ctx.fillStyle = stage.color;

  if (stageIndex === 0) {
    ctx.lineWidth = 6;
    for (let index = 0; index < 13; index += 1) {
      const x = 40 + hash01(index) * 1520;
      const y = 80 + hash01(index + 20) * 740;
      ctx.beginPath();
      ctx.moveTo(x, y + 34);
      ctx.quadraticCurveTo(x + 5, y, x + 25, y - 25);
      ctx.stroke();
      for (let leaf = 0; leaf < 3; leaf += 1) {
        ctx.beginPath();
        ctx.ellipse(x + 8 + leaf * 7, y + 14 - leaf * 13, 12, 5, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (stageIndex === 1) {
    ctx.lineWidth = 3;
    for (let y = 60; y < WORLD_HEIGHT; y += 42) {
      for (let x = 20; x < WORLD_WIDTH; x += 72) {
        const offset = (Math.floor(y / 42) % 2) * 36;
        ctx.strokeRect(x + offset, y, 66, 34);
      }
    }
  } else if (stageIndex === 2) {
    const drift = reducedMotion ? 0 : (time * 34) % 54;
    ctx.lineWidth = 2;
    for (let x = -200; x < WORLD_WIDTH + 200; x += 80) {
      ctx.beginPath();
      ctx.moveTo(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = WORLD_HEIGHT / 2 + drift; y < WORLD_HEIGHT; y += 54) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }
  } else {
    for (let index = 0; index < 70; index += 1) {
      const x = hash01(index * 3) * WORLD_WIDTH;
      const y = hash01(index * 3 + 1) * WORLD_HEIGHT;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hash01(index * 3 + 2) * Math.PI);
      ctx.fillRect(-8, -2, 16, 4);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawEscapeGate(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number,
  reducedMotion: boolean,
): void {
  if (!state.escape) return;
  const stageIndex = Math.abs(state.escape.stage) % ESCAPE_STAGES.length;
  const stage = ESCAPE_STAGES[stageIndex];
  const { gateX, gateY } = state.escape;
  const spin = reducedMotion ? 0 : time * 0.65;
  ctx.save();
  ctx.translate(gateX, gateY);
  ctx.shadowColor = stage.color;
  ctx.shadowBlur = 28;
  for (let ring = 0; ring < 3; ring += 1) {
    ctx.save();
    ctx.rotate(spin * (ring % 2 === 0 ? 1 : -1));
    ctx.strokeStyle = ring === 1 ? IVORY : stage.color;
    ctx.lineWidth = 6 - ring;
    ctx.setLineDash([18 - ring * 3, 10 + ring * 3]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 48 + ring * 11, 59 + ring * 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(11,16,36,.72)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 41, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "EXIT", 0, 2, 13, stage.color, "center", DISPLAY_FONT, 900);
  ctx.restore();

  roundedRect(ctx, gateX - 145, gateY - 98, 290, 30, 9);
  ctx.fillStyle = "rgba(11,16,36,.92)";
  ctx.fill();
  ctx.strokeStyle = stage.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  label(ctx, stage.name, gateX, gateY - 83, 11, stage.color, "center", DISPLAY_FONT, 900);
}

function drawRewindEffect(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number,
  reducedMotion: boolean,
): void {
  const hamster = state.players.find((player) => player.role === "hamster" && player.abilityActive > 0);
  if (!hamster) return;
  const snapshots = state.rewindHistory;
  if (!reducedMotion && snapshots.length > 0) {
    const picks = [snapshots.length - 1, snapshots.length - 15, snapshots.length - 30];
    picks.forEach((snapshotIndex, trailIndex) => {
      const snapshot = snapshots[Math.max(0, snapshotIndex)];
      if (!snapshot) return;
      snapshot.players.forEach((player, playerIndex) => {
        const current = state.players[playerIndex];
        if (!current) return;
        drawPlayerSilhouette(
          ctx,
          current.role,
          current.id,
          player.x,
          player.y,
          current.directionX,
          current.directionY,
          false,
          player.disguised,
          player.mounted,
          player.caughtTicks > 0,
          false,
          time,
          0.16 - trailIndex * 0.035,
        );
      });
    });
  }
  ctx.save();
  ctx.translate(hamster.x, hamster.y);
  ctx.strokeStyle = MINT;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.65;
  for (let ring = 0; ring < 3; ring += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, 35 + ring * 18 + (reducedMotion ? 0 : Math.sin(time * 5 + ring) * 5), Math.PI * 0.15, Math.PI * 1.8);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-30, -17);
  ctx.lineTo(-42, -14);
  ctx.lineTo(-35, -4);
  ctx.closePath();
  ctx.fillStyle = MINT;
  ctx.fill();
  ctx.restore();
}

function drawAlarmOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  time: number,
  reducedMotion: boolean,
): void {
  const alarm = normalizedAlarm(state.alarm);
  if (alarm <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = 0.14 + alarm * 0.3;
  ctx.strokeStyle = CORAL;
  ctx.lineWidth = 9 + alarm * 18;
  ctx.strokeRect(9, 9, WORLD_WIDTH - 18, WORLD_HEIGHT - 18);
  if (!reducedMotion && alarm > 0.45) {
    const scanX = ((time * 310) % (WORLD_WIDTH + 300)) - 150;
    const sweep = ctx.createLinearGradient(scanX - 100, 0, scanX + 100, 0);
    sweep.addColorStop(0, "rgba(255,107,115,0)");
    sweep.addColorStop(0.5, "rgba(255,107,115,.18)");
    sweep.addColorStop(1, "rgba(255,107,115,0)");
    ctx.fillStyle = sweep;
    ctx.fillRect(scanX - 100, 0, 200, WORLD_HEIGHT);
  }
  ctx.restore();
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  time: number,
  reducedMotion: boolean,
  opacity = 1,
): void {
  ctx.save();
  ctx.fillStyle = IVORY;
  for (let index = 0; index < 42; index += 1) {
    const baseX = hash01(index * 2 + 140) * WORLD_WIDTH;
    const baseY = hash01(index * 2 + 141) * WORLD_HEIGHT;
    const x = reducedMotion ? baseX : (baseX + time * (2 + hash01(index) * 4)) % WORLD_WIDTH;
    const y = reducedMotion ? baseY : baseY + Math.sin(time * 0.6 + index) * 9;
    ctx.globalAlpha = opacity * (0.05 + hash01(index + 20) * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + hash01(index + 70) * 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawActors(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
  time: number,
): void {
  type DrawEntry = { y: number; draw: () => void };
  const entries: DrawEntry[] = [];
  state.guards.forEach((guard) => {
    const x = lerp(guard.previousX, guard.x, alpha);
    const y = lerp(guard.previousY, guard.y, alpha);
    entries.push({
      y,
      draw: () =>
        drawGuardFigure(
          ctx,
          x,
          y,
          guard.directionX,
          guard.directionY,
          guard.mode,
          guard.name,
          guard.suspicion,
          guard.remembersCrew,
          time,
        ),
    });
  });
  state.players.forEach((player) => {
    entries.push({
      y: lerp(player.previousY, player.y, alpha),
      draw: () => drawPlayer(ctx, player, alpha, time),
    });
  });
  entries.sort((left, right) => left.y - right.y);
  entries.forEach((entry) => entry.draw());
}

/**
 * Draw the complete 1600x900 museum world into any CSS-pixel-sized canvas.
 * The caller may set up a DPR transform; this function only applies a local
 * aspect-preserving world transform and restores the incoming context state.
 */
export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
  width: number,
  height: number,
  reducedMotion: boolean,
): void {
  if (width <= 0 || height <= 0) return;
  const interpolation = clamp(alpha);
  const time = state.tick / 60;
  beginWorld(ctx, width, height);

  const alarm = normalizedAlarm(state.alarm);
  if (!reducedMotion && alarm > 0.65) {
    const shake = (alarm - 0.65) * 4.5;
    ctx.translate(Math.sin(state.tick * 1.71) * shake, Math.cos(state.tick * 1.37) * shake);
  }

  drawMuseumBase(ctx, time, reducedMotion);
  if (state.escape) {
    const stageIndex = Math.abs(state.escape.stage) % ESCAPE_STAGES.length;
    drawEscapeAtmosphere(ctx, ESCAPE_STAGES[stageIndex], stageIndex, time, reducedMotion);
  }
  drawRouteIntel(ctx, state);
  for (const guard of state.guards) {
    drawVisionCone(
      ctx,
      lerp(guard.previousX, guard.x, interpolation),
      lerp(guard.previousY, guard.y, interpolation),
      guard.directionX,
      guard.directionY,
      guard.mode,
      guard.suspicion,
    );
  }
  drawObstacles(ctx, time);
  drawPortals(ctx, state, time, reducedMotion);
  drawVault(ctx, state, time);
  drawItems(ctx, state, time, reducedMotion);
  drawDinosaur(ctx, state, interpolation, time);
  drawMammoth(ctx, state, time);
  drawCat(ctx, state, interpolation, time, reducedMotion);
  drawActors(ctx, state, interpolation, time);
  drawCarriedArtifact(ctx, state, interpolation, time);
  drawInteractionPrompts(ctx, state, time, reducedMotion);
  drawRewindEffect(ctx, state, time, reducedMotion);
  drawEscapeGate(ctx, state, time, reducedMotion);
  drawDust(ctx, time, reducedMotion);
  drawAlarmOverlay(ctx, state, time, reducedMotion);

  if (state.escape && state.escape.stageFlash > 0) {
    const flash = clamp(state.escape.stageFlash / 45) * 0.3;
    ctx.fillStyle = `rgba(243,234,215,${flash})`;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  endWorld(ctx);
}

function drawTitleClock(
  ctx: CanvasRenderingContext2D,
  time: number,
  reducedMotion: boolean,
): void {
  const x = 1280;
  const y = 175;
  const radius = 108;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 38;
  ctx.fillStyle = "rgba(243,234,215,.94)";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.shadowBlur = 0;
  for (let mark = 0; mark < 12; mark += 1) {
    const angle = -Math.PI / 2 + (mark / 12) * Math.PI * 2;
    const inner = mark % 3 === 0 ? radius - 24 : radius - 17;
    ctx.strokeStyle = INK;
    ctx.lineWidth = mark % 3 === 0 ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * (radius - 8), Math.sin(angle) * (radius - 8));
    ctx.stroke();
  }
  const cycle = reducedMotion ? 0 : (time % 12) / 12;
  const minuteAngle = -Math.PI / 2 + cycle * Math.PI * 2;
  const hourAngle = -Math.PI / 2 + (11.8 / 12) * Math.PI * 2 - cycle * 0.08;
  ctx.strokeStyle = INK;
  ctx.lineCap = "round";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(hourAngle) * 55, Math.sin(hourAngle) * 55);
  ctx.stroke();
  ctx.strokeStyle = CORAL;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(minuteAngle) * 78, Math.sin(minuteAngle) * 78);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, "TUE", 0, 43, 11, INK, "center", DISPLAY_FONT, 900);
  ctx.restore();
}

/** Draw the animated, asset-free title-screen museum cutaway. `time` is seconds. */
export function renderTitleBackdrop(
  ctx: CanvasRenderingContext2D,
  time: number,
  width: number,
  height: number,
  reducedMotion: boolean,
): void {
  if (width <= 0 || height <= 0) return;
  beginWorld(ctx, width, height, "#080b19");

  const sky = ctx.createRadialGradient(1220, 130, 20, 1220, 130, 720);
  sky.addColorStop(0, "#263559");
  sky.addColorStop(0.55, "#11172e");
  sky.addColorStop(1, "#080b19");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.save();
  ctx.translate(75, 86);
  ctx.scale(0.9, 0.84);
  ctx.globalAlpha = 0.76;
  drawMuseumBase(ctx, time, reducedMotion, true);
  drawObstacles(ctx, time);
  PAINTING_SPOTS.forEach((spot, index) => {
    drawPortalPainting(
      ctx,
      spot.x,
      spot.y,
      portalColor(spot.id, index),
      index === 1 || index === 2,
      false,
      time,
      reducedMotion,
    );
  });

  const flashlight = reducedMotion ? 0.3 : Math.sin(time * 0.7) * 0.32;
  drawVisionCone(ctx, 360, 335, Math.cos(flashlight), Math.sin(flashlight), "patrol", 0.2);
  drawVisionCone(ctx, 1160, 595, -Math.cos(flashlight), -Math.sin(flashlight), "investigate", 0.55);
  drawGuardFigure(ctx, 360, 335, Math.cos(flashlight), Math.sin(flashlight), "patrol", "Morrow", 0.2, false, time);
  drawGuardFigure(ctx, 1160, 595, -Math.cos(flashlight), -Math.sin(flashlight), "investigate", "Tuesday", 0.55, false, time);

  drawPlayerSilhouette(ctx, "glitch", 0, 690, 730, 1, -0.15, true, false, false, false, false, time);
  drawPlayerSilhouette(ctx, "talker", 1, 735, 752, 1, -0.12, false, false, false, false, false, time + 0.08);
  drawPlayerSilhouette(ctx, "tinkerer", 2, 780, 722, 1, -0.18, false, false, false, false, false, time + 0.16);
  drawPlayerSilhouette(ctx, "hamster", 3, 826, 748, 1, -0.2, false, false, false, false, false, time + 0.24);

  const titleState = {
    cat: {
      x: 345,
      y: 575,
      previousX: 345,
      previousY: 575,
      route: [],
      routeIndex: 0,
      distractedTicks: 0,
      pulse: 0,
    },
  } satisfies Pick<GameState, "cat">;
  drawCat(ctx, titleState, 1, time, reducedMotion);
  drawDust(ctx, time, reducedMotion, 1.4);
  ctx.restore();

  drawTitleClock(ctx, time, reducedMotion);

  const vignette = ctx.createRadialGradient(800, 430, 270, 800, 430, 930);
  vignette.addColorStop(0, "rgba(3,5,15,0)");
  vignette.addColorStop(0.68, "rgba(3,5,15,.16)");
  vignette.addColorStop(1, "rgba(3,5,15,.78)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 12]);
  ctx.strokeRect(24, 24, WORLD_WIDTH - 48, WORLD_HEIGHT - 48);
  ctx.setLineDash([]);
  ctx.restore();
  endWorld(ctx);
}
