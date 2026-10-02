# PRD: FETCH TOWER

A recap game for AI Project Lab 3, Week 2. Built by Aasees, played by students after class.

## 1. What it is

A Pokémon tower climb. Each floor is a real fight: you move around, wild Pokémon chase you, your starter attacks on its own, and you survive until the floor timer ends. Every Pokémon uses live stats from PokéAPI.

Between floors there is a locked door. The only way to open a door is to do a real step from the Week 2 lesson (fetch data, read JSON, check your tools, push your repo). The doors are checked by the server, so they can't be cheated from the browser.

Each door has hints that unlock over time. Students get 30 seconds to try it on their own first, then a new hint every 30 seconds. If they're still stuck, the hints get more and more specific until the last hint basically walks them through it. Even the last hint never gives the answer itself, they still have to do the step.

## 2. Who it's for

Lab 3 students, ages 12 to 14, on Windows laptops, who just finished Week 2. They play it at home after class to recap the lesson. Three students right now, so the leaderboard is small and competitive.

## 3. Goals

1. Students redo every key step of Week 2 on their own, because the game won't let them progress otherwise.
2. The game is fun enough on its own that they want to climb higher than each other.
3. I can see who actually pushed their repo (Door 5 checks it).
4. The tower can grow every week with new floors and doors.

## 4. Core game loop

1. Pick a nickname and a starter on the title screen.
2. Tower map shows floors stacked up. Current floor is open, the next door is locked.
3. Enter the floor. Survive the timer while wild Pokémon chase you.
4. Floor cleared. Walk up to the door.
5. Door asks a lesson question. Answer it right and the next floor opens.
6. Repeat to the top. The boss floor clears Week 2.

If your HP hits 0, you retry the same floor, unless you have an extra life (see section 5). You never lose a door you already opened.

## 5. The arena (each floor)

- **Movement:** WASD or arrow keys. Player stays inside the arena.
- **Your starter:** follows the player and auto-attacks the nearest wild Pokémon. It is your lead by default (see Squad).
- **Wild Pokémon:** spawn from the edges in small waves and walk toward the player. Their speed, HP and damage come from their real PokéAPI stats.
- **Contact damage:** a wild Pokémon touching the player deals its damage, with a 0.5 second invincibility window after each hit.
- **Floor timer:** shown at the top. When it hits 0, remaining wild Pokémon run away and the floor is cleared.
- **Catching:** when a wild Pokémon is below 20% HP it gets a pulsing ring. Press C to throw a ball. One throw per Pokémon, a miss uses it up. Catch chance is 60%. Caught Pokémon go into the Pokédex screen and join your squad. Catches add to score.
- **Stat card:** the first time a new Pokémon species appears on a floor, a small card slides in for 3 seconds showing its raw PokéAPI stats on the left and the game numbers on the right. This repeats the "JSON to game numbers" idea from class without a lecture.

### Stat mapping (same idea as the lesson)

| PokéAPI stat | Game number | Formula | Cap |
|---|---|---|---|
| hp | Max HP | hp × 2 | min 40, max 300 |
| attack | Damage per hit | attack ÷ 5, rounded | min 4, max 30 |
| speed | Move speed (px/s) | 40 + speed × 1.2 | min 70, max 200 |

The player's starter uses the same formulas for its HP, damage and speed.

The stat card always shows these exact numbers. To keep the game fair and fun, extra multipliers sit on top of them (player HP, lead damage, attack speeds, wild HP, contact damage, miss chance). They all live in `src/data/balance.js` so they can be tuned without touching the formulas.

### Squad

