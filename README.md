# LAST FLAME

> *Everything burns out. Carry the fire anyway.*

You are a little flame with only seconds to live. Run, jump and dash across
nine floating levels, burning every lamp you pass for a few more seconds,
to carry the fire home to the Eternal Fire.

Made for BYOG 2026 · theme **Everything is Temporary**.

```bash
npm start
```

Then open http://localhost:5177.

| Key | |
|---|---|
| WASD / arrows | move |
| Mouse | look |
| Space | jump (again in the air: double jump, costs 1 s) |
| Shift | dash (costs 1 s) |
| R | back to your checkpoint |
| Esc | pause |

- Design: [docs/DESIGN.md](docs/DESIGN.md)
- `npm test`: a bot plays all nine levels with the game's own physics and
  proves each can be finished in time, through its checkpoint, with slack.
- `?level=N` jumps to a level; `?level=N&auto` lets the bot play it
  (`&all` carries on to the next).
- `npm run package` builds the game into a single self-contained HTML file
  (`tools/build.mjs`) and writes to `dist/`:
  - `LastFlame.html`: download and double-click to play, no server needed.
  - `last-flame-download.zip`: the same file, zipped.
  - `last-flame-web.zip`: the same file as `index.html`, for itch.io's
    "playable in the browser" upload.
