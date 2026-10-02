// Fetch a Pokémon from PokéAPI once per session and keep it in memory.

const cache = new Map();

function baseStat(data, name) {
  return data.stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
}

export function getPokemon(id) {
  if (!cache.has(id)) {
    const request = fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`PokéAPI returned ${res.status} for #${id}`);
        return res.json();
      })
      .then((data) => ({
        id: data.id,
        name: data.name,
        sprite: data.sprites.front_default,
        artwork: data.sprites.other?.['official-artwork']?.front_default ?? data.sprites.front_default,
        types: data.types.map((t) => t.type.name),
        hp: baseStat(data, 'hp'),
        attack: baseStat(data, 'attack'),
        speed: baseStat(data, 'speed'),
      }));

    // Don't cache failures, so the next call can retry.
    request.catch(() => cache.delete(id));
    cache.set(id, request);
  }
  return cache.get(id);
}
