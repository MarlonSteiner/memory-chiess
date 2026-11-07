# Memory Chiess

A cute color memory game for 2 to 4 players, sharing one iPhone or iPad.

**Play:** https://marlonsteiner.github.io/memory-chiess/

To install it, open the link in Safari, tap Share, then Add to Home Screen. It works offline after the first visit.

## Rules

1. Roll the dice: five colors, and a sixth black side that skips you for the round.
2. Tap one hidden chip on the round board. If it matches the dice, you keep it for one point.
3. If it doesn't match, it hides again in the same spot.
4. When all 20 chips are gone, the most points wins.

A color with no chips left is rolled again.

## Run locally

```bash
python3 -m http.server 4180
```

Plain HTML, CSS and JavaScript, no build step. All the art is drawn as SVG in `art.js`.
