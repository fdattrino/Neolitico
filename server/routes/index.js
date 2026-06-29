const express = require('express');
const { run, get, all } = require('../db');
const { resetGameSession } = require('../gameSetup');

const router = express.Router();

const BUILD_SHELTER_COST = 5;
const FOUND_CITY_COST = 40;
const NOT_CURRENT_TURN_ERROR = 'Non è il turno di questo giocatore.';
const MAINTENANCE_COSTS = {
  shelters: 5,
  villages: 10,
  cities: 40
};

function serializeLogRow(row) {
  let details = row.details;
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details);
    } catch (_err) {
      details = row.details;
    }
  }

  return { ...row, details };
}

function serializeDevelopmentRow(row) {
  return {
    id: row.id,
    player_id: row.player_id,
    territory_id: row.territory_id,
    shelters: Number(row.shelters ?? 0),
    villages: Number(row.villages ?? 0),
    cities: Number(row.cities ?? 0),
    created_at: row.created_at,
    player_name: row.player_name,
    territory_name: row.territory_name
  };
}

async function fetchLegacySettlements() {
  const settlements = await all(
    `SELECT settlements.id, settlements.player_id, settlements.territory_id, settlements.level, settlements.created_at,
            players.name AS player_name,
            territories.name AS territory_name
     FROM settlements
     LEFT JOIN players ON players.id = settlements.player_id
     LEFT JOIN territories ON territories.id = settlements.territory_id
     ORDER BY territories.position_y, territories.position_x, settlements.id`
  );

  return settlements.map((row) => ({
    id: row.id,
    player_id: row.player_id,
    territory_id: row.territory_id,
    level: row.level,
    created_at: row.created_at,
    player_name: row.player_name,
    territory_name: row.territory_name
  }));
}

async function fetchDevelopments() {
  const developments = await all(
    `SELECT territory_development.id, territory_development.player_id, territory_development.territory_id,
            territory_development.shelters, territory_development.villages, territory_development.cities,
            territory_development.created_at,
            players.name AS player_name,
            territories.name AS territory_name,
            territories.position_y,
            territories.position_x
     FROM territory_development
     LEFT JOIN players ON players.id = territory_development.player_id
     LEFT JOIN territories ON territories.id = territory_development.territory_id
     ORDER BY territories.position_y, territories.position_x, territory_development.id`
  );

  return developments.map(serializeDevelopmentRow);
}

async function fetchTerritoriesWithDevelopments() {
  const territories = await all('SELECT * FROM territories ORDER BY position_y, position_x, id');
  const developments = await fetchDevelopments();
  const legacySettlements = await fetchLegacySettlements();
  const developmentsByTerritory = developments.reduce((acc, development) => {
    if (!acc[development.territory_id]) {
      acc[development.territory_id] = [];
    }
    acc[development.territory_id].push(development);
    return acc;
  }, {});
  const settlementsByTerritory = legacySettlements.reduce((acc, settlement) => {
    if (!acc[settlement.territory_id]) {
      acc[settlement.territory_id] = [];
    }
    acc[settlement.territory_id].push(settlement);
    return acc;
  }, {});

  return territories.map((territory) => ({
    ...territory,
    prey_capacity: Number(territory.prey_capacity ?? territory.total_prey ?? 0),
    total_prey: Number(territory.total_prey ?? 0),
    prey_remaining: Number(territory.prey_remaining ?? 0),
    shelter_yield: Number(territory.shelter_yield ?? 0),
    village_yield: Number(territory.village_yield ?? 0),
    city_yield: Number(territory.city_yield ?? 0),
    developments: developmentsByTerritory[territory.id] || [],
    settlements: settlementsByTerritory[territory.id] || []
  }));
}

async function fetchPlayerDevelopmentInTerritory(playerId, territoryId) {
  if (!territoryId) {
    return null;
  }

  const row = await get(
    `SELECT territory_development.id, territory_development.player_id, territory_development.territory_id,
            territory_development.shelters, territory_development.villages, territory_development.cities,
            territory_development.created_at,
            players.name AS player_name,
            territories.name AS territory_name
     FROM territory_development
     LEFT JOIN players ON players.id = territory_development.player_id
     LEFT JOIN territories ON territories.id = territory_development.territory_id
     WHERE territory_development.player_id = ? AND territory_development.territory_id = ?`,
    [playerId, territoryId]
  );

  return row ? serializeDevelopmentRow(row) : null;
}

async function ensureDevelopmentRecord(playerId, territoryId) {
  let development = await fetchPlayerDevelopmentInTerritory(playerId, territoryId);
  if (development) {
    return development;
  }

  const insertResult = await run(
    'INSERT INTO territory_development (player_id, territory_id, shelters, villages, cities) VALUES (?, ?, 0, 0, 0)',
    [playerId, territoryId]
  );

  development = await fetchPlayerDevelopmentInTerritory(playerId, territoryId);
  if (development) {
    return development;
  }

  return {
    id: insertResult.lastID,
    player_id: playerId,
    territory_id: territoryId,
    shelters: 0,
    villages: 0,
    cities: 0,
    created_at: null
  };
}

function getEffectiveSheltersToPlace(player) {
  return Number(player?.shelters_to_place ?? 0);
}

function isPlacementPhase(player) {
  return getEffectiveSheltersToPlace(player) > 0;
}

