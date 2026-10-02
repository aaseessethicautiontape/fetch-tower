# 🗼 Fetch Tower

**Play it here: https://fetch-tower.vercel.app**

Fetch Tower is a Pokémon tower climb for **AI Project Lab 3, Week 2**. You fight your way up the tower floor by floor. Between floors there is a locked door, and the only way to open it is to do a real step from this week's lesson.

Every Pokémon in the game is **real data from PokéAPI**, the same API we used in class.

---

## How to play

### 1. Pick your name and a starter
Type your **first name or a nickname** on the wooden sign, then pick one of four starters:

| Starter | Type | PokéAPI number |
|---|---|---|
| Bulbasaur | Grass 🌿 | 1 |
| Charmander | Fire 🔥 | 4 |
| Squirtle | Water 💧 | 7 |
| Pikachu | Electric ⚡ | 25 |

Press **PLAY!**

### 2. The tower map
The tower shows every floor stacked up. The **bouncing yellow arrow** shows where you are.
- Tap or click a floor's archway to **fight on that floor**.
- Tap or click a **door** to try to open it.
- Floors above Week 2 are hidden in the clouds. They unlock in later weeks!

### 3. Fight on a floor
Wild Pokémon run at you. **Survive until the timer hits 0** and the floor is cleared.

| | On a laptop | On a phone or tablet (turn it sideways!) |
|---|---|---|
| Move | **WASD** or **arrow keys** | Put your left thumb anywhere and drag (a joystick appears) |
| Dash (quick burst of speed) | **SPACE** | The blue **DASH** button |
| Throw a Poké Ball | **C** | The big yellow **CATCH** button |
| Pick your lead Pokémon | Keys **1 2 3 4** | Tap a portrait at the bottom |

- **You don't attack. Your Pokémon do!** They fire at the nearest wild Pokémon on their own.
- When a wild Pokémon is **low on HP** it gets a **glowing blue ring**. That's your chance: throw a ball! A miss uses up your one throw for that Pokémon.
- If your HP hits 0, you just try the same floor again. You never lose doors you already opened.

### 4. Catching builds your squad
Every Pokémon you catch:
- **joins your squad** and follows you in a line. It fights for you too!
- makes your **max HP bigger** and **heals** you.
- goes into your **Pokédex** forever.

Your squad holds **3 caught Pokémon plus your starter**. Catch a 4th and your oldest one leaves.

Every **3 catches on a floor** gives you an **extra life** ❤️ (up to 3). If you faint with one, you pop right back up!

### 5. Open the door
After you clear a floor, its door asks you to do something from the Week 2 lesson.
- Type your answer and press **GO!**
- If you're wrong, the door tells you **what kind of mistake** you made. Read it, it's a clue!
- **Stuck?** Hint scrolls unlock every **30 seconds**. Hint 3 walks you through it step by step.
- Got it wrong **3 times in a row**? The next hint unlocks early.

Once a door is open, you can tap it again any time to see **the answer and why it's right**.

### 6. Climb to the top
Clear the **Boss floor** to finish Week 2. Check the **TROPHIES** button to see who has climbed the highest!

---

## What each door practises

The doors don't give away answers here. You have to do the step yourself! This is what each one is about:

| Door | It's about | What you'll use |
|---|---|---|
| 1 | Fetching data from an API | `fetch`, the browser Console (F12), JSON |
| 2 | Finding things inside JSON | the `sprites` part of a Pokémon's data |
| 3 | Checking your tools | the VS Code terminal and Node |
| 4 | Installing the right package | `npm` and version numbers |
| 5 | Saving your project online | GitHub and your `poke-arena` repo |

There's also a **mystery door** on Floor 3 made of cardboard. Read its sign... 👀

---

## Big ideas hidden in the game

### 🔢 JSON becomes game numbers
The first time a new Pokémon shows up, a **stat card** slides in. On the left are the **raw numbers from PokéAPI**. On the right are the **numbers the game uses**. That's the same "JSON to game numbers" idea from class:

| PokéAPI stat | Game number | Formula | Smallest | Biggest |
|---|---|---|---|---|
| hp | Max HP | hp × 2 | 40 | 300 |
| attack | Damage per hit | attack ÷ 5, rounded | 4 | 30 |
| speed | Move speed | 40 + speed × 1.2 | 70 | 200 |

**Try it:** Rattata has hp 30. 30 × 2 = **60 Max HP**. Snorlax has hp 160, and 160 × 2 = 320, but the biggest allowed is **300**!

### 🔒 Why can't I just cheat?
The door answers **are not in the game's code**. When you press GO!, your answer is sent to a **server**, and the server decides if it's right. Your browser never sees the answers, so peeking at the code won't help.

That's also why the cardboard door on Floor 3 doesn't work. How did the server know? We'll find out in **Week 5**.

### 🗂️ Where is my progress saved?
- **On the server (Firebase):** which doors you opened, your highest floor, your catches and score. That's what the leaderboard uses.
- **In your browser:** your name, your Pokédex and your hint timers. So use the **same laptop and browser** each time!

---

## For teachers: running and changing the game

### What it's made of
- **Phaser 3** game engine, plain JavaScript, built with **Vite**
- **PokéAPI** for every Pokémon's data and pictures
- **Vercel** hosts the site and runs the server code in `api/`
- **Firebase Firestore** stores players. Only the server talks to it.
- **GitHub's public API** checks Door 5

### Run it on your laptop
1. Copy `.env.example` to `.env.local` and fill in the three `FIREBASE_*` values from the Firebase service account JSON. Keep the `\n` line breaks in the private key.
2. Run:
   ```bash
   npm install
   npm run dev
   ```
3. Open the address it prints (usually http://localhost:5173). `npm run dev` also runs the `api/` server code, so doors and the leaderboard work locally.

### Put it online
```bash
vercel deploy --prod
```
The three `FIREBASE_*` variables must be set in the Vercel project (`vercel env add`). Never commit `.env.local` or the service account JSON. Both are in `.gitignore`.

### Where things live

| File or folder | What's in it |
|---|---|
| `prd.md` | The full design document for the game |
| `src/scenes/` | One file per screen: Title, Tower, Arena, Door, Results, Leaderboard |
| `src/data/floors.js` | Which Pokémon are on each floor and how long each floor lasts |
| `src/data/stats.js` | The PokéAPI-to-game-number formulas from the stat card |
| `src/data/balance.js` | **All the difficulty knobs**: player HP, damage, attack speed, waves, squad size, catch rewards, extra lives |
| `src/data/doors.js` | Door questions, context and hints (no answers!) |
| `api/` | Server code: players, door checking, scores, leaderboard |
| `api/_lib/doors.js` | **The door answers and wrong-answer messages.** Server only. |

### Making the game easier or harder
Change the numbers in `src/data/balance.js`, not the formulas in `stats.js`. The formulas match what the stat card teaches.

### Resetting a student
A student can start fresh by running this in the browser Console (F12) on the game page:
```js
localStorage.removeItem('fetchTower.player')
```
That gives them a new player id and name. Their old entry stays on the leaderboard until you delete it from the `players` collection in the Firebase console.
