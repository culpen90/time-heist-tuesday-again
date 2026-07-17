"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AudioDirector } from "./audio";
import {
  advanceLoop,
  createGame,
  formatMuseumTime,
  getAbilityReady,
  stepGame,
} from "./engine";
import { InputManager } from "./input";
import {
  ARTIFACTS,
  CARRY_ITEMS,
  CONTROL_SCHEMES,
  type GameState,
  type RoleId,
  ROLES,
  SIM_HZ,
} from "./model";
import { renderGame, renderTitleBackdrop } from "./render";

const ROLE_ORDER: RoleId[] = ["glitch", "talker", "tinkerer", "hamster"];
type ShellScreen = "title" | "lobby" | "how" | "game";

const INTEL_LABELS: Record<string, string> = {
  portal_pair: "The paintings that are secretly doors",
  dinosaur_time: "Exactly when the fossil hall stops being historical",
  cat_weakness: "The psychic cat's impossible snack preference",
  vault_location: "Tonight's artifact pedestal",
  guard_routes: "The guards' extremely union-approved patrol",
  secret_passage: "A passage the architect insists is decorative",
};

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`chrono-logo${compact ? " chrono-logo--compact" : ""}`}>
      <div className="chrono-logo__eyebrow">
        <span /> A PERPETUAL CRIME <span />
      </div>
      <div className="chrono-logo__title">
        <span>TIME</span>
        <span>HEIST</span>
      </div>
      <div className="chrono-logo__stamp">TUESDAY AGAIN</div>
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="icon-button" type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      className="setting-toggle"
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className={`toggle-track${checked ? " is-on" : ""}`}>
        <span />
      </span>
    </button>
  );
}

function MenuButton({
  children,
  detail,
  primary = false,
  onClick,
}: {
  children: React.ReactNode;
  detail?: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`menu-button${primary ? " menu-button--primary" : ""}`}
      type="button"
      onClick={onClick}
    >
      <span>{children}</span>
      {detail ? <small>{detail}</small> : null}
      <b aria-hidden="true">→</b>
    </button>
  );
}

function RoleToken({ role, player }: { role: RoleId; player: number }) {
  const definition = ROLES[role];
  return (
    <span
      className={`role-token role-token--${role}`}
      style={{ "--role": definition.color } as React.CSSProperties}
      aria-label={definition.name}
    >
      <span>{definition.icon}</span>
      <b>P{player + 1}</b>
    </span>
  );
}

function TitleBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;

    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTitleBackdrop(context, time / 1000, rect.width, rect.height, reducedMotion);
      frame = requestAnimationFrame(draw);
    };
    resizeObserver = new ResizeObserver(() => undefined);
    resizeObserver.observe(canvas);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} className="title-canvas" aria-hidden="true" />;
}

