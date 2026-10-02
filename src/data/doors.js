// PRD section 7 and 8: what each door asks and its hints.
// The answers are NOT here. They live only on the server (/api/door).

export const HINT_UNLOCK_MS = [30 * 1000, 60 * 1000, 90 * 1000];
export const WRONG_IN_A_ROW_FOR_HINT = 3;

export const DOORS = {
  1: {
    title: 'Fetch the guardian',
    context: "In class you used fetch to ask PokéAPI for Pikachu. PokéAPI answers with JSON: a big list of facts about a Pokémon, including its stats.",
    question: 'The guardian of Floor 1 was Pokémon #19. Fetch it from PokéAPI. What is its HP?',
    placeholder: 'A number',
    hints: [
      'The data lives on PokéAPI. Your browser can ask for it with fetch, like we did in class.',
      'Open the Console with F12. Use the Pikachu fetch line from class, but swap pikachu for 19.',
      "Paste this in the Console: fetch('https://pokeapi.co/api/v2/pokemon/19').then(r => r.json()).then(console.log). Click the arrow to open it, open stats, and find the one where stat.name is hp. The number next to base_stat is your answer. (If Chrome won't let you paste, type allow pasting first.)",
    ],
  },
  2: {
    title: 'Find its picture',
    context: 'The same JSON also holds links to pictures of the Pokémon. Games like this one use those links to draw their sprites.',
    question: "Paste the link to the guardian's picture.",
    placeholder: 'https://...',
    hints: [
      'In PokéAPI, pictures are called sprites.',
      'Fetch #19 again and open sprites. You want the front picture.',
      'Open sprites, find front_default, right-click the link next to it, and choose Copy string contents. Paste it here.',
    ],
  },
  3: {
    title: 'Prove your tools work',
    context: 'Node runs JavaScript on your laptop, outside the browser. Our projects need Node version 22 or newer.',
    question: 'Type exactly what node --version says on your laptop.',
    placeholder: 'v...',
    hints: [
      'Ask your computer which version of Node it has. You do that in the terminal.',
      'In VS Code, click Terminal, then New Terminal.',
      'Type node --version and press Enter. Copy the whole thing it prints (it starts with v) and paste it here.',
    ],
  },
  4: {
    title: 'Install the right engine',
    context: 'npm downloads code packages into your project. Our game engine is a package too, and the version you install matters.',
    question: 'What command installs the game engine we use in class?',
    placeholder: 'npm ...',
    hints: [
      'The engine is called Phaser.',
      'npm downloads packages. You can choose a version by adding @ and a number.',
      "It's npm install, then the engine name, then @ and the version this course uses. Remember the warning from class about version 4.",
    ],
  },
  5: {
    title: 'Show me your repo',
    context: 'Your poke-arena project should be saved on GitHub, with its PRD.md file inside. Let me check it is really there!',
    question: "Type your GitHub username. I'll check your poke-arena repo.",
    placeholder: 'GitHub username',
    hints: [
      'Your poke-arena project needs to be on GitHub.',
      'In VS Code: Source Control, write a message, Commit, then Publish to GitHub and name it poke-arena.',
      'Go to github.com and click your profile picture in the top right. Your username is right there. Make sure PRD.md shows up in your repo before you try again.',
    ],
  },
};
