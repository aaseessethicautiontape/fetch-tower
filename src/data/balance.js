// Gameplay tuning, all in one place.
// The PRD stat formulas in stats.js stay exact because the stat card teaches them.
// These multipliers sit on top of those numbers.

export const BALANCE = {
  player: {
    hpMultiplier: 2, // max HP = starter's mapped HP × this
    speed: 170, // px/s
    invincibleMs: 1000, // after taking a hit
  },
  dash: {
    speed: 520, // px/s during the burst
    durationMs: 160,
    cooldownMs: 1500,
  },
  team: {
    // The lead (your starter unless you swap with 1-4) is the main attacker.
    leadAttackEveryMs: 500,
    leadDamageMultiplier: 2.5, // lead projectile damage = mapped damage × this
    // Everyone else in the squad.
    memberAttackEveryMs: 800,
    memberDamageMultiplier: 1, // squad projectile damage = their own mapped damage × this
    catchableDamageMultiplier: 0.5, // extra multiplier on Pokémon showing the catch ring
    missChance: 0.1, // 1 in 10 projectiles miss, at random
    projectileSpeed: 700, // px/s, homing
  },
  squad: {
    maxSize: 3, // caught Pokémon that follow you, plus your starter. Full squad: newest replaces oldest.
  },
  catchRewards: {
    maxHpBoost: 0.1, // each catch adds 10% of your base max HP
    maxHpBoostCap: 1, // total boost is capped at +100% (max HP at most 2× base)
    heal: 0.25, // each catch heals 25% of your max HP
    catchesPerLife: 3, // every 3 catches on a floor = 1 extra life
    maxLives: 3,
    reviveHp: 0.5, // fraction of max HP you come back with
    reviveInvincibleMs: 2000,
  },
  wild: {
    contactDamageMultiplier: 0.675, // contact damage = mapped damage × this (0.5 × 1.35)
    hpMultiplier: 1.18, // wild Pokémon have 18% more HP than their mapped Max HP
  },
  score: {
    perSecond: 1, // survived
    perDefeat: 10,
    perCatch: 50,
  },
  waves: {
    firstWaveAtMs: 1000,
    startSize: 2, // Pokémon per wave at the start
    maxSize: 4, // Pokémon per wave near the end of the timer
    earlyCap: 3, // max on screen during the first part of the floor
    earlyCapForMs: 20000,
    cap: 6, // max on screen after that
    intervalStartMs: 8000, // gap between waves at the start...
    intervalEndMs: 5000, // ...shrinking to this by the end
  },
};
