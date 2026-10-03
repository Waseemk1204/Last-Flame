# Last Flame: design

## Pitch

You are a flame, and flames don't last. Your life is a number of seconds
counting down in the middle of the screen. Every lamp you run through gives
you a few more. Everything you stand on is temporary too: paper burns under
you, wax melts, glass blinks out, water puts you out. Nine levels to the
Eternal Fire: **the Will of Fire**. A flame goes out; the fire it carried
doesn't.

## The flame

A faceless character: a teardrop of fire with two wisps for hands and two
embers for feet. It leans into its run, its tip trails behind it, it
squashes when it lands, and it shrinks and reddens as your life runs down.

## Rules (shared/rules.js)

- **Life**: seconds. Drains 1/s; ×2.5 in a gust of wind; ×1.8 in the rain
  unless something is over your head.
- **Lamps**: diya +3 s, candle +5 s, lantern +8 s, capped at the level's
  maximum. Run through them.
- **Moves**: run, jump (hold for higher), coyote time and jump buffering.
  Double jump (from level 2) and dash (from level 3) each burn 1 s.
- **Checkpoint**: one per level, a ring of runes between two braziers. Step
  on it: the braziers light, your life tops up, and that's where you come
  back. Lamps you burned before it stay burned.
- **Unlimited lives.** Fall, touch water or burn out and you're back at
  your last checkpoint (or the start) with its life.
- **Goal**: a ring of flames under a beam of light. In level 9, the
  Eternal Fire itself.

## Things that don't last

| | |
|---|---|
| Paper | catches 0.45 s after you land, gone 0.55 s later, back after 5 s |
| Wax | sinks under you (0.55 m/s) until it's gone; recovers when you leave |
| Glass | there for a few seconds, gone for a few; flickers before it goes |
| Moving stone | sways, lifts or slides; rune band round its middle |
| Water | between stones: touch it and you're out |
| Drops | fall from the dark on a beat; a shadow darkens under each; −4 s |
| Wind | gusts across your path; dust stirs before each one |
| Rain | level 7: everywhere, except under the roofs |
| Collapse | level 9: from the checkpoint on, the route falls away behind you, one platform every 1.4 s (the bot survives down to 0.9 s) |
| Crumbling stone | levels 8–9: glowing cracks; falls 0.9 s after you touch it, back only when you respawn |

## Levels (shared/levels.js)

| # | Name | New | Life / max |
|---|---|---|---|
| 1 | Kindling | run, jump, lamps | 12 / 18 |
| 2 | Updraft | double jump | 10 / 16 |
| 3 | Paper Bridges | paper, dash | 9 / 14 |
| 4 | Wax Garden | wax, moving stones | 9 / 14 |
| 5 | Drip | water, drops, glass | 10 / 14 |
| 6 | Draft | wind | 7 / 12 |
| 7 | Monsoon | rain, roofs | 8 / 12 |
| 8 | Ashfall | everything, tighter | 10 / 13 |
| 9 | Will of Fire | the climb to the Eternal Fire | 9 / 11 |

Difficulty: the bot's lowest life falls from about 11 s on level 1 to about
3 s on levels 8 and 9, gaps widen, platforms shrink, and hazards stack.

## Replay and feel

- **Bonus lamps**: every level has a lantern on a platform off the route.
  The HUD counts lamps burned; the test proves each bonus platform can be
  reached and left.
- **Run timer** in the HUD, with a gold/silver/bronze dot for your pace.
- **Key prompts** float over the first gaps that need jump, double jump
  and dash.
- **Gamepad**: left stick move, right stick look, A jump, B/X/RB dash,
  Y back to checkpoint, Start pause.

- **Par times**: gold and silver per level (about 1.3× and 1.8× the bot's
  time; the test checks gold stays possible). Medals and lamps burned show
  on the results card and the level select.
- **Ghost**: your best run of each level plays back as a pale blue flame.
  (Settings can hide it.)
- **Shadow and landing ring** under you, so you can judge jumps in 3D.
- Camera shake on hard landings, drops and going out; the view widens when
  you dash or fall fast; dust when you land; sparks stream into you from
  each lamp you burn.
- The title screen is the furthest level you've reached, idling behind the
  menu.

## Sound

Each level has its own ambience under the pads: wind chimes (1–2), paper
rustle (3), a wax hum (4), drips (5), howling wind (6), thunder (7),
distant rumbles (8), and in level 9 the Will of Fire's theme on a soft bell,
the Eternal Fire's roar as you near it, and the ground shaking during the
collapse.

## Assist and results

- **Assist** (Settings): life drains 30% slower. Assist runs don't set best
  times or ghosts, and say so.
- **Final screen**: this playthrough's total time and deaths, every level's
  best time and medal, lamps found, and a "Copy my result" button that puts
  a short share text (medal emoji row, time, lamps, link) on the clipboard.

## Ending

You step into the Eternal Fire and become part of it. The camera pulls away
until it is one light among many in the dark:

> You were never meant to last. / No flame is. / But the fire you carried is
> still burning, / and somewhere, a new spark is being lit from it.

## How it's built

- `shared/physics.js`: the flame's movement and collisions (pure).
- `shared/sim.js`: a level being played: platforms, hazards, lamps, life,
  checkpoint, goal (pure).
- `shared/bot.js`: plays a level hop by hop; plans waits by trying the next
  hop in a copy of the level.
- `src/`: three.js rendering, the flame, the world, sound (all synthesised),
  HUD and menus. The game runs the same simulation at a fixed 120 Hz.