- When you catch a Pokémon, it joins your squad and follows behind you in a little line.
- The squad holds up to 3 caught Pokémon plus your starter. If it's full, the new catch replaces the oldest one.
- Every squad member auto-attacks the nearest wild Pokémon with its own type-coloured projectile, using its own mapped damage.
- One member is the **lead**: it walks closest to you and attacks fastest and hardest. Squad members attack more slowly (every 0.8 seconds), so the lead stays the main attacker. Your starter is the lead until you swap.
- Press 1, 2, 3 or 4 to choose the lead. The squad is shown as 4 small portrait slots at the bottom of the screen with the number key on each, and the lead is highlighted.
- The squad carries over between floors for the rest of the session and resets when you close the game. Caught Pokémon still go to the Pokédex permanently.

### Catch rewards

- Each catch raises your max HP by 10% of your base max HP (capped) and heals you for 25% of your max HP.
- The HP bar grows a little longer with a short glow, and "+MAX HP" pops up over the player.

### Extra lives

- Every 3 catches on a floor gives you an extra life, shown as small hearts next to the HP bar (max 3).
- If you faint with an extra life, you come back right away with half HP and 2 seconds of invincibility instead of the "You fainted" screen.
- Extra lives reset at the start of each floor.

### Starters

| Pokémon | PokéAPI number |
|---|---|
| Bulbasaur | 1 |
| Charmander | 4 |
| Squirtle | 7 |
| Pikachu | 25 |

## 6. Floors (Week 2)

| Floor | Wild Pokémon (PokéAPI numbers) | Timer | Door after it |
|---|---|---|---|
| 1 | Rattata (19), Pidgey (16) | 60 s | Door 1 |
| 2 | Spearow (21), Ekans (23) | 75 s | Door 2 |
| 3 | Zubat (41), Geodude (74) | 75 s | Door 3 (+ the fake door on the map) |
| 4 | Machop (66), Ponyta (77) | 90 s | Door 4 |
| 5 | Gastly (92), Onix (95) | 90 s | Door 5 |
| Boss | Snorlax (143), with a few Rattata | 120 s | Week 2 cleared |

Above the boss floor, the map shows locked floors labelled "Week 3: coming soon" and so on up to Week 6.

## 7. Doors

Every door has:
- A question
- An answer box and a Submit button
- Wrong answer messages that point at the mistake without giving the answer
- 3 hints on a timer (see section 8)

Answers are sent to the server and checked there. The real answers are never in the browser code.

### Door 1: Fetch the guardian
**Question:** "The guardian of Floor 1 was Pokémon #19. Fetch it from PokéAPI. What is its HP?"
**Correct:** `30`
**Wrong answer messages:**
- `35`: "That's Pikachu's HP. The guardian is #19."
- `72`: "Close, but that's its speed. Look for the stat named hp."
- anything else: "Not quite. Did you fetch #19 and open stats?"

### Door 2: Find its picture
**Question:** "Paste the link to the guardian's picture."
**Correct:** any text that contains `/pokemon/19.png`
**Wrong answer messages:**
- a link with a different number: "That's a picture of a different Pokémon. You need #19."
- a link containing `back_default` or `/back/`: "That's its back. Find the front picture."
- anything else: "That's not the picture link. It starts with https and ends in .png."

### Door 3: Prove your tools work
**Question:** "Type exactly what `node --version` says on your laptop."
**Correct:** matches `v` + a number 22 or higher (for example `v22.11.0`)
**Wrong answer messages:**
- version below 22: "Your Node is too old. Install the LTS version from nodejs.org, then close and reopen VS Code."
- no `v` at the start or not a version: "That doesn't look like a version. It should start with v, like v22.11.0."

### Door 4: Install the right engine
**Question:** "What command installs the game engine we use in class?"
**Correct:** `npm install phaser@3` or `npm i phaser@3` (ignore extra spaces and capitals)
**Wrong answer messages:**
- `npm install phaser` (no version): "That installs Phaser 4. This course uses Phaser 3."
- `phaser@4` or any other version: "Wrong version. Which Phaser does this course use?"
- anything else: "That's not an install command. It starts with npm."