function calculateProduction(territory, development) {
  const shelters = Number(development?.shelters ?? 0);
  const villages = Number(development?.villages ?? 0);
  const cities = Number(development?.cities ?? 0);
  const preyRemaining = Number(territory?.prey_remaining ?? 0);
  const activeShelters = Math.min(shelters, preyRemaining);
  const shelterYield = Number(territory?.shelter_yield ?? 0);
  const villageYield = Number(territory?.village_yield ?? 0);
  const cityYield = Number(territory?.city_yield ?? 0);
  const shelterProduction = activeShelters * shelterYield;
  const villageProduction = villages * villageYield;
  const cityProduction = cities * cityYield;

  return {
    shelters,
    villages,
    cities,
    preyConsumed: activeShelters,
    inactiveShelters: shelters - activeShelters,
    shelterProduction,
    villageProduction,
    cityProduction,
    totalProduction: shelterProduction + villageProduction + cityProduction
  };
}

async function requirePlacementPhaseComplete(player, res, actionLabel) {
  if (!isPlacementPhase(player)) {
    return true;
  }

  res.status(400).json({
    success: false,
    error: `${player.name} deve prima collocare tutti i ripari iniziali. Azione non disponibile: ${actionLabel}.`
  });
  return false;
}

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

async function fetchGameState() {
  return get(
    `SELECT game_state.id, game_state.round, game_state.current_player_id, players.name AS current_player_name
     FROM game_state
     LEFT JOIN players ON players.id = game_state.current_player_id
     ORDER BY game_state.id
     LIMIT 1`
  );
}

async function fetchAyla() {
  return get('SELECT id, name FROM players WHERE name = ? ORDER BY id LIMIT 1', ['Ayla']);
}

async function fetchPlayersWithTerritories() {
  const players = await all(
    `SELECT players.*, territories.name AS current_territory_name
     FROM players
     LEFT JOIN territories ON territories.id = players.current_territory_id
     ORDER BY players.id`,
    []
  );

  return players.map((player) => ({
    ...player,
    shelters_to_place: getEffectiveSheltersToPlace(player)
  }));
}

async function fetchPlayersForTurnOrder() {
  return all(
    `SELECT id, name
     FROM players
     ORDER BY id`,
    []
  );
}

async function resetGameStateToAyla(round = 1) {
  const ayla = await fetchAyla();
  if (!ayla) {
    return null;
  }

  await run('DELETE FROM game_state');
  await run('INSERT INTO game_state (current_player_id, round) VALUES (?, ?)', [ayla.id, round]);
  return fetchGameState();
}

async function ensureValidGameState() {
  const gameState = await fetchGameState();
  if (!gameState) {
    return resetGameStateToAyla(1);
  }

  if (!gameState.current_player_id || !gameState.current_player_name) {
    return resetGameStateToAyla(Number(gameState.round) || 1);
  }

  const currentPlayer = await get('SELECT id FROM players WHERE id = ?', [gameState.current_player_id]);
  if (!currentPlayer) {
    return resetGameStateToAyla(Number(gameState.round) || 1);
  }

  return {
    ...gameState,
    current_player_id: Number(gameState.current_player_id),
    round: Number(gameState.round)
  };
}

async function requireCurrentPlayer(playerId, res) {
  const gameState = await ensureValidGameState();

  if (!gameState || !gameState.current_player_id) {
    res.status(400).json({ success: false, error: 'Lo stato della partita non è inizializzato.' });
    return null;
  }

  if (Number(gameState.current_player_id) !== Number(playerId)) {
    res.status(400).json({ success: false, error: NOT_CURRENT_TURN_ERROR });
    return null;
  }

  return gameState;
}

async function getPlayerWithTerritory(playerId) {
  const player = await get(
    `SELECT players.*, territories.name AS current_territory_name
     FROM players
     LEFT JOIN territories ON territories.id = players.current_territory_id
     WHERE players.id = ?`,
    [playerId]
  );

  return player
    ? {
      ...player,
      shelters_to_place: getEffectiveSheltersToPlace(player)
    }
    : null;
}

async function buildSharedPayload(playerId) {
  const [player, territories, developments, gameState, log] = await Promise.all([
    playerId ? getPlayerWithTerritory(playerId) : Promise.resolve(null),
    fetchTerritoriesWithDevelopments(),
    fetchDevelopments(),
    ensureValidGameState(),
    all('SELECT * FROM game_log ORDER BY id DESC')
  ]);

  return {
    player,
    territories,
    developments,
    gameState,
    log: log.map(serializeLogRow)
  };
}

async function loseDevelopments(playerId, fieldName, amount) {
  if (amount <= 0) {
    return { lost: 0, touchedTerritories: [] };
  }

  const developments = await all(
    `SELECT id, territory_id, shelters, villages, cities
     FROM territory_development
     WHERE player_id = ? AND ${fieldName} > 0
     ORDER BY territory_id, id`,
    [playerId]
  );

  let remaining = amount;
  let lost = 0;
  const touchedTerritories = [];

  for (const development of developments) {
    if (remaining <= 0) {
      break;
    }

    const available = Number(development[fieldName] ?? 0);
    const decrement = Math.min(available, remaining);
    if (decrement <= 0) {
      continue;
    }

    await run(`UPDATE territory_development SET ${fieldName} = ${fieldName} - ? WHERE id = ?`, [decrement, development.id]);
    remaining -= decrement;
    lost += decrement;
    touchedTerritories.push(development.territory_id);
  }

  return { lost, touchedTerritories };
}

