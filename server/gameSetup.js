const { run, get } = require('./db');
const { territories, players, resetPlayers, beliefCards, eventCards } = require('./gameData');
const ACTIVE_PLAYER_NAMES = ['Ayla', 'Bram'];

const SEQUENCE_TABLES = [
  'players',
  'territories',
  'settlements',
  'territory_development',
  'player_beliefs',
  'belief_cards',
  'event_cards',
  'game_state',
  'game_log'
];

async function clearGameTables() {
  await run('DELETE FROM player_beliefs');
  await run('DELETE FROM game_log');
  await run('DELETE FROM settlements');
  await run('DELETE FROM territory_development');
  await run('DELETE FROM game_state');
  await run('DELETE FROM players');
  await run('DELETE FROM territories');
  await run('DELETE FROM belief_cards');
  await run('DELETE FROM event_cards');

  for (const tableName of SEQUENCE_TABLES) {
    await run(`DELETE FROM sqlite_sequence WHERE name = ?`, [tableName]);
  }
}

async function insertTerritories() {
  const territoryIdsByName = {};

  for (const territory of territories) {
    const result = await run(
      `INSERT INTO territories (
        name, terrain_type, description, resource_bonus, position_x, position_y,
        prey_capacity, prey_remaining, shelter_yield, village_yield, city_yield, total_prey
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        territory.name,
        territory.terrain_type,
        territory.description,
        territory.resource_bonus,
        territory.position_x,
        territory.position_y,
        territory.prey_capacity,
        territory.prey_capacity,
        territory.shelter_yield,
        territory.village_yield,
        territory.city_yield,
        territory.prey_capacity
      ]
    );
    territoryIdsByName[territory.name] = result.lastID;
  }

  return territoryIdsByName;
}

async function insertBeliefCards() {
  for (const belief of beliefCards) {
    await run(
      'INSERT INTO belief_cards (name, title, description, technology, type_code, cost, resource_gain, effect_text, number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [belief.title, belief.title, belief.description, belief.technology, belief.type_code, belief.cost, belief.resource_gain, belief.effect_text, belief.number]
    );
  }
}

async function insertEventCards() {
  for (const event of eventCards) {
    await run(
      'INSERT INTO event_cards (title, description, effect_type, effect_value) VALUES (?, ?, ?, ?)',
      [event.title, event.description, event.effect_type, event.effect_value]
    );
  }
}

async function resetAndSeedGame(round = 1, options = {}) {
  const playersToInsert = options.players ?? players;
  await clearGameTables();
  const territoryIdsByName = await insertTerritories();
  const ayla = await insertPlayersWithConfig(territoryIdsByName, playersToInsert);

  await insertBeliefCards();
  await insertEventCards();
  await run('INSERT INTO game_state (current_player_id, round) VALUES (?, ?)', [ayla?.id ?? null, round]);

  return {
    territoryIdsByName,
    aylaId: ayla?.id ?? null
  };
}

async function insertPlayersWithConfig(territoryIdsByName, playerList) {
  const playerColumns = await get("SELECT GROUP_CONCAT(name, ',') AS names FROM pragma_table_info('players')");
  const hasSacredAwareness = (playerColumns?.names || '').split(',').includes('sacred_awareness');
  const filteredPlayerList = playerList.filter((player) => ACTIVE_PLAYER_NAMES.includes(player.name));

  for (const player of filteredPlayerList) {
    await run(
      hasSacredAwareness
        ? 'INSERT INTO players (name, tribe, resources, current_territory_id, has_moved_this_turn, has_gathered_this_turn, shelters_to_place, sacred_awareness) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        : 'INSERT INTO players (name, tribe, resources, current_territory_id, has_moved_this_turn, has_gathered_this_turn, shelters_to_place) VALUES (?, ?, ?, ?, ?, ?, ?)',
      hasSacredAwareness
        ? [player.name, player.tribe, player.resources, territoryIdsByName[player.starting_territory] ?? null, 0, 0, 6, 0]
        : [player.name, player.tribe, player.resources, territoryIdsByName[player.starting_territory] ?? null, 0, 0, 6]
    );
  }

  return get('SELECT id FROM players WHERE name = ? ORDER BY id LIMIT 1', ['Ayla']);
}

async function resetGameSession(round = 1) {
  return resetAndSeedGame(round, { players: resetPlayers });
}

module.exports = {
  resetAndSeedGame,
  resetGameSession,
  clearGameTables
};
