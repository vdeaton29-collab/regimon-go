# 👑 Regimon GO

A Pokémon GO–style catching game that starts at **Regis High School** on 84th Street and covers
**all of Manhattan from 97th Street down to the Battery**, the harbor islands, and **Hoboken, Jersey City,
Union City and Weehawken** across the Hudson. Catch 103 original Regimon, from the humble **Homeworm** to the
Celestial **Metropolaris** and **Libertitan**, then fight AI trainers in real-time battles.

**▶ Play:** https://vdeaton29-collab.github.io/regimon-go/ (installable, and works offline after the first visit)

## Two ways to play

| Mode | How it works |
|---|---|
| 🎮 **Explore** | Tap or hold the map (or use WASD / arrow keys) to walk. Open the map to fast-travel anywhere. Works offline. |
| 🛰️ **Live GPS** | Your real location moves you. Walk around Manhattan or Hudson County to find Regimon near you. Your browser will ask for location access. |

Switch modes any time from the 👑 menu or the mode badge in the top-left corner. Pinch or scroll to zoom the map.
Stay aware of your surroundings when playing in Live mode.

## The map

Real geography: the tilted Manhattan street grid with every numbered street and avenue, Broadway, Central Park
(the Reservoir, the Great Lawn, the Lake), the High Line, the bridges, and more than 100 landmarks.
Every landmark is a stop. Each neighborhood has its own Regimon:

| Area | Look for |
|---|---|
| 🏙️ Midtown | Neonoir, Skyscraptor, Vesselith, Chronowl, and the Mythic Empyreon |
| 📈 Financial District | Bullion, Bearish, Tickertaper, Oculuxe, and the Celestial Metropolaris |
| 🗽 New York Harbor | Ellisprite, Tugotter, and the Celestial Libertitan |
| 🌉 Hoboken, Jersey City & Union City | Cannolisk, Palisaur, Salsamander, Hamiltron, Pathfinder |
| 🏮 Chinatown | The Legendary Lanternwyrm |
| 🌊 The Hudson & East Rivers | Hudsonyx, Kraketeer, Riftdrake, Bridgoyle, Gatekeel, Mayorca |
| 🚇 Subway & PATH stations | Subwayrm, Pizzarat, Voltergeist, Magmalith, and the Mythic Voidrail |
| 📚 Regis & other schools | Owlgebra, Quizard, Scholardrake, Regisaurus, Solregis |
| 🌳 Parks | Squirrelio, Highlinx, Umbrawolf, and the Mythic Solhenge |

**Rarities:** Very Common → Common → Uncommon → Rare → Legendary → **Mythic** → **Celestial**. The rarest appear
under a beam of light. About 1 in 64 Regimon is a ✨ **shiny** with different colors.

## Battles

Real-time, like Pokémon GO's battle league: hold to fast-attack and build ⚡ energy, spend it on special attacks
(time the meter for full power), and use your 2 🛡️ shields wisely. Elite Regimon have ★ signature abilities
with their own effects and sounds. Beat all **15 arena leaders**, from Ranger Rosa on the Great Lawn to the
Harbor Guardian on Liberty Island, and climb the ranked **Battle League** from Freshman to Valedictorian.

## Tech

Plain HTML, CSS and JavaScript with no build step and no dependencies. The map is drawn from hand-entered
geography (shorelines, street grids, parks, landmarks) projected from latitude and longitude, so GPS positions
line up with it. Every creature is SVG drawn in code, and all music and sound is synthesized with Web Audio.
A service worker caches the game for offline play.

```
index.html            page and UI shell
style.css             styles
sw.js                 offline cache (service worker)
manifest.webmanifest  install as an app
js/geo.js             geography: projection, shorelines, grids, parks, landmarks
js/data.js            creatures, rarities, arenas
js/art.js             procedural creature art (and shiny variants)
js/music.js           chiptune music, attack sounds and effects
js/battle.js          real-time battles: energy, shields, type chart, AI, particle effects
js/game.js            map rendering, GPS, spawning, catching, Regidex, Battle League
```

To run it locally, serve the folder with any static server, for example `python -m http.server`, then open http://localhost:8000.

---

*A fan-made game. It is not affiliated with Regis High School, Nintendo, Niantic or The Pokémon Company.
All creatures are original. Map geometry is approximate.*