async function loseOneDevelopmentForMaintenance(playerId) {
  const shelterLoss = await loseDevelopments(playerId, 'shelters', 1);
  if (shelterLoss.lost > 0) {
    return 'riparo';
  }

  const villageLoss = await loseDevelopments(playerId, 'villages', 1);
  if (villageLoss.lost > 0) {
    return 'villaggio';
  }

  return null;
}

async function applyRoundMaintenance(players) {
  for (const player of players) {
    const totals = await get(
      `SELECT
         COALESCE(SUM(shelters), 0) AS shelters,
         COALESCE(SUM(villages), 0) AS villages,
         COALESCE(SUM(cities), 0) AS cities
       FROM territory_development
       WHERE player_id = ?`,
      [player.id]
    );

    const shelters = Number(totals?.shelters ?? 0);
    const villages = Number(totals?.villages ?? 0);
    const cities = Number(totals?.cities ?? 0);
    const maintenanceCost = (shelters * MAINTENANCE_COSTS.shelters)
      + (villages * MAINTENANCE_COSTS.villages)
      + (cities * MAINTENANCE_COSTS.cities);

    if (maintenanceCost <= 0) {
      continue;
    }

    const currentPlayer = await get('SELECT id, name, resources FROM players WHERE id = ?', [player.id]);
    if (!currentPlayer) {
      continue;
    }

    if (Number(currentPlayer.resources) >= maintenanceCost) {
      await run('UPDATE players SET resources = resources - ? WHERE id = ?', [maintenanceCost, player.id]);
      await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
        player.id,
        `${currentPlayer.name} paga ${maintenanceCost} risorse di mantenimento.`,
        JSON.stringify({ maintenanceCost, shelters, villages, cities, paid: true })
      ]);
      continue;
    }

    await run('UPDATE players SET resources = 0 WHERE id = ?', [player.id]);
    const lostType = await loseOneDevelopmentForMaintenance(player.id);
    const message = lostType
      ? `${currentPlayer.name} non riesce a pagare tutto il mantenimento e perde 1 ${lostType}.`
      : `${currentPlayer.name} non riesce a pagare tutto il mantenimento e resta senza risorse.`;

    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      player.id,
      message,
      JSON.stringify({ maintenanceCost, shelters, villages, cities, paid: false, lostType })
    ]);
  }
}

