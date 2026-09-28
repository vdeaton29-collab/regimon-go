# 👑 Regimon GO

A Pokémon GO–style catching game set around **Regis High School** on the Upper East Side of Manhattan.
Explore the neighborhood from Central Park to the East River, spin stops, and catch 62 original Regis-themed
creatures, from the humble **Homeworm** to the legendary **Ignatiger**, **Regisaurus** and **Mayorca**.
Then battle AI trainers in turn-based fights and win badges from six arena leaders. Includes a chiptune
soundtrack and sound effects, synthesized live with Web Audio.

**▶ Play:** https://vdeaton29-collab.github.io/regimon-go/

## How to play

| | |
|---|---|
| 🚶 **Walk** | Tap or hold on the map, or use WASD / arrow keys |
| 👆 **Encounter** | Tap a Regimon inside your dotted circle |
| ⚾ **Throw** | Swipe the ball upward. Land it inside the shrinking ring for a Nice / Great / Excellent bonus |
| 🔷 **Stops** | Spin the blue diamonds for Regi Balls, Honors Balls, Magna Cum Balls and Bagels |
| 🥯 **Bagels** | Feed one before throwing to make the next catch easier |
| ⚔️ **Battle** | Tap an arena tower or a student with a **!** and pick up to 3 Regimon. Each has 4 moves (attacks, heals, buffs); use type matchups for super-effective damage |
| 🗺️ **Map** | Open the overview map and tap anywhere to walk there |

### Arena leaders

| Arena | Leader | Team |
|---|---|---|
| Great Lawn | Ranger Rosa | Grass |
| Regis Gym | Coach Malone | Athletic |
| Second Ave Station | Conductor Kay | Steel / Dark |
| Guggenheim | Curator Vance | Brainy / Ancient |
| Asphalt Green | Captain Ruiz | Athletic / Water |
| Gracie Mansion | The Mayor | Legendary finale |

Each area has its own Regimon:

| Area | Look for |
|---|---|
| 💧 The Reservoir & Turtle Pond | Tadpolemic, Quackademic, Joggerfish, Belveturtle, Swanctus, Koinē, Aquinautilus |
| 🌳 Central Park | Squirrelio, Frisbeaver, Dandelyon, Oakolyte |
| 📚 Regis High School | Owlgebra, Quizard, Chalkodile, Bunsenbunny, Scholarshark, Regisaurus |
| ✨ St. Ignatius Loyola | Jesuitoad, Candlewick, Pewsqueak, Organgutan, AMDGator, Ignatiger |
| 🏺 The Met | Armorillo, Monetkey, Mummichog, Dendurtle |
| 🚇 86th St Station | Subwayrm, Pizzarat, MetroCardinal |
| 🚕 The avenues & Yorkville | Bagelhog, Taxicrab, Hotdachs, Doormanatee, Pretzeleon, Hydrantula, Bodegato |
| 🌊 The East River | Tugotter, Gatekeel, Seagullible, Ferryt, and the legendary Mayorca |
| 🏅 Asphalt Green & the Ballfields | Dribbluff, Goaliebear, Sprintah, Poolphin, Crewcoon, Victorhino |
| 🌀 The Guggenheim | Spiralynx, Abstractopus |

Your progress (Regidex, catches, items, level) is saved in your browser.

## Tech

Plain HTML, CSS and JavaScript with no build step and no dependencies. Every creature is drawn as SVG
in code (`js/art.js`), and the map is a canvas rendering (`js/game.js`).

```
index.html     page and UI shell
style.css      styles
js/data.js     creatures, stops, world constants
js/art.js      procedural creature art
js/music.js    chiptune music + sound effects (Web Audio)
js/battle.js   turn-based trainer battles, moves, type chart, AI
js/game.js     map, spawning, catching, Regidex
```

To run it locally, serve the folder with any static server, for example `python -m http.server`, then open http://localhost:8000.

---

*A fan-made game. It is not affiliated with Regis High School, Nintendo, Niantic or The Pokémon Company.
All creatures are original.*
