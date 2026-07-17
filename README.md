# Time Heist: Tuesday Again

> You have 12 minutes. Fortunately, you have Tuesday forever.

A deterministic, top-down browser heist game for one to four local players. Break into a surreal museum, learn its repeating security schedule, carry one advantage through each reset, steal a randomized artifact, and escape through four different eras.

## Play locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The project folder contains a colon, so the npm scripts call their local tools by explicit path. This is intentional.

## Controls

| Player | Move | Interact | Ability | Sprint |
| --- | --- | --- | --- | --- |
| 1 | WASD | E | Q | Shift |
| 2 | Arrow keys | Enter | / | . |
| 3 | IJKL | O | U | P |
| 4 | 8 / 4 / 5 / 6 | 0 | 1 | 2 |

Connected gamepads are also supported: left stick or D-pad to move, A to interact, X for the specialist ability, and the right trigger to sprint.

## The crew

- **The Glitch** phases through walls and locked doors.
- **The Talker** baffles nearby guards and briefly charms the psychic cat.
- **The Tinkerer** improvises an EMP from museum exhibits.
- **The Chrono Hamster** rewinds the crew and museum state by five seconds.

## Verification

```bash
npm test
npm run lint
```

The simulation runs independently of React on a fixed 60 Hz clock. Tests cover deterministic replay, exact loop timing, one-item persistence, all four specialist abilities, artifact randomization, and the complete escape-to-victory path.
