# Memory Chiess

A cute color memory game for 2 to 4 players, sharing one iPhone or iPad.

**Play:** https://marlonsteiner.github.io/memory-chiess/

To install it, open the link in Safari, tap Share, then Add to Home Screen. It works offline after the first visit.

## Rules

1. Roll the dice: five colors, and a sixth black side that ends your turn.
2. Tap one hidden chip on the round board. If it matches the dice, you keep it for one point and roll again.
3. If it doesn't match, it hides again in the same spot and your turn ends.
4. When all 20 chips are gone, the most points wins.

A color with no chips left is rolled again.

## Play online

Tap Play online, create a room and share the 5-letter code or invite link. Up to 4 players join from their own phones, and the host starts the game. If a phone locks or the app closes, tap Rejoin room on the menu.

Phones connect through HiveMQ's free public MQTT relay, so there is no server to run. Room data is encrypted with a key made from the room code, and rooms disappear from the relay after a day. The relay has no uptime guarantee; swapping it means changing `net.js`.

## Run locally

```bash
python3 -m http.server 4180
```

Plain HTML, CSS and JavaScript, no build step. All the art is drawn as SVG in `art.js`.
