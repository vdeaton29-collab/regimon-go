# 👑 Regimon GO

A Pokémon GO–style catching game set around **Regis High School** on the Upper East Side of Manhattan.
Explore the neighborhood from 83rd to 96th Street and from Central Park to the East River, spin stops, and
catch 80 original Regis-themed creatures, from the humble **Homeworm** to elite Regimon like **Wyrmhattan**
and **Solregis**. Then fight AI trainers in real-time battles, win badges from nine arena leaders, and climb
the ranked Battle League. Includes a chiptune soundtrack and per-type attack effects and sounds, all
generated live in code.

**▶ Play:** https://vdeaton29-collab.github.io/regimon-go/

## How to play

| | |
|---|---|
| 🚶 **Walk** | Tap or hold on the map, or use WASD / arrow keys |
| 👆 **Encounter** | Tap a Regimon inside your dotted circle |
| ⚾ **Throw** | Swipe the ball upward. Land it inside the shrinking ring for a Nice / Great / Excellent bonus |
| 🔷 **Stops** | Spin the blue diamonds for Regi Balls, Honors Balls, Magna Cum Balls and Bagels |
| 🥯 **Bagels** | Feed one before throwing to make the next catch easier |
| 🗺️ **Map** | Open the overview map and tap anywhere to walk there |

## Battles

Battles are real-time, like Pokémon GO's battle league:

- **Hold** the field or the 👊 button to use your **fast attack**. Each hit builds ⚡ **energy points**.
- Spend energy on one of two **special attacks**. The button lights up when you can afford it. Time the
  power meter for up to 100% damage. Some special attacks burn, stun, drain HP, raise your attack or lower
  the foe's defense.
- Each side has **2 shields** that block a special attack. Smart opponents try to bait your shields out with
  cheap attacks before firing their big one.
- **Switch** Regimon every 30 seconds. Type matchups matter: super-effective hits deal 1.6× damage.
- Elite and legendary Regimon have a ★ **signature ability**, such as *Skyline Breaker*, *Crown of the Sun*
  or *Hell Gate Maelstrom*.
- Every Regimon that fights gains CP.

Keyboard: hold **Space** to attack, **1** / **2** for special attacks, **S** to shield.

### Arena leaders

| # | Arena | Leader |
|---|---|---|
| 1 | Great Lawn | Ranger Rosa |
| 2 | Regis Gym | Coach Malone |
| 3 | Second Ave Station | Conductor Kay |
| 4 | Guggenheim | Curator Vance |
| 5 | Asphalt Green | Captain Ruiz |
| 6 | Gracie Mansion | The Mayor |
| 7 | 92NY | Maestro Lin |
| 8 | Cooper Hewitt | Designer Okafor |
| 9 | Mill Rock Island | The River Keeper (champion) |

### Battle League

Ranked battles against AI trainers near your rating. Win points to climb Freshman → Sophomore → Junior →
Senior → Varsity → Captain → Valedictorian. Opponents get stronger and smarter as your rating rises.

## Where to find Regimon

| Area | Look for |
|---|---|
| 💧 The Reservoir & Turtle Pond | Tadpolemic, Quackademic, Joggerfish, Belveturtle, Swanctus, Koinē, Aquinautilus, Onyxolotl |
| 🌳 Central Park | Squirrelio, Frisbeaver, Dandelyon, Oakolyte, Umbrawolf, Stormcaw |
| 📚 Regis High School | Owlgebra, Quizard, Chalkodile, Bunsenbunny, Scholarshark, Scholardrake, Regisaurus, Solregis |
| ✨ St. Ignatius, Heavenly Rest & the Islamic Cultural Center | Jesuitoad, Candlewick, Pewsqueak, Organgutan, Seraphalcon, Pyrrhonix, AMDGator, Ignatiger |
| 🏺 The Met, Guggenheim, Cooper Hewitt & Jewish Museum | Armorillo, Monetkey, Mummichog, Spiralynx, Abstractopus, Gearadon, Aegisaurus, Dendurtle |
| 🎼 92NY | Crescendragon, Frostbyte, Chimechu |
| 🚇 86th & 96th St stations | Subwayrm, Pizzarat, MetroCardinal, Voltergeist, Magmalith |
| 🚕 The avenues, Yorkville & Carnegie Hill | Bagelhog, Taxicrab, Hotdachs, Doormanatee, Pretzeleon, Hydrantula, Bodegato, and the legendary Wyrmhattan |
| 🌊 The East River & Mill Rock | Tugotter, Gatekeel, Seagullible, Ferryt, Tempestar, Kraketeer, Riftdrake, and the legendary Mayorca |
| 🏅 Asphalt Green, the Ballfields & Tennis Center | Dribbluff, Goaliebear, Sprintah, Poolphin, Crewcoon, Glaciator, Victorhino |

Your progress (Regidex, catches, items, badges, league rating) is saved in your browser.

## Tech

Plain HTML, CSS and JavaScript with no build step and no dependencies. Every creature is drawn as SVG in
code, the map is canvas tiles drawn on demand, and all music and sound effects are synthesized with Web Audio.

```
index.html     page and UI shell
style.css      styles
js/data.js     creatures, stops, arenas, world constants
js/art.js      procedural creature art
js/music.js    chiptune music, attack sounds and effects (Web Audio)
js/battle.js   real-time battles: energy, shields, type chart, AI, particle effects
js/game.js     map, spawning, catching, Regidex, Battle League
```

To run it locally, serve the folder with any static server, for example `python -m http.server`, then open http://localhost:8000.

---

*A fan-made game. It is not affiliated with Regis High School, Nintendo, Niantic or The Pokémon Company.
All creatures are original.*
