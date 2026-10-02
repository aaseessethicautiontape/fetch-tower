// Colours per Pokémon type, used for projectiles and card strips.
export const TYPE_COLORS = {
  grass: 0x4cb944,
  fire: 0xff8a3d,
  water: 0x3d9bff,
  electric: 0xffd23f,
  normal: 0xc8b89a,
  flying: 0x9db7f5,
  poison: 0xb06cd8,
  ground: 0xe0c068,
  rock: 0xb8a038,
  fighting: 0xd8553f,
  ghost: 0x7b62a3,
  psychic: 0xff6fa0,
  bug: 0xa8b820,
  ice: 0x98d8d8,
  dragon: 0x7038f8,
  dark: 0x705848,
  steel: 0xb8b8d0,
  fairy: 0xffa6d9,
};

export function typeColor(pokemon) {
  return TYPE_COLORS[pokemon?.types?.[0]] ?? 0xffffff;
}
