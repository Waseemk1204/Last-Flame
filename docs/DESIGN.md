# LAST FLAME — Game Design

> *You can't stay. You can only pass the light on.*

BYOG 2026 · theme **Everything is Temporary** · 3D · browser · keyboard + mouse · 10–15 minutes.

## The pitch

Diwali night. A storm has blown out every lamp in the galli and the power is
gone. On a doorstep, a little girl, **Munni**, strikes the last match in the box
and sets it down by the first diya of the night.

You are that flame. Every body you burn in dies: the match in seconds, a diya
in a little longer, a sparkler in a blink. To live, you leap. To win, you climb
the whole neighbourhood, rooftop by rooftop, to the old temple on the hill and
light its great lamp before dawn, lighting every diya you can on the way.

You will not survive the night. Nothing that burns does. But the street behind
you will be glowing.

## Pillars

1. **One verb: leap.** Aim at something that can burn, release, fly. Fun in ten seconds.
2. **Everything you are is running out.** A burn timer is your health, your
   clock and your fuel. There is no standing still.
3. **What you leave behind is the score.** Every diya you light stays lit. Look
   back and the street you climbed is glowing.
4. **Warm, not grim.** Festival night, colour, firecrackers far off, kids,
   rangoli. It's bittersweet, not horror.

## How it plays

### The flame
- You are a small living flame sitting on a **host** (something flammable).
- Each host burns for a while, then dies. Its fuel bar is the ring around the
  crosshair; it flickers and shrinks as the end comes.
- **Leap:** look at another host within range: a dotted arc shows the jump.
  Click (or press Space) to leap. The flight takes under a second. Landing
  lights the new host, and you live as long as it does.
- **Ember:** when a host dies under you, you become a falling **ember** for
  1.5 seconds. You can still leap, but only a short way. If you land nowhere,
  you go out and return to the last checkpoint.

### Hosts (what you can burn)
| Host | Burns | Leap range | Notes |
|---|---|---|---|
| **Matchstick** | 5 s | short | The first body. |
| **Diya** | 12 s | medium | **Stays lit when you leave**: +1 lamp. The main score. |
| **Candle** | 20 s | short | A safe, slow rest. |
| **Agarbatti** (incense) | 30 s | very short | A smouldering ember: a long, safe wait, hard to leave. |
| **Phuljhadi** (sparkler) | 4 s | **long** | Spits sparks, burns fast, flings you far. |
| **Rocket** | 1.5 s | — | Launches you **straight up** a building, then you choose where to land. |
| **Kandeel** (paper lantern) | 25 s | medium | Floats upward slowly and drifts with the wind. A lift. |
| **Akhand deep** (big brass lamp) | ∞ | medium | **Checkpoint.** Lighting one saves your progress. |

### Hazards
- **Wind:** gusts sweep across open rooftops (you see streaks of dust and
  leaves first). An exposed flame burns 3× faster in a gust. Candles inside
  lanterns and diyas in niches are sheltered.
- **Rain:** the storm's last showers fall over parts of the route. Exposed hosts burn 2× faster.
- **Water:** puddles and buckets put you out if you land in them; some diyas sit beside them.
- **Kids with water pistols:** on the terraces, kids spray along a line every
  few seconds. A hit turns you into an ember.

### Checkpoints
Big brass **akhand deep** lamps sit at the start of each section. Light one
and it's your respawn point; it also saves to the browser, so Continue works.

## The route: one climb, four parts

1. **The Doorstep** (tutorial): Munni's courtyard. A matchstick, a row of diyas
   on the steps, the first candle, the first rocket up to the roof. Teaches leap,
   fuel and the ember.
2. **The Galli**: the lane's rooftops and balconies. Diyas on parapets, candles in
   windows, clotheslines, a sleeping dog, the first wind. Kandeels lift you to
   the higher roofs.
3. **The Terraces**: kids' fireworks. Sparklers and rockets to vault the gaps
   between buildings, kids with water pistols, rain coming in.
4. **The Temple Steps**: a long stair of diyas up the hill in the rain, then the
   temple's great lamp. Light it.

## The ending
The great lamp catches. The camera pulls back down the hill and over the
galli. Every diya you lit is still burning, a line of light from Munni's
doorstep to the temple. Fireworks. Then your little flame on the temple lamp
gutters and goes out, and the screen says:

> **You lit 37 of 52 lamps.**
> **Every one of them was out by morning.**
> **They were beautiful while they lasted.**

The results show lamps lit, time, and times you went out.

## Controls
| | |
|---|---|
| Mouse | look around (the camera orbits the flame) |
| Click / Space | leap to the host you're looking at |
| Esc | pause |

That's all. No WASD: you can't walk; you can only leap.

## Look and sound
- **Night, warm and cool:** deep blue sky with monsoon clouds, cool moonlight
  on whitewashed and pastel walls (pink, turquoise, yellow), warm pools of
  diya light with bloom. Rangoli on the courtyard floor. Strings of dead
  fairy-light bulbs. Fireworks far away on the horizon.
- **You:** a teardrop flame with a bright core, flickering, leaning in the wind,
  shedding sparks when you leap.
- **Sound:** your crackle (louder as you die), a whoosh on the leap, a soft
  *pomp* as a wick catches, a chime when a diya lights (a rising scale as you
  chain them), distant crackers and dogs, wind, rain, a gentle drone that
  swells at checkpoints.
