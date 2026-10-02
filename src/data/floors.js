// PRD section 5: starters the player can pick on the title screen.
export const STARTERS = [
  { id: 1, name: 'Bulbasaur' },
  { id: 4, name: 'Charmander' },
  { id: 7, name: 'Squirtle' },
  { id: 25, name: 'Pikachu' },
];

// PRD section 6: Week 2 floors, bottom to top. `timer` is in seconds.
// `door` is the door that sits after the floor (null on the boss floor).
export const FLOORS = [
  {
    floor: 1,
    label: 'Floor 1',
    wild: [{ id: 19, name: 'Rattata' }, { id: 16, name: 'Pidgey' }],
    timer: 60,
    door: 1,
  },
  {
    floor: 2,
    label: 'Floor 2',
    wild: [{ id: 21, name: 'Spearow' }, { id: 23, name: 'Ekans' }],
    timer: 75,
    door: 2,
  },
  {
    floor: 3,
    label: 'Floor 3',
    wild: [{ id: 41, name: 'Zubat' }, { id: 74, name: 'Geodude' }],
    timer: 75,
    door: 3,
    fakeDoor: true,
  },
  {
    floor: 4,
    label: 'Floor 4',
    wild: [{ id: 66, name: 'Machop' }, { id: 77, name: 'Ponyta' }],
    timer: 90,
    door: 4,
  },
  {
    floor: 5,
    label: 'Floor 5',
    wild: [{ id: 92, name: 'Gastly' }, { id: 95, name: 'Onix' }],
    timer: 90,
    door: 5,
  },
  {
    floor: 6,
    label: 'Boss',
    boss: { id: 143, name: 'Snorlax' },
    wild: [{ id: 19, name: 'Rattata' }],
    timer: 120,
    door: null,
  },
];

// Shown locked above the boss floor on the tower map.
export const FUTURE_WEEKS = [3, 4, 5, 6];
