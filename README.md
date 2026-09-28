# 👑 Regimon GO

A Pokémon GO–style catching game set around **Regis High School** on the Upper East Side of Manhattan.
Walk around 84th Street, spin stops, and catch 25 original Regis-themed creatures, from the humble
**Homeworm** to the legendary **Ignatiger** and **Regisaurus**.

**▶ Play:** https://vdeaton29-collab.github.io/regimon-go/

## How to play

| | |
|---|---|
| 🚶 **Walk** | Tap or hold on the map, or use WASD / arrow keys |
| 👆 **Encounter** | Tap a Regimon inside your dotted circle |
| ⚾ **Throw** | Swipe the ball upward. Land it inside the shrinking ring for a Nice / Great / Excellent bonus |
| 🔷 **Stops** | Spin the blue diamonds for Regi Balls, Honors Balls, Magna Cum Balls and Bagels |
| 🥯 **Bagels** | Feed one before throwing to make the next catch easier |

Each area has its own Regimon. Look for Owlgebra and Quizard inside Regis, Jesuitoad and Candlewick at
St. Ignatius Loyola, Armorillo and Dendurtle at the Met, Squirrelio and Reservortex in Central Park,
and Subwayrm down at 86th St.

Your progress (Regidex, catches, items, level) is saved in your browser.

## Tech

Plain HTML, CSS and JavaScript with no build step and no dependencies. Every creature is drawn as SVG
in code (`js/art.js`), and the map is a canvas rendering (`js/game.js`).

```
index.html     page and UI shell
style.css      styles
js/data.js     creatures, stops, world constants
js/art.js      procedural creature art
js/game.js     map, spawning, catching, Regidex
```

To run it locally, serve the folder with any static server, for example `python -m http.server`, then open http://localhost:8000.

---

*A fan-made game. It is not affiliated with Regis High School, Nintendo, Niantic or The Pokémon Company.
All creatures are original.*
