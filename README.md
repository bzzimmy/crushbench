# CrushBench

CrushBench measures how well LLMs play Candy Crush. The model gets the board as JSON and replies with a move; an optional image mode sends a screenshot instead, so you can compare the same model playing from text and from vision.

It runs the real game. King's original 2011 Flash Candy Crush (the pre-Saga king.com arcade version) is emulated by [Ruffle](https://ruffle.rs) in headless Chromium, with a small ActionScript bridge patched in so the harness can read the board, make swaps, and step the clock. The match engine, cascades, special candies and scoring are King's own code.

**Status:** foundation only. The game runs headless and deterministically under harness control. No model runner yet.

## Setup

```sh
brew install openjdk            # for the FFDec decompiler
bun install && bunx playwright install chromium
bun run setup:ffdec             # JPEXS FFDec CLI -> tools/ffdec/
bun run setup:swf               # original SWF -> game/original/ (not committed)
bun run build:swf               # game/patch/ -> game/build/CandyCrush.swf
bun run smoke                   # boot, play 5 moves, write out/*.png
bun run random 1                # a full game of random legal moves
```

## How it works

```
game/original/CandyCrush.swf   King's SWF (not committed)
game/patch/scripts/            ActionScript we change; FFDec recompiles it into the SWF
game/build/CandyCrush.swf      patched SWF the harness loads
web/index.html                 Ruffle host page
src/game/RuffleGame.ts         Playwright driver: launch / state / legalMoves / swap / screenshot
```

King's engine already talks to its host page: on start the SWF calls `getGameData()` and expects XML containing a `randomseed`. Our page answers that call, so the seed is ours without touching game code, and because everything downstream is a seeded Mersenne Twister, a seed always produces the same game.

The patch replaces the wall clock with one the bridge advances by hand. Nothing moves between calls: `swap()` runs ticks until the cascade settles and returns the new state, so the game is turn-based and thinking time is free. Swaps go through the game's own `Board.trySwap`; illegal ones animate and bounce back as they would for a human. Hints are disabled so screenshots never leak a move, and the arcade site's score POST at game over (which navigated the page away) is removed.

The original 240-second clock still runs during animations, which works out to roughly 150–200 moves per game. `timeLimitSeconds` is configurable.

### State and moves

`board[y][x]` is `[color, special]`. Colors: 1 blue, 2 green, 3 orange, 4 purple, 5 red, 6 yellow, 0 none. Special is a bitmask: 16 striped horizontal, 128 striped vertical, 8 wrapped, 32 colour bomb. A move is `[x0, y0, x1, y1]` between orthogonally adjacent cells, and is legal if it makes a line of 3+, swaps two specials, or involves a colour bomb — the same rules the game applies.

## Legal

King owns Candy Crush. This is a personal research project; the SWF and decompiled source are not redistributed.
