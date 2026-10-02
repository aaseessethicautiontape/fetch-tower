// PRD section 5: turn raw PokéAPI base stats into game numbers.
// Same formulas for wild Pokémon and the player's starter.

export const STAT_RULES = {
  hp: { label: 'Max HP', formula: 'hp × 2', min: 40, max: 300 },
  attack: { label: 'Damage per hit', formula: 'attack ÷ 5', min: 4, max: 30 },
  speed: { label: 'Move speed', formula: '40 + speed × 1.2', min: 70, max: 200 },
};

const clamp = (value, { min, max }) => Math.min(max, Math.max(min, value));

export function toGameStats({ hp, attack, speed }) {
  return {
    maxHp: clamp(hp * 2, STAT_RULES.hp),
    damage: clamp(Math.round(attack / 5), STAT_RULES.attack),
    speed: clamp(Math.round(40 + speed * 1.2), STAT_RULES.speed),
  };
}