export default function TimeHeistGame() {
  const [screen, setScreen] = useState<ShellScreen>("title");
  const [playerCount, setPlayerCount] = useState(1);
  const [roles, setRoles] = useState<RoleId[]>(ROLE_ORDER);
  const [briefing, setBriefing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [trueTuesday, setTrueTuesday] = useState(false);
  const [activeGame, setActiveGame] = useState<GameState | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<InputManager | null>(null);
  const audioRef = useRef<AudioDirector | null>(null);

  useEffect(() => {
    const audio = new AudioDirector();
    audioRef.current = audio;
    return () => audio.destroy();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "time-heist-settings",
      JSON.stringify({ sound, reducedMotion, trueTuesday }),
    );
    audioRef.current?.setEnabled(sound);
  }, [sound, reducedMotion, trueTuesday]);

  const click = useCallback(() => audioRef.current?.click(), []);

  const go = useCallback(
    (next: ShellScreen) => {
      click();
      setScreen(next);
      setSettingsOpen(false);
    },
    [click],
  );

  const chooseRole = (playerIndex: number, role: RoleId) => {
    click();
    setRoles((current) => {
      const next = [...current];
      const other = next.findIndex(
        (candidate, index) => index < playerCount && candidate === role && index !== playerIndex,
      );
      if (other >= 0) next[other] = next[playerIndex];
      next[playerIndex] = role;
      return next;
    });
  };

  const startHeist = () => {
    click();
    const state = createGame({
      roles: roles.slice(0, playerCount),
      seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
      clockRate: trueTuesday ? 1 : 4,
    });
    gameRef.current = state;
    setActiveGame(state);
    setPaused(false);
    setBriefing(true);
    setScreen("game");
  };

  const beginBriefing = () => {
    click();
    void audioRef.current?.start();
    setBriefing(false);
  };

  useEffect(() => {
    if (screen !== "game") return;
    const input = new InputManager(window);
    inputRef.current = input;
    return () => {
      input.destroy();
      inputRef.current = null;
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "game") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Escape") return;
      const state = gameRef.current;
      if (!state || briefing || state.scene === "loop_summary" || state.scene === "victory") {
        return;
      }
      event.preventDefault();
      click();
      setPaused((value) => !value);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, briefing, click]);

  useEffect(() => {
    if (screen !== "game") return;
    const canvas = canvasRef.current;
    const input = inputRef.current;
    const state = gameRef.current;
    if (!canvas || !input || !state) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let previousTime = performance.now();
    let accumulator = 0;
    let hudCounter = 0;
    const stepSeconds = 1 / SIM_HZ;

    const frame = (time: number) => {
      const current = gameRef.current;
      if (!current) return;
      const elapsed = Math.min((time - previousTime) / 1000, 0.12);
      previousTime = time;
      const canPlay =
        !paused &&
        !briefing &&
        current.scene !== "loop_summary" &&
        current.scene !== "victory";
      input.setActivePlay(canPlay);

      if (canPlay) {
        accumulator += elapsed;
        while (accumulator >= stepSeconds) {
          stepGame(current, input.getFrames(current.players.length));
          accumulator -= stepSeconds;
          hudCounter += 1;
          if (hudCounter >= 6) {
            hudCounter = 0;
            setActiveGame({ ...current });
          }
        }
      } else {
        accumulator = 0;
      }

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderGame(
        context,
        current,
        accumulator / stepSeconds,
        rect.width,
        rect.height,
        reducedMotion,
      );
      audioRef.current?.update(current);
      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationFrame);
      input.setActivePlay(false);
    };
  }, [screen, paused, briefing, reducedMotion]);

  const artifact = activeGame ? ARTIFACTS[activeGame.artifact.id] : null;

  const chooseCarry = (playerId: number, carryId: string | null) => {
    const game = gameRef.current;
    const player = game?.players[playerId];
    if (!game || !player) return;
    click();
    const next: GameState = {
      ...game,
      players: game.players.map((candidate) =>
        candidate.id === playerId
          ? { ...candidate, carried: carryId as typeof candidate.carried }
          : candidate,
      ),
    };
    gameRef.current = next;
    setActiveGame(next);
  };

  const restartLoop = () => {
    const game = gameRef.current;
    if (!game) return;
    click();
    const next = structuredClone(game);
    advanceLoop(next);
    gameRef.current = next;
    setActiveGame(next);
    setPaused(false);
    setBriefing(false);
  };

  const newHeist = () => {
    click();
    gameRef.current = null;
    setActiveGame(null);
    setScreen("lobby");
    setBriefing(false);
    setPaused(false);
  };

  const fullscreen = () => {
    click();
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  const score = activeGame
    ? Math.max(
        0,
        12000 +
          activeGame.stats.portalsUsed * 250 +
          activeGame.stats.guardsBaffled * 180 -
          (activeGame.loopNumber - 1) * 900 -
          activeGame.stats.detections * 220,
      )
    : 0;

  if (screen === "title") {
    return (
      <main className="game-shell title-screen" data-game="time-heist">
        <TitleBackdrop reducedMotion={reducedMotion} />
        <div className="title-vignette" />
        <section className="title-panel" aria-labelledby="game-title">
          <h1 id="game-title" className="sr-only">Time Heist: Tuesday Again</h1>
          <Logo />
          <p className="tagline">You have 12 minutes. Fortunately, you have Tuesday forever.</p>
          <div className="title-menu">
            <MenuButton primary detail="1–4 local players" onClick={() => go("lobby")}>
              START A LOOP
            </MenuButton>
            <MenuButton detail="Learn the impossible plan" onClick={() => go("how")}>
              HOW TO HEIST
            </MenuButton>
            <MenuButton detail="Sound, motion & loop pace" onClick={() => { click(); setSettingsOpen(true); }}>
              SETTINGS
            </MenuButton>
          </div>
          <div className="title-footnote">
            <span><kbd>WASD</kbd> MOVE</span>
            <span><kbd>E</kbd> INTERACT</span>
            <span><kbd>Q</kbd> ABILITY</span>
            <span>GAMEPADS WELCOME</span>
          </div>
        </section>
        <div className="title-tuesday" aria-hidden="true">TUE<br />S<br />DAY</div>
        {settingsOpen ? (
          <div className="modal-backdrop" role="presentation">
            <section className="paper-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
              <button className="modal-close" type="button" onClick={() => { click(); setSettingsOpen(false); }} aria-label="Close settings">×</button>
              <span className="modal-kicker">MUSEUM POLICY 12-B</span>
              <h2 id="settings-title">SETTINGS</h2>
              <SettingToggle label="CLOCKWORK SOUND" checked={sound} onChange={setSound} />
              <SettingToggle label="REDUCED MOTION" checked={reducedMotion} onChange={setReducedMotion} />
              <SettingToggle label="TRUE 12-MINUTE LOOP" checked={trueTuesday} onChange={setTrueTuesday} />
              <p className="settings-note">
                Standard caper pace compresses twelve museum minutes into three real minutes. True Tuesday does exactly what it says.
              </p>
            </section>
          </div>
        ) : null}
      </main>
    );
  }

  if (screen === "how") {
    return (
      <main className="game-shell dossier-screen">
        <TitleBackdrop reducedMotion={true} />
        <header className="dossier-header">
          <Logo compact />
          <button className="back-button" type="button" onClick={() => go("title")}>← BACK TO TUESDAY</button>
        </header>
        <section className="dossier" aria-labelledby="how-title">
          <div className="dossier-heading">
            <span>CONFIDENTIAL / REPEATING</span>
            <h1 id="how-title">HOW TO HEIST</h1>
            <p>Learn. Steal. Reset. Keep exactly one impossible advantage.</p>
          </div>
          <div className="plan-grid">
            <article><b>01</b><h2>CASE THE MUSEUM</h2><p>Read guard routes, find the portal paintings, learn when the dinosaur wakes, and discover tonight’s artifact.</p></article>
            <article><b>02</b><h2>BREAK THREE SEALS</h2><p>Identity. Chronology. Psychic cat. Use the right thing—or the wrong specialist in exactly the right way.</p></article>
            <article><b>03</b><h2>ANCHOR ONE THING</h2><p>At midnight the museum resets. Each thief may lock one item, password, disguise, or memory into the next Tuesday.</p></article>
            <article><b>04</b><h2>OUTRUN HISTORY</h2><p>Stealing the artifact tears open three eras. Keep the crew together and reach the getaway clock.</p></article>
          </div>
          <div className="role-manifest">
            {ROLE_ORDER.map((role) => {
              const definition = ROLES[role];
              return (
                <article key={role} style={{ "--role": definition.color } as React.CSSProperties}>
                  <RoleToken role={role} player={ROLE_ORDER.indexOf(role)} />
                  <div><h3>{definition.name}</h3><b>{definition.ability}</b><p>{definition.description}</p></div>
                </article>
              );
            })}
          </div>
          <button className="paper-cta" type="button" onClick={() => go("lobby")}>ASSEMBLE THE CREW <span>→</span></button>
        </section>
      </main>
    );
  }

  if (screen === "lobby") {
    return (
      <main className="game-shell lobby-screen">
        <div className="lobby-grid-bg" />
        <header className="lobby-header">
          <Logo compact />
          <button className="back-button" type="button" onClick={() => go("title")}>← ABANDON PLAN</button>
        </header>
        <section className="crew-builder" aria-labelledby="crew-title">
          <div className="crew-heading">
            <span className="modal-kicker">STEP 1 OF INFINITELY MANY</span>
            <h1 id="crew-title">ASSEMBLE THE CREW</h1>
            <p>One keyboard. Up to three extra keyboard schemes or gamepads. Absolutely no adult supervision.</p>
          </div>
          <div className="player-count" role="group" aria-label="Number of players">
            {[1, 2, 3, 4].map((count) => (
              <button key={count} type="button" className={playerCount === count ? "is-active" : ""} onClick={() => { click(); setPlayerCount(count); }}>
                <b>{count}</b><span>{count === 1 ? "THIEF" : "THIEVES"}</span>
              </button>
            ))}
          </div>
          <div className="crew-slots">
            {Array.from({ length: playerCount }, (_, playerIndex) => {
              const selectedRole = roles[playerIndex];
              const controls = CONTROL_SCHEMES[playerIndex];
              return (
                <article className="crew-slot" key={playerIndex} style={{ "--role": ROLES[selectedRole].color } as React.CSSProperties}>
                  <header><RoleToken role={selectedRole} player={playerIndex} /><div><span>PLAYER {playerIndex + 1}</span><b>{controls.move} · {controls.interact} · {controls.ability}</b></div></header>
                  <div className="role-picker">
                    {ROLE_ORDER.map((role) => (
                      <button key={role} type="button" className={selectedRole === role ? "is-selected" : ""} onClick={() => chooseRole(playerIndex, role)} aria-label={`Choose ${ROLES[role].name} for player ${playerIndex + 1}`}>
                        <span style={{ background: ROLES[role].color }}>{ROLES[role].icon}</span>
                        <small>{ROLES[role].name.replace("The ", "")}</small>
                      </button>
                    ))}
                  </div>
                  <div className="role-brief"><b>{ROLES[selectedRole].ability}</b><p>{ROLES[selectedRole].description}</p></div>
                </article>
              );
            })}
          </div>
          <div className="lobby-actions">
            <div><span>LOOP PACE</span><b>{trueTuesday ? "12 REAL MINUTES" : "3 REAL MINUTES / 12 MUSEUM MINUTES"}</b></div>
            <button className="launch-button" type="button" onClick={startHeist}>CASE THE JOINT <span>→</span></button>
          </div>
        </section>
      </main>
    );
  }

  const latestMessage = activeGame?.messages.filter((message) => message.ticksLeft > 0).at(-1);
  const fraction = activeGame
    ? Math.max(0, 1 - activeGame.loopTick / activeGame.loopTicksTotal)
    : 1;
  const alarmClass = activeGame && activeGame.alarm > 70 ? " is-hot" : "";

  return (
    <main className={`game-shell play-screen${alarmClass}`} data-scene={activeGame?.scene ?? "loading"}>
      <canvas ref={canvasRef} className="game-canvas" aria-label="Top-down museum heist game" />
      {activeGame ? (
        <>
          <div className="game-topbar">
            <section className="crew-hud" aria-label="Crew status">
              {activeGame.players.map((player) => {
                const role = ROLES[player.role];
                return (
                  <div className={`crew-hud__player${player.caughtTicks > 0 ? " is-caught" : ""}`} key={player.id} style={{ "--role": role.color } as React.CSSProperties}>
                    <RoleToken role={player.role} player={player.id} />
                    <div><b>{role.name}</b><span>{player.caughtTicks > 0 ? "TEMPORALLY DETAINED" : player.mounted ? "MAMMOTH MODE" : getAbilityReady(player) ? "ABILITY READY" : "COOLDOWN"}</span></div>
                  </div>
                );
              })}
            </section>
            <section className="clock-hud" aria-label={`Time remaining ${formatMuseumTime(activeGame)}`}>
              <div className="clock-ring" aria-hidden="true">
                {Array.from({ length: 12 }, (_, index) => <i className={index / 12 < fraction ? "is-filled" : ""} key={index} style={{ transform: `rotate(${index * 30}deg)` }} />)}
              </div>
              <span>{activeGame.scene === "escape" ? "ESCAPE WINDOW" : `LOOP ${activeGame.loopNumber}`}</span>
              <strong>{formatMuseumTime(activeGame)}</strong>
              <small>{activeGame.modifier}</small>
            </section>
            <section className="alarm-hud" aria-label={`Museum alarm ${Math.round(activeGame.alarm)} percent`}>
              <div><span>PSYCHIC ALARM</span><b>{Math.round(activeGame.alarm)}%</b></div>
              <div className="alarm-track"><span style={{ width: `${activeGame.alarm}%` }} /></div>
              <p>{activeGame.alarm < 20 ? "THE MUSEUM SUSPECTS NOTHING" : activeGame.alarm < 60 ? "SOMETHING FEELS CRIMINAL" : "EVERYONE LOOK NATURAL"}</p>
            </section>
          </div>

          <section className="objective-card">
            <span>THE PLAN, CURRENTLY</span>
            <b>{activeGame.objective}</b>
            <div className="seal-row">
              {activeGame.seals.map((seal) => <i key={seal.id} className={seal.disabled ? "is-open" : ""} title={seal.label}>{seal.disabled ? "✓" : "×"}</i>)}
              <small>{activeGame.seals.filter((seal) => seal.disabled).length}/3 SEALS</small>
            </div>
          </section>

          <div className="game-actions">
            {activeGame.players.map((player) => {
              const role = ROLES[player.role];
              const carry = player.carried ? CARRY_ITEMS[player.carried] : null;
              const cooldown = Math.max(0, Math.min(1, player.abilityCooldown / (SIM_HZ * 15)));
              return (
                <section className="action-card" key={player.id} style={{ "--role": role.color } as React.CSSProperties}>
                  <div className="ability-dial" style={{ "--cooldown": `${cooldown * 360}deg` } as React.CSSProperties}><b>{role.icon}</b></div>
                  <div><span>P{player.id + 1} · {role.ability}</span><b>{getAbilityReady(player) ? "READY" : `${Math.ceil(player.abilityCooldown / SIM_HZ)}s`}</b></div>
                  <div className={`carry-chip${carry ? " has-item" : ""}`}><small>ANCHOR SLOT</small><b>{carry ? carry.name : "EMPTY"}</b></div>
                </section>
              );
            })}
          </div>

          <div className="context-prompt"><kbd>{CONTROL_SCHEMES[0].interact}</kbd><span>INTERACT / PICK UP</span><i /> <kbd>{CONTROL_SCHEMES[0].ability}</kbd><span>SPECIALIST ABILITY</span></div>
          <div className="play-controls">
            <IconButton label="Pause game" onClick={() => { click(); setPaused(true); }}>Ⅱ</IconButton>
            <IconButton label="Toggle fullscreen" onClick={fullscreen}>⛶</IconButton>
          </div>

          {latestMessage ? (
            <div className={`event-toast event-toast--${latestMessage.tone}`} role="status">
              <span>{latestMessage.tone === "alarm" ? "!" : latestMessage.tone === "success" ? "✓" : "↻"}</span>
              <div><b>{latestMessage.title}</b><p>{latestMessage.body}</p></div>
            </div>
          ) : null}

          {briefing && artifact ? (
            <div className="modal-backdrop briefing-backdrop">
              <section className="paper-modal briefing-modal" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
                <span className="modal-kicker">LOOP 1 · THE TARGET</span>
                <div className="artifact-mark" style={{ "--artifact": artifact.color } as React.CSSProperties}>{artifact.glyph}</div>
                <h2 id="briefing-title">{artifact.name}</h2>
                <p className="artifact-subtitle">{artifact.subtitle}</p>
                <div className="briefing-facts"><span>HIDDEN IN</span><b>ONE OF THREE ARTIFACT PEDESTALS</b><span>ESCAPE HAZARD</span><b>{artifact.hazard}</b></div>
                <p className="briefing-copy">Disable all three temporal seals. Distract the cat. Take the artifact. If midnight wins, keep one thing and try the exact same Tuesday differently.</p>
                <button className="paper-cta" type="button" onClick={beginBriefing}>BEGIN THE LOOP <span>12:00 →</span></button>
              </section>
            </div>
          ) : null}

          {paused ? (
            <div className="modal-backdrop">
              <section className="pause-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
                <Logo compact />
                <span className="modal-kicker">TEMPORARY TEMPORAL DIFFICULTY</span>
                <h2 id="pause-title">PAUSED</h2>
                <button className="pause-choice is-primary" type="button" onClick={() => { click(); setPaused(false); }}>RESUME TUESDAY <span>→</span></button>
                <button className="pause-choice" type="button" onClick={fullscreen}>TOGGLE FULLSCREEN</button>
                <button className="pause-choice" type="button" onClick={newHeist}>ABANDON THIS TIMELINE</button>
              </section>
            </div>
          ) : null}

          {activeGame.scene === "loop_summary" ? (
            <div className="modal-backdrop reset-backdrop">
              <section className="reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
                <div className="reset-clock" aria-hidden="true"><span>12</span><i /><b>↻</b></div>
                <div className="reset-copy"><span className="modal-kicker">MIDNIGHT, AGAIN</span><h2 id="reset-title">TUESDAY RESET</h2><p>The museum forgot everything. You did not. Pick at most one discovered thing per thief to lock into the next loop.</p></div>
                <div className="carry-select-grid">
                  {activeGame.players.map((player) => {
                    const candidates = Array.from(new Set([...(player.anchored ? [player.anchored] : []), ...player.discoveries]));
                    return (
                      <article key={player.id} style={{ "--role": ROLES[player.role].color } as React.CSSProperties}>
                        <header><RoleToken role={player.role} player={player.id} /><div><b>{ROLES[player.role].name}</b><span>CHOOSE ONE ANCHOR</span></div></header>
                        <div className="carry-options">
                          <button type="button" className={player.carried === null ? "is-selected" : ""} onClick={() => chooseCarry(player.id, null)}><span>∅</span><b>NOTHING</b><small>Bold strategy</small></button>
                          {candidates.map((carryId) => {
                            const carry = CARRY_ITEMS[carryId];
                            return <button type="button" key={carryId} className={player.carried === carryId ? "is-selected" : ""} onClick={() => chooseCarry(player.id, carryId)}><span>{carry.icon}</span><b>{carry.name}</b><small>{carry.category}</small></button>;
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="intel-strip"><span>NEW INTEL</span>{activeGame.discoveredThisLoop.length ? activeGame.discoveredThisLoop.map((intel) => <b key={intel}>✓ {INTEL_LABELS[intel] ?? intel}</b>) : <b>THE CAT REMAINS JUDGMENTAL</b>}</div>
                <button className="paper-cta" type="button" onClick={restartLoop}>LOCK IT INTO TUESDAY <span>LOOP {activeGame.loopNumber + 1} →</span></button>
              </section>
            </div>
          ) : null}

          {activeGame.scene === "victory" && artifact ? (
            <div className="modal-backdrop victory-backdrop">
              <section className="victory-modal" role="dialog" aria-modal="true" aria-labelledby="victory-title">
                <span className="victory-rays" aria-hidden="true" />
                <div className="victory-stamp">HEIST COMPLETE</div>
                <div className="artifact-mark" style={{ "--artifact": artifact.color } as React.CSSProperties}>{artifact.glyph}</div>
                <span className="modal-kicker">TUESDAY, 12:01 AM · SOMEHOW</span>
                <h2 id="victory-title">YOU STOLE<br />{artifact.name.toUpperCase()}</h2>
                <p>The museum is furious. History is confused. The hamster requests a tiny vacation.</p>
                <div className="scoreboard"><div><span>SCORE</span><b>{score.toLocaleString()}</b></div><div><span>LOOPS</span><b>{activeGame.loopNumber}</b></div><div><span>GUARDS BAFFLED</span><b>{activeGame.stats.guardsBaffled}</b></div><div><span>PORTALS ABUSED</span><b>{activeGame.stats.portalsUsed}</b></div></div>
                <button className="paper-cta" type="button" onClick={newHeist}>ROB A DIFFERENT TUESDAY <span>→</span></button>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