async function handleBuildShelter(req, res) {
  try {
    const playerId = Number(req.params.id);

    if (Number.isNaN(playerId)) {
      return res.status(400).json({ success: false, error: 'Valid player id is required.' });
    }

    const gameState = await requireCurrentPlayer(playerId, res);
    if (!gameState) {
      return;
    }

    const player = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    if (!(await requirePlacementPhaseComplete(player, res, 'costruzione riparo'))) {
      return;
    }

    if (!player.current_territory_id) {
      return res.status(400).json({ success: false, error: 'Player is not currently in a territory.' });
    }

    if (Number(player.resources) < BUILD_SHELTER_COST) {
      return res.status(400).json({ success: false, error: 'Risorse insufficienti: servono 5 risorse per costruire un riparo.' });
    }

    const territory = await get('SELECT * FROM territories WHERE id = ?', [player.current_territory_id]);
    if (!territory) {
      return res.status(404).json({ success: false, error: 'Current territory not found.' });
    }

    const development = await ensureDevelopmentRecord(playerId, territory.id);

    await run('UPDATE players SET resources = resources - ? WHERE id = ?', [BUILD_SHELTER_COST, playerId]);
    await run('UPDATE territory_development SET shelters = shelters + 1 WHERE id = ?', [development.id]);

    const updatedDevelopment = await fetchPlayerDevelopmentInTerritory(playerId, territory.id);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `${player.name} costruisce un riparo nella ${territory.name}. Ripari nella ${territory.name}: ${updatedDevelopment.shelters}.`,
      JSON.stringify({ territoryId: territory.id, territoryName: territory.name, shelters: updatedDevelopment.shelters, buildCost: BUILD_SHELTER_COST })
    ]);

    res.json({ success: true, data: await buildSharedPayload(playerId) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function handlePlaceShelter(req, res) {
  try {
    const playerId = Number(req.params.id);
    const territoryId = Number(req.body.territoryId);

    if (Number.isNaN(playerId) || Number.isNaN(territoryId)) {
      return res.status(400).json({ success: false, error: 'Valid player id and territory id are required.' });
    }

    const gameState = await requireCurrentPlayer(playerId, res);
    if (!gameState) {
      return;
    }

    const player = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    if (getEffectiveSheltersToPlace(player) <= 0) {
      return res.status(400).json({ success: false, error: 'Non ci sono più ripari iniziali da collocare.' });
    }

    const territory = await get('SELECT * FROM territories WHERE id = ?', [territoryId]);
    if (!territory) {
      return res.status(404).json({ success: false, error: 'Territory not found.' });
    }

    const development = await ensureDevelopmentRecord(playerId, territoryId);

    await run('UPDATE territory_development SET shelters = shelters + 1 WHERE id = ?', [development.id]);
    await run('UPDATE players SET shelters_to_place = shelters_to_place - 1 WHERE id = ?', [playerId]);

    const updatedPlayer = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `${player.name} colloca un riparo nella ${territory.name}. Ripari ancora da collocare: ${getEffectiveSheltersToPlace(updatedPlayer)}.`,
      JSON.stringify({
        territoryId: territory.id,
        territoryName: territory.name,
        sheltersPlaced: 1,
        sheltersToPlaceRemaining: getEffectiveSheltersToPlace(updatedPlayer)
      })
    ]);

    res.json({ success: true, data: await buildSharedPayload(playerId) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

router.get('/players', async (_req, res) => {
  try {
    const players = await fetchPlayersWithTerritories();
    const purchasedBeliefs = await all('SELECT player_id, belief_card_id FROM player_beliefs ORDER BY player_id, belief_card_id');

    const ownedBeliefsByPlayer = purchasedBeliefs.reduce((acc, row) => {
      if (!acc[row.player_id]) {
        acc[row.player_id] = [];
      }
      acc[row.player_id].push(row.belief_card_id);
      return acc;
    }, {});

    res.json({
      success: true,
      data: players.map((player) => ({
        ...player,
        owned_belief_ids: ownedBeliefsByPlayer[player.id] || []
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/beliefs', async (_req, res) => {
  try {
    const beliefs = await all('SELECT * FROM belief_cards ORDER BY number ASC, id ASC');
    res.json({ success: true, data: beliefs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/game-state', async (_req, res) => {
  try {
    const gameState = await ensureValidGameState();
    if (!gameState) {
      return res.status(404).json({ success: false, error: 'Game state not found.' });
    }

    res.json({ success: true, data: gameState });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/territories', async (_req, res) => {
  try {
    const territories = await fetchTerritoriesWithDevelopments();
    res.json({ success: true, data: territories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/developments', async (_req, res) => {
  try {
    const developments = await fetchDevelopments();
    res.json({ success: true, data: developments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/territories/:id/battle', async (req, res) => {
  try {
    const territoryId = Number(req.params.id);

    if (Number.isNaN(territoryId)) {
      return res.status(400).json({ success: false, error: 'Valid territory id is required.' });
    }

    const gameState = await ensureValidGameState();
    const currentPlayer = gameState?.current_player_id
      ? await get('SELECT * FROM players WHERE id = ?', [gameState.current_player_id])
      : null;

    if (currentPlayer && !(await requirePlacementPhaseComplete(currentPlayer, res, 'battaglia'))) {
      return;
    }

    const territory = await get('SELECT * FROM territories WHERE id = ?', [territoryId]);
    if (!territory) {
      return res.status(404).json({ success: false, error: 'Territory not found.' });
    }

    if (Number(territory.prey_remaining ?? 0) > 0) {
      return res.status(400).json({ success: false, error: 'Ci sono ancora prede: la battaglia non è necessaria.' });
    }

    const territoryDevelopments = (await fetchDevelopments()).filter(
      (development) => Number(development.territory_id) === territoryId
    );

    if (territoryDevelopments.length < 2) {
      return res.status(400).json({ success: false, error: 'Non ci sono insediamenti confrontabili per la battaglia.' });
    }

    const [firstDevelopment, secondDevelopment] = territoryDevelopments.slice(0, 2);
    const players = await all(
      'SELECT id, name FROM players WHERE id IN (?, ?) ORDER BY id',
      [firstDevelopment.player_id, secondDevelopment.player_id]
    );

    if (players.length < 2) {
      return res.status(400).json({ success: false, error: 'Non ci sono insediamenti confrontabili per la battaglia.' });
    }

    const firstPlayer = players.find((player) => Number(player.id) === Number(firstDevelopment.player_id));
    const secondPlayer = players.find((player) => Number(player.id) === Number(secondDevelopment.player_id));

    let battleField = null;
    if (Number(firstDevelopment.shelters) > 0 && Number(secondDevelopment.shelters) > 0) {
      battleField = 'shelters';
    } else if (Number(firstDevelopment.villages) > 0 && Number(secondDevelopment.villages) > 0) {
      battleField = 'villages';
    } else {
      return res.status(400).json({ success: false, error: 'Non ci sono insediamenti confrontabili per la battaglia.' });
    }

    const firstRoll = rollDie();
    const secondRoll = rollDie();
    let logMessage;
    let loserId = null;

    if (firstRoll === secondRoll) {
      logMessage = `Battaglia nella ${territory.name}: pareggio, nessuna perdita.`;
    } else {
      const loserDevelopment = firstRoll < secondRoll ? firstDevelopment : secondDevelopment;
      const loserPlayer = firstRoll < secondRoll ? firstPlayer : secondPlayer;
      loserId = loserPlayer.id;
      await run(`UPDATE territory_development SET ${battleField} = ${battleField} - 1 WHERE id = ?`, [loserDevelopment.id]);
      logMessage = `Battaglia nella ${territory.name}: ${firstPlayer.name} tira ${firstRoll}, ${secondPlayer.name} tira ${secondRoll}. ${loserPlayer.name} perde 1 ${battleField === 'shelters' ? 'riparo' : 'villaggio'}.`;
    }

    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      loserId,
      logMessage,
      JSON.stringify({
        territoryId: territory.id,
        territoryName: territory.name,
        firstPlayerId: firstPlayer.id,
        firstPlayerName: firstPlayer.name,
        firstRoll,
        secondPlayerId: secondPlayer.id,
        secondPlayerName: secondPlayer.name,
        secondRoll,
        battleField,
        loserId
      })
    ]);

    res.json({
      success: true,
      data: {
        territory,
        ...(await buildSharedPayload())
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/settlements', async (_req, res) => {
  try {
    const settlements = await fetchLegacySettlements();
    res.json({ success: true, data: settlements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players/:id/buy-belief', async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    const beliefCardId = Number(req.body.belief_card_id ?? req.body.beliefCardId);

    if (!beliefCardId || Number.isNaN(playerId)) {
      return res.status(400).json({ success: false, error: 'Valid player id and belief card id are required.' });
    }

    const gameState = await requireCurrentPlayer(playerId, res);
    if (!gameState) {
      return;
    }

    const player = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    const beliefCard = await get('SELECT * FROM belief_cards WHERE id = ?', [beliefCardId]);

    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    if (!beliefCard) {
      return res.status(404).json({ success: false, error: 'Belief card not found.' });
    }

    const existing = await get('SELECT id FROM player_beliefs WHERE player_id = ? AND belief_card_id = ?', [playerId, beliefCardId]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Player already owns this belief.' });
    }

    if (player.resources < beliefCard.cost) {
      return res.status(400).json({ success: false, error: 'Not enough resources to buy this belief.' });
    }

    const sameTypeRow = await get(
      `SELECT COUNT(*) AS same_type_before
       FROM player_beliefs
       INNER JOIN belief_cards ON belief_cards.id = player_beliefs.belief_card_id
       WHERE player_beliefs.player_id = ? AND belief_cards.type_code = ?`,
      [playerId, beliefCard.type_code]
    );
    const sameTypeBefore = Number(sameTypeRow?.same_type_before ?? 0);
    const multiplier = sameTypeBefore + 1;
    const baseResourceGain = Number(beliefCard.resource_gain ?? 0);
    const totalResourceGain = baseResourceGain * multiplier;
    const netResourceDelta = totalResourceGain - beliefCard.cost;

    await run('UPDATE players SET resources = resources - ? + ? WHERE id = ?', [beliefCard.cost, totalResourceGain, playerId]);
    await run('INSERT INTO player_beliefs (player_id, belief_card_id) VALUES (?, ?)', [playerId, beliefCardId]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `${player.name} acquista ${beliefCard.name}: costo -${beliefCard.cost}, guadagno base +${baseResourceGain}, moltiplicatore tipo ${beliefCard.type_code} ×${multiplier}, guadagno totale +${totalResourceGain}.`,
      JSON.stringify({
        beliefCardId,
        beliefTitle: beliefCard.name,
        typeCode: beliefCard.type_code,
        cost: beliefCard.cost,
        baseResourceGain,
        sameTypeBefore,
        multiplier,
        totalResourceGain,
        netResourceDelta
      })
    ]);

    res.json({ success: true, data: await buildSharedPayload(playerId) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players/:id/move', async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    const territoryId = Number(req.body.territoryId);
    const sheltersToMove = Number(req.body.sheltersToMove ?? 0);
    const villagesToMove = Number(req.body.villagesToMove ?? 0);

    if (Number.isNaN(playerId) || Number.isNaN(territoryId)) {
      return res.status(400).json({ success: false, error: 'Valid player id and territory id are required.' });
    }

    if (Number.isNaN(sheltersToMove) || Number.isNaN(villagesToMove) || sheltersToMove < 0 || villagesToMove < 0) {
      return res.status(400).json({ success: false, error: 'I valori di ripari e villaggi da spostare devono essere numeri interi positivi o zero.' });
    }

    if (!Number.isInteger(sheltersToMove) || !Number.isInteger(villagesToMove)) {
      return res.status(400).json({ success: false, error: 'I valori di ripari e villaggi da spostare devono essere interi.' });
    }

    const gameState = await requireCurrentPlayer(playerId, res);
    if (!gameState) {
      return;
    }

    const player = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    if (!(await requirePlacementPhaseComplete(player, res, 'spostamento'))) {
      return;
    }

    if (Number(player.has_moved_this_turn) === 1) {
      return res.status(400).json({ success: false, error: 'Hai già effettuato uno spostamento in questo turno.' });
    }

    const currentTerritory = await get('SELECT * FROM territories WHERE id = ?', [player.current_territory_id]);
    const territory = await get('SELECT * FROM territories WHERE id = ?', [territoryId]);
    const sourceDevelopment = await fetchPlayerDevelopmentInTerritory(playerId, player.current_territory_id);

    if (!territory) {
      return res.status(404).json({ success: false, error: 'Territory not found.' });
    }

    if (!currentTerritory) {
      return res.status(404).json({ success: false, error: 'Current territory not found.' });
    }

    if (Number(player.current_territory_id) === Number(territoryId)) {
      return res.status(400).json({ success: false, error: 'Sei già in questo territorio.' });
    }

    const distance = Math.abs(territory.position_x - currentTerritory.position_x) + Math.abs(territory.position_y - currentTerritory.position_y);
    if (distance !== 1) {
      return res.status(400).json({ success: false, error: 'Puoi spostarti solo in un territorio adiacente.' });
    }

    const availableShelters = Number(sourceDevelopment?.shelters ?? 0);
    const availableVillages = Number(sourceDevelopment?.villages ?? 0);

    if (sheltersToMove > availableShelters) {
      return res.status(400).json({ success: false, error: 'Non puoi spostare più ripari di quelli posseduti nel territorio di partenza.' });
    }

    if (villagesToMove > availableVillages) {
      return res.status(400).json({ success: false, error: 'Non puoi spostare più villaggi di quelli posseduti nel territorio di partenza.' });
    }

    if (sheltersToMove > 0 || villagesToMove > 0) {
      const destinationDevelopment = await ensureDevelopmentRecord(playerId, territoryId);

      if (sourceDevelopment) {
        await run(
          'UPDATE territory_development SET shelters = shelters - ?, villages = villages - ? WHERE id = ?',
          [sheltersToMove, villagesToMove, sourceDevelopment.id]
        );
      }

      await run(
        'UPDATE territory_development SET shelters = shelters + ?, villages = villages + ? WHERE id = ?',
        [sheltersToMove, villagesToMove, destinationDevelopment.id]
      );
    }

    await run('UPDATE players SET current_territory_id = ?, has_moved_this_turn = 1 WHERE id = ?', [territoryId, playerId]);

    let transferText = 'senza trasferire insediamenti';
    if (sheltersToMove > 0 || villagesToMove > 0) {
      const movedParts = [];
      if (sheltersToMove > 0) {
        movedParts.push(`${sheltersToMove} ${sheltersToMove === 1 ? 'riparo' : 'ripari'}`);
      }
      if (villagesToMove > 0) {
        movedParts.push(`${villagesToMove} ${villagesToMove === 1 ? 'villaggio' : 'villaggi'}`);
      }
      transferText = `portando ${movedParts.join(' e ')}`;
    }

    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `${player.name} si sposta da ${currentTerritory.name} a ${territory.name} ${transferText}.`,
      JSON.stringify({
        fromTerritoryId: currentTerritory.id,
        fromTerritoryName: currentTerritory.name,
        territoryId,
        territoryName: territory.name,
        sheltersToMove,
        villagesToMove,
        citiesMoved: 0
      })
    ]);

    res.json({ success: true, data: await buildSharedPayload(playerId) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players/:id/gather', async (req, res) => {
  try {
    const playerId = Number(req.params.id);

    if (Number.isNaN(playerId)) {
      return res.status(400).json({ success: false, error: 'Valid player id is required.' });
    }

    const gameState = await requireCurrentPlayer(playerId, res);
    if (!gameState) {
      return;
    }

    const player = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    if (!(await requirePlacementPhaseComplete(player, res, 'produzione'))) {
      return;
    }

    if (Number(player.has_gathered_this_turn) === 1) {
      return res.status(400).json({ success: false, error: 'Hai già raccolto risorse in questo turno.' });
    }

    if (!player.current_territory_id) {
      return res.status(400).json({ success: false, error: 'Player is not currently in a territory.' });
    }

    const territory = await get('SELECT * FROM territories WHERE id = ?', [player.current_territory_id]);
    if (!territory) {
      return res.status(404).json({ success: false, error: 'Current territory not found.' });
    }

    const development = await fetchPlayerDevelopmentInTerritory(playerId, territory.id);
    const production = calculateProduction(territory, development);

    if (production.totalProduction <= 0) {
      return res.status(400).json({ success: false, error: 'Non ci sono strutture produttive attive in questo territorio.' });
    }

    await run(
      'UPDATE players SET resources = resources + ?, has_gathered_this_turn = 1 WHERE id = ?',
      [production.totalProduction, playerId]
    );
    if (production.preyConsumed > 0) {
      await run(
        'UPDATE territories SET prey_remaining = CASE WHEN prey_remaining >= ? THEN prey_remaining - ? ELSE 0 END WHERE id = ?',
        [production.preyConsumed, production.preyConsumed, territory.id]
      );
    }

    const logParts = [];
    if (production.shelterProduction > 0) {
      logParts.push(`ripari +${production.shelterProduction}`);
    }
    if (production.villageProduction > 0) {
      logParts.push(`villaggi +${production.villageProduction}`);
    }
    if (production.cityProduction > 0) {
      logParts.push(`città +${production.cityProduction}`);
    }
    if (production.preyConsumed > 0) {
      logParts.push(`prede consumate ${production.preyConsumed}`);
    }
    if (production.inactiveShelters > 0) {
      logParts.push(`ripari senza prede ${production.inactiveShelters}`);
    }

    const logMessage = `${player.name} produce nella ${territory.name}: ${logParts.join(', ')}, totale +${production.totalProduction}.`;

    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      logMessage,
      JSON.stringify({
        territoryId: territory.id,
        territoryName: territory.name,
        developmentId: development?.id ?? null,
        shelterYield: Number(territory.shelter_yield ?? 0),
        villageYield: Number(territory.village_yield ?? 0),
        cityYield: Number(territory.city_yield ?? 0),
        ...production
      })
    ]);

    res.json({
      success: true,
      data: {
        ...(await buildSharedPayload(playerId)),
        production
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players/:id/build-shelter', handleBuildShelter);
router.post('/players/:id/place-shelter', handlePlaceShelter);

router.post('/players/:id/upgrade-to-village', async (req, res) => {
  try {
    const playerId = Number(req.params.id);

    if (Number.isNaN(playerId)) {
      return res.status(400).json({ success: false, error: 'Valid player id is required.' });
    }

    const gameState = await requireCurrentPlayer(playerId, res);
    if (!gameState) {
      return;
    }

    const player = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    if (!(await requirePlacementPhaseComplete(player, res, 'formazione villaggio'))) {
      return;
    }

    if (!player.current_territory_id) {
      return res.status(400).json({ success: false, error: 'Player is not currently in a territory.' });
    }

    const territory = await get('SELECT * FROM territories WHERE id = ?', [player.current_territory_id]);
    if (!territory) {
      return res.status(404).json({ success: false, error: 'Current territory not found.' });
    }

    const development = await fetchPlayerDevelopmentInTerritory(playerId, territory.id);
    if (!development || Number(development.shelters) < 3) {
      return res.status(400).json({ success: false, error: 'Servono 3 ripari per formare un villaggio.' });
    }

    await run('UPDATE territory_development SET shelters = shelters - 3, villages = villages + 1 WHERE id = ?', [development.id]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `${player.name} trasforma 3 ripari in 1 villaggio nella ${territory.name}.`,
      JSON.stringify({ territoryId: territory.id, territoryName: territory.name, sheltersSpent: 3, villagesGained: 1 })
    ]);

    res.json({ success: true, data: await buildSharedPayload(playerId) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players/:id/upgrade-to-city', async (req, res) => {
  try {
    const playerId = Number(req.params.id);

    if (Number.isNaN(playerId)) {
      return res.status(400).json({ success: false, error: 'Valid player id is required.' });
    }

    const gameState = await requireCurrentPlayer(playerId, res);
    if (!gameState) {
      return;
    }

    const player = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    if (!(await requirePlacementPhaseComplete(player, res, 'fondazione città'))) {
      return;
    }

    if (!player.current_territory_id) {
      return res.status(400).json({ success: false, error: 'Player is not currently in a territory.' });
    }

    const territory = await get('SELECT * FROM territories WHERE id = ?', [player.current_territory_id]);
    if (!territory) {
      return res.status(404).json({ success: false, error: 'Current territory not found.' });
    }

    const development = await fetchPlayerDevelopmentInTerritory(playerId, territory.id);
    if (!development || Number(development.villages) < 3) {
      return res.status(400).json({ success: false, error: 'Servono 3 villaggi per fondare una città.' });
    }

    if (Number(player.resources) < FOUND_CITY_COST) {
      return res.status(400).json({ success: false, error: 'Risorse insufficienti per fondare una città.' });
    }

    await run('UPDATE players SET resources = resources - ? WHERE id = ?', [FOUND_CITY_COST, playerId]);
    await run('UPDATE territory_development SET villages = villages - 3, cities = cities + 1 WHERE id = ?', [development.id]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `${player.name} fonda una città nella ${territory.name} consumando 3 villaggi e 40 risorse.`,
      JSON.stringify({ territoryId: territory.id, territoryName: territory.name, villagesSpent: 3, citiesGained: 1, resourceCost: FOUND_CITY_COST })
    ]);

    res.json({ success: true, data: await buildSharedPayload(playerId) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players/:id/build-settlement', handleBuildShelter);

router.post('/settlements/:id/upgrade', async (_req, res) => {
  res.status(410).json({ success: false, error: 'La vecchia API di upgrade degli insediamenti non è più supportata. Usa /upgrade-to-village o /upgrade-to-city.' });
});

router.get('/events', async (_req, res) => {
  try {
    const events = await all('SELECT * FROM event_cards ORDER BY id');
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players/:id/draw-event', async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    const eventCardId = req.body.event_card_id ?? req.body.eventCardId;

    if (Number.isNaN(playerId)) {
      return res.status(400).json({ success: false, error: 'Valid player id is required.' });
    }

    const gameState = await requireCurrentPlayer(playerId, res);
    if (!gameState) {
      return;
    }

    const player = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    let eventCard;
    if (eventCardId) {
      eventCard = await get('SELECT * FROM event_cards WHERE id = ?', [Number(eventCardId)]);
    } else {
      eventCard = await get('SELECT * FROM event_cards ORDER BY RANDOM() LIMIT 1');
    }

    if (!eventCard) {
      return res.status(404).json({ success: false, error: 'No event card available.' });
    }

    let newResources = Number(player.resources);
    let logMessage = `${player.name} pesca ${eventCard.title}: ${eventCard.description}`;

    if (eventCard.effect_type === 'gain_resources') {
      newResources += Number(eventCard.effect_value);
      logMessage = `${player.name} pesca ${eventCard.title}: guadagna ${eventCard.effect_value} risorse.`;
    } else if (eventCard.effect_type === 'lose_resources') {
      newResources = Math.max(0, newResources - Number(eventCard.effect_value));
      const lostResources = Number(player.resources) - newResources;
      logMessage = `${player.name} pesca ${eventCard.title}: perde ${lostResources} risorse.`;
    } else if (eventCard.effect_type === 'lose_shelters') {
      const result = await loseDevelopments(playerId, 'shelters', Number(eventCard.effect_value));
      logMessage = result.lost === 0
        ? `${player.name} pesca ${eventCard.title}: non possiede ripari, nessuna perdita.`
        : `${player.name} pesca ${eventCard.title}: perde ${result.lost} ${result.lost === 1 ? 'riparo' : 'ripari'}.`;
    } else if (eventCard.effect_type === 'lose_villages') {
      const result = await loseDevelopments(playerId, 'villages', Number(eventCard.effect_value));
      logMessage = result.lost === 0
        ? `${player.name} pesca ${eventCard.title}: non possiede villaggi, nessuna perdita.`
        : `${player.name} pesca ${eventCard.title}: perde ${result.lost} ${result.lost === 1 ? 'villaggio' : 'villaggi'}.`;
    } else if (eventCard.effect_type === 'lose_city') {
      const result = await loseDevelopments(playerId, 'cities', 1);
      logMessage = result.lost === 0
        ? `${player.name} pesca ${eventCard.title}: non possiede città, nessuna perdita.`
        : `${player.name} pesca ${eventCard.title}: perde 1 città.`;
    } else if (eventCard.effect_type === 'gain_shelters') {
      if (!player.current_territory_id) {
        logMessage = `${player.name} pesca ${eventCard.title}: nessun territorio attuale, nessun riparo costruito.`;
      } else {
        const territory = await get('SELECT * FROM territories WHERE id = ?', [player.current_territory_id]);
        const development = await ensureDevelopmentRecord(playerId, player.current_territory_id);
        await run('UPDATE territory_development SET shelters = shelters + ? WHERE id = ?', [Number(eventCard.effect_value), development.id]);
        logMessage = `${player.name} pesca ${eventCard.title}: ottiene ${eventCard.effect_value} ripari nella ${territory.name}.`;
      }
    } else if (eventCard.effect_type === 'gain_village') {
      if (!player.current_territory_id) {
        logMessage = `${player.name} pesca ${eventCard.title}: nessun territorio attuale, nessun villaggio conquistato.`;
      } else {
        const territory = await get('SELECT * FROM territories WHERE id = ?', [player.current_territory_id]);
        const development = await ensureDevelopmentRecord(playerId, player.current_territory_id);
        await run('UPDATE territory_development SET villages = villages + ? WHERE id = ?', [Number(eventCard.effect_value), development.id]);
        logMessage = `${player.name} pesca ${eventCard.title}: conquista ${eventCard.effect_value} villaggio nella ${territory.name}.`;
      }
    }

    await run('UPDATE players SET resources = ? WHERE id = ?', [newResources, playerId]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      logMessage,
      JSON.stringify({ eventCardId: eventCard.id, effectType: eventCard.effect_type, effectValue: eventCard.effect_value })
    ]);

    res.json({
      success: true,
      data: {
        ...(await buildSharedPayload(playerId)),
        event: eventCard
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/log', async (_req, res) => {
  try {
    const logs = await all('SELECT * FROM game_log ORDER BY id DESC');
    res.json({ success: true, data: logs.map(serializeLogRow) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/turn/end', async (_req, res) => {
  try {
    const gameState = await ensureValidGameState();
    if (!gameState || !gameState.current_player_id) {
      return res.status(400).json({ success: false, error: 'Lo stato della partita non è inizializzato.' });
    }

    const players = await fetchPlayersForTurnOrder();
    if (players.length === 0) {
      return res.status(400).json({ success: false, error: 'No players found.' });
    }

    const currentIndex = players.findIndex((player) => Number(player.id) === Number(gameState.current_player_id));
    if (currentIndex === -1) {
      return res.status(400).json({ success: false, error: 'Il giocatore corrente non esiste più.' });
    }

    const isLastPlayer = currentIndex === players.length - 1;
    const nextPlayer = isLastPlayer ? players[0] : players[currentIndex + 1];
    const nextRound = isLastPlayer ? gameState.round + 1 : gameState.round;

    if (isLastPlayer) {
      await applyRoundMaintenance(players);
    }

    await run('UPDATE players SET has_moved_this_turn = 0, has_gathered_this_turn = 0');
    await run('UPDATE game_state SET current_player_id = ?, round = ? WHERE id = ?', [nextPlayer.id, nextRound, gameState.id]);

    const message = isLastPlayer
      ? `Fine round ${gameState.round}. Ora inizia il round ${nextRound}. Tocca ad ${nextPlayer.name}.`
      : `Fine turno di ${gameState.current_player_name}. Ora tocca a ${nextPlayer.name}.`;

    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      gameState.current_player_id,
      message,
      JSON.stringify({ fromPlayerId: gameState.current_player_id, toPlayerId: nextPlayer.id, round: nextRound })
    ]);

    const updatedGameState = await ensureValidGameState();
    res.json({ success: true, data: updatedGameState });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reset', async (_req, res) => {
  try {
    await resetGameSession(1);
    const payload = await buildSharedPayload();
    res.json({
      success: true,
      data: {
        message: 'Game reset successfully.',
        players: await fetchPlayersWithTerritories(),
        gameState: payload.gameState,
        territories: payload.territories,
        developments: payload.developments,
        log: payload.log
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