### Door 5: Show me your repo
**Question:** "Type your GitHub username. I'll check your poke-arena repo."
**Check (server side):** GitHub public API
1. User exists
2. Repo `poke-arena` exists for that user
3. `PRD.md` exists in that repo

**Wrong answer messages:**
- user not found: "I can't find that GitHub user. Check the spelling."
- no repo: "Found you, but there's no poke-arena repo yet."
- repo but no PRD.md: "Found your repo, but there's no PRD.md in it. Did you commit and push it?"

### The fake door (Floor 3 map)
A side door with a sign: "Too lazy to climb? Try `tower.forceOpen()` in the Console."
Running `tower.forceOpen()` in the browser Console sends a request to the server, which refuses it.
**Console shows:** `SERVER REFUSED 403: "That door was never unlocked on the server."`
**On screen:** the door shakes and a sign appears: "How did the server know? Unlocks in Week 5."

## 8. Hint system

Each door starts a hint timer the first time the student reaches it. The timer keeps counting if they leave and come back.

| Time at the door | What appears |
|---|---|
| 0:00 | "Try it yourself first. Hints unlock as time passes." Hint slots show as locked with a countdown. |
| 0:30 | Hint 1: a nudge in the right direction |
| 1:00 | Hint 2: where to look and what to do |
| 1:30 | Hint 3: step by step walkthrough, without the final answer |

Three wrong answers in a row also unlock the next hint early, so a student who's really trying isn't stuck waiting.

### Hint text

**Door 1**
1. "The data lives on PokéAPI. Your browser can ask for it with fetch, like we did in class."
2. "Open the Console with F12. Use the Pikachu fetch line from class, but swap pikachu for 19."
3. "Paste this in the Console: `fetch('https://pokeapi.co/api/v2/pokemon/19').then(r => r.json()).then(console.log)`. Click the arrow to open it, open stats, and find the one where stat.name is hp. The number next to base_stat is your answer. (If Chrome won't let you paste, type `allow pasting` first.)"

**Door 2**
1. "In PokéAPI, pictures are called sprites."
2. "Fetch #19 again and open sprites. You want the front picture."
3. "Open sprites, find front_default, right-click the link next to it, and choose Copy string contents. Paste it here."

**Door 3**
1. "Ask your computer which version of Node it has. You do that in the terminal."
2. "In VS Code, click Terminal, then New Terminal."
3. "Type `node --version` and press Enter. Copy the whole thing it prints (it starts with v) and paste it here."

**Door 4**
1. "The engine is called Phaser."
2. "npm downloads packages. You can choose a version by adding @ and a number."
3. "It's npm install, then the engine name, then @ and the version this course uses. Remember the warning from class about version 4."

**Door 5**
1. "Your poke-arena project needs to be on GitHub."
2. "In VS Code: Source Control, write a message, Commit, then Publish to GitHub and name it poke-arena."
3. "Go to github.com and click your profile picture in the top right. Your username is right there. Make sure PRD.md shows up in your repo before you try again."

## 9. Screens

1. **Title:** game name, nickname box (first name or nickname only), starter picker, Play button.
2. **Tower map:** floors stacked bottom to top, current floor glowing, doors shown as locked or open, the fake door on Floor 3, locked future weeks at the top.
3. **Arena:** the fight, HP bar, floor timer, catch prompt, stat cards.
4. **Door:** question, answer box, wrong answer message, hint slots with countdowns.
5. **Results:** after each floor, shows time survived, Pokémon caught, score.
6. **Leaderboard + Pokédex:** top players by highest floor, then catches. Pokédex shows every Pokémon you caught with its sprite and raw stats.

## 10. Server decides

The browser handles movement, fighting and drawing. The server decides anything that matters for progress:

1. Whether a door answer is correct (answers live only on the server)
2. Which doors a player has opened, and so which floor they can reach
3. Whether a GitHub repo and PRD.md exist
4. What goes on the leaderboard (highest floor comes from the server's record, not from the browser)

Catches and score are sent by the browser, so they could be faked. That's fine for now, and it's a good Week 5 discussion.

## 11. Data

**Firestore collection `players`** (document id = player id)
- `id` string uuid (created in the browser on first play, saved in localStorage)
- `nickname` string, max 16 characters
- `starter` number
- `doorsOpened` array of numbers (door numbers)
- `highestFloor` number
- `catches` number
- `score` number
- `createdAt`, `updatedAt` timestamps

All reads and writes go through Vercel functions using the Firebase Admin SDK with a service account. The browser never talks to Firestore directly, and the Firestore security rules block all client access.

**localStorage (browser)**
- player id, nickname, starter
- hint timers per door
- Pokédex (caught Pokémon) for display

**PokéAPI**
- Fetch each Pokémon once per session and cache it in memory.
- Load sprites with `this.load.setCORS('anonymous')`.

## 12. Tech

- Phaser 3 (pinned with `phaser@3`), Vite vanilla template, plain JavaScript
- Vercel for hosting and serverless functions in `/api`
- Firebase Firestore for players and leaderboard, accessed only through the Firebase Admin SDK in Vercel functions
- PokéAPI for Pokémon data and sprites
- GitHub public API (no login) for Door 5

## 13. API routes

| Route | Method | Does |
|---|---|---|
| `/api/player` | POST | Create or update a player (id, nickname, starter). Returns their doors and highest floor. |
| `/api/door` | POST | Body: player id, door number, answer. Checks the answer on the server. If correct, adds the door to `doorsOpened` and raises `highestFloor`. Returns ok or a wrong answer message. |
| `/api/force-open` | POST | Always returns 403 with `"That door was never unlocked on the server."` |
| `/api/score` | POST | Saves catches and score for a player. |
| `/api/leaderboard` | GET | Top 20 players: nickname, highest floor, catches. |

Door 5 calls GitHub inside `/api/door`.

## 13b. Phones and tablets

- The game is a landscape screen. Held upright, a phone shows "Turn your phone sideways to play!".
- Arena: a joystick appears wherever your left thumb touches; DASH and CATCH buttons sit bottom right. Tap a squad portrait to make it the lead.
- Tower map: drag up and down to look around. Taps open floors and doors; drags never do.
- On Android, pressing Play goes fullscreen and holds landscape. iPhones play in the browser window.

## 14. Out of scope (v1)

1. Logins or passwords. Nickname only.
2. Multiplayer in the same arena.
3. Evolution, items, or level-up cards.
4. Music. (Small sound effects are in: catch clicks, dings, door chimes.)
5. Week 3 to Week 6 floors (map shows them locked).

## 15. Done when

- [ ] A new player can pick a nickname and starter and reach Floor 1
- [ ] Every floor loads its Pokémon from PokéAPI and uses the stat formulas and caps
- [ ] Catching works with C, one throw per Pokémon
- [ ] Caught Pokémon join the squad (max 3 plus the starter, oldest replaced), follow in a line, and attack on their own
- [ ] Keys 1 to 4 swap the lead, shown in the 4 portrait slots
- [ ] The squad carries over between floors and resets when the game is closed
- [ ] Each catch raises max HP by 10% and heals 25%, with "+MAX HP" and a growing HP bar
- [ ] Every 3 catches on a floor gives an extra life (max 3) that revives you at half HP with 2 seconds of invincibility
- [ ] All 5 doors open only with the right answer, checked on the server
- [ ] Wrong answers show the right message
- [ ] Hints unlock at 30, 60 and 90 seconds, and early after 3 wrong answers
- [ ] `tower.forceOpen()` prints the 403 message in the Console
- [ ] Door 5 checks a real GitHub repo for PRD.md
- [ ] Leaderboard shows all players
- [ ] Deployed on Vercel and works on a Windows laptop in Chrome
- [ ] Playable on a phone in landscape with the on-screen joystick and buttons