const express = require('express');
const { run, get, all } = require('../db');

const router = express.Router();
const BUILD_COST = 5;
const UPGRADE_COSTS = {
  riparo: { nextLevel: 'villaggio', cost: 10 },
  villaggio: { nextLevel: 'citta', cost: 20 }
};
const NOT_CURRENT_TURN_ERROR = 'Non e il turno di questo giocatore.';

function serializeLogRow(row) {
  let details = row.details;
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details);
    } catch (_err) {
      details = details;
    }
  }
  return { ...row, details };
}

function serializeSettlementRow(row) {
  return {
    id: row.id,
    player_id: row.player_id,
    territory_id: row.territory_id,
    level: row.level,
    created_at: row.created_at,
    player_name: row.player_name,
    territory_name: row.territory_name
  };
}

async function fetchSettlements() {
  const settlements = await all(
    `SELECT settlements.id, settlements.player_id, settlements.territory_id, settlements.level, settlements.created_at,
            players.name AS player_name,
            territories.name AS territory_name
     FROM settlements
     LEFT JOIN players ON players.id = settlements.player_id
     LEFT JOIN territories ON territories.id = settlements.territory_id
     ORDER BY territories.position_y, territories.position_x, settlements.id`
  );

  return settlements.map(serializeSettlementRow);
}

async function fetchTerritoriesWithSettlements() {
  const territories = await all('SELECT * FROM territories ORDER BY position_y, position_x, id');
  const settlements = await fetchSettlements();
  const settlementsByTerritory = settlements.reduce((acc, settlement) => {
    if (!acc[settlement.territory_id]) {
      acc[settlement.territory_id] = [];
    }
    acc[settlement.territory_id].push(settlement);
    return acc;
  }, {});

  return territories.map((territory) => ({
    ...territory,
    settlements: settlementsByTerritory[territory.id] || []
  }));
}

async function fetchPlayerSettlementsByLevel(playerId, level, limit) {
  return all(
    `SELECT id, territory_id, level
     FROM settlements
     WHERE player_id = ? AND level = ?
     ORDER BY id
     LIMIT ?`,
    [playerId, level, limit]
  );
}

async function deleteSettlementsByIds(ids) {
  for (const settlementId of ids) {
    await run('DELETE FROM settlements WHERE id = ?', [settlementId]);
  }
}

async function fetchPlayerSettlementInTerritory(playerId, territoryId) {
  if (!territoryId) {
    return null;
  }

  return get(
    `SELECT settlements.id, settlements.player_id, settlements.territory_id, settlements.level, settlements.created_at,
            players.name AS player_name,
            territories.name AS territory_name
     FROM settlements
     LEFT JOIN players ON players.id = settlements.player_id
     LEFT JOIN territories ON territories.id = settlements.territory_id
     WHERE settlements.player_id = ? AND settlements.territory_id = ?`,
    [playerId, territoryId]
  );
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

async function requireCurrentPlayer(playerId, res) {
  const gameState = await fetchGameState();

  if (!gameState || !gameState.current_player_id) {
    res.status(400).json({ success: false, error: 'Lo stato della partita non e inizializzato.' });
    return null;
  }

  if (gameState.current_player_id !== playerId) {
    res.status(400).json({ success: false, error: NOT_CURRENT_TURN_ERROR });
    return null;
  }

  return gameState;
}

router.get('/players', async (_req, res) => {
  try {
    const players = await all('SELECT players.id, players.name, players.tribe, players.resources, players.current_territory_id, territories.name AS current_territory_name FROM players LEFT JOIN territories ON territories.id = players.current_territory_id ORDER BY players.id');
    const purchasedBeliefs = await all('SELECT player_id, belief_card_id FROM player_beliefs ORDER BY player_id, belief_card_id');

    const ownedBeliefsByPlayer = purchasedBeliefs.reduce((acc, row) => {
      if (!acc[row.player_id]) {
        acc[row.player_id] = [];
      }
      acc[row.player_id].push(row.belief_card_id);
      return acc;
    }, {});

    const playersWithBeliefs = players.map((player) => ({
      ...player,
      owned_belief_ids: ownedBeliefsByPlayer[player.id] || []
    }));

    res.json({ success: true, data: playersWithBeliefs });
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
    const gameState = await fetchGameState();

    if (!gameState) {
      return res.status(404).json({ success: false, error: 'Game state not found.' });
    }

    res.json({ success: true, data: gameState });
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

    await run('UPDATE players SET resources = resources - ? WHERE id = ?', [beliefCard.cost, playerId]);
    await run('INSERT INTO player_beliefs (player_id, belief_card_id) VALUES (?, ?)', [playerId, beliefCardId]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `Bought belief: ${beliefCard.name}`,
      JSON.stringify({ beliefCardId, cost: beliefCard.cost })
    ]);

    const updatedPlayer = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    res.json({ success: true, data: { player: updatedPlayer, belief: beliefCard } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/territories', async (_req, res) => {
  try {
    const territories = await fetchTerritoriesWithSettlements();
    res.json({ success: true, data: territories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players/:id/move', async (req, res) => {
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
    const territory = await get('SELECT * FROM territories WHERE id = ?', [territoryId]);

    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    if (!territory) {
      return res.status(404).json({ success: false, error: 'Territory not found.' });
    }

    await run('UPDATE players SET current_territory_id = ? WHERE id = ?', [territoryId, playerId]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `${player.name} si sposta nel territorio ${territory.name}.`,
      JSON.stringify({ territoryId, territoryName: territory.name })
    ]);

    const updatedPlayer = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    res.json({ success: true, data: { player: updatedPlayer, territory } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/settlements', async (_req, res) => {
  try {
    const settlements = await fetchSettlements();
    res.json({ success: true, data: settlements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/players/:id/build-settlement', async (req, res) => {
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

    if (player.resources < BUILD_COST) {
      return res.status(400).json({ success: false, error: 'Risorse insufficienti: servono 5 risorse per costruire un riparo.' });
    }

    if (!player.current_territory_id) {
      return res.status(400).json({ success: false, error: 'Player is not currently in a territory.' });
    }

    const territory = await get('SELECT * FROM territories WHERE id = ?', [player.current_territory_id]);
    if (!territory) {
      return res.status(404).json({ success: false, error: 'Current territory not found.' });
    }

    const existingSettlement = await fetchPlayerSettlementInTerritory(playerId, player.current_territory_id);
    if (existingSettlement) {
      return res.status(400).json({ success: false, error: 'Hai gia un insediamento in questo territorio.' });
    }

    await run('UPDATE players SET resources = resources - ? WHERE id = ?', [BUILD_COST, playerId]);
    const settlementResult = await run('INSERT INTO settlements (player_id, territory_id, level) VALUES (?, ?, ?)', [playerId, player.current_territory_id, 'riparo']);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `${player.name} costruisce un riparo nel territorio ${territory.name}.`,
      JSON.stringify({ settlementId: settlementResult.lastID, level: 'riparo', territoryId: territory.id })
    ]);

    const updatedPlayer = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    const settlement = await get('SELECT settlements.id, settlements.player_id, settlements.territory_id, settlements.level, settlements.created_at, players.name AS player_name, territories.name AS territory_name FROM settlements LEFT JOIN players ON players.id = settlements.player_id LEFT JOIN territories ON territories.id = settlements.territory_id WHERE settlements.id = ?', [settlementResult.lastID]);
    const settlements = await fetchSettlements();
    const territories = await fetchTerritoriesWithSettlements();
    res.json({
      success: true,
      data: {
        player: updatedPlayer,
        settlement: serializeSettlementRow(settlement),
        settlements,
        territories,
        territory
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/settlements/:id/upgrade', async (req, res) => {
  try {
    const settlementId = Number(req.params.id);

    if (Number.isNaN(settlementId)) {
      return res.status(400).json({ success: false, error: 'Valid settlement id is required.' });
    }

    const settlement = await get('SELECT settlements.id, settlements.player_id, settlements.territory_id, settlements.level, settlements.created_at, players.name AS player_name, territories.name AS territory_name FROM settlements LEFT JOIN players ON players.id = settlements.player_id LEFT JOIN territories ON territories.id = settlements.territory_id WHERE settlements.id = ?', [settlementId]);
    if (!settlement) {
      return res.status(404).json({ success: false, error: 'Settlement not found.' });
    }

    const player = await get('SELECT * FROM players WHERE id = ?', [settlement.player_id]);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player not found.' });
    }

    const gameState = await requireCurrentPlayer(settlement.player_id, res);
    if (!gameState) {
      return;
    }

    const upgradePlan = UPGRADE_COSTS[settlement.level];

    if (!upgradePlan) {
      return res.status(400).json({ success: false, error: 'Questo insediamento e gia una citta e non puo essere migliorato oltre.' });
    }

    if (player.resources < upgradePlan.cost) {
      return res.status(400).json({ success: false, error: `Risorse insufficienti: servono ${upgradePlan.cost} risorse per migliorare a ${upgradePlan.nextLevel}.` });
    }

    await run('UPDATE players SET resources = resources - ? WHERE id = ?', [upgradePlan.cost, settlement.player_id]);
    await run('UPDATE settlements SET level = ? WHERE id = ?', [upgradePlan.nextLevel, settlementId]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      settlement.player_id,
      `${player.name} migliora un ${settlement.level} in ${upgradePlan.nextLevel} nel territorio ${settlement.territory_name}.`,
      JSON.stringify({ settlementId, fromLevel: settlement.level, toLevel: upgradePlan.nextLevel })
    ]);

    const updatedPlayer = await get('SELECT * FROM players WHERE id = ?', [player.id]);
    const updatedSettlement = await get('SELECT settlements.id, settlements.player_id, settlements.territory_id, settlements.level, settlements.created_at, players.name AS player_name, territories.name AS territory_name FROM settlements LEFT JOIN players ON players.id = settlements.player_id LEFT JOIN territories ON territories.id = settlements.territory_id WHERE settlements.id = ?', [settlementId]);
    const settlements = await fetchSettlements();
    const territories = await fetchTerritoriesWithSettlements();
    res.json({
      success: true,
      data: {
        player: updatedPlayer,
        settlement: serializeSettlementRow(updatedSettlement),
        settlements,
        territories
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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

    let newResources = player.resources;
    let logMessage = `${player.name} pesca ${eventCard.title}: ${eventCard.description}`;

    if (eventCard.effect_type === 'gain_resources') {
      newResources = player.resources + eventCard.effect_value;
      logMessage = `${player.name} pesca ${eventCard.title}: guadagna ${eventCard.effect_value} risorse.`;
    } else if (eventCard.effect_type === 'lose_resources') {
      newResources = Math.max(0, player.resources - eventCard.effect_value);
      const lostResources = player.resources - newResources;
      logMessage = `${player.name} pesca ${eventCard.title}: perde ${lostResources} risorse.`;
    } else if (eventCard.effect_type === 'lose_shelters') {
      const shelters = await fetchPlayerSettlementsByLevel(playerId, 'riparo', eventCard.effect_value);
      await deleteSettlementsByIds(shelters.map((settlement) => settlement.id));
      if (shelters.length === 0) {
        logMessage = `${player.name} pesca ${eventCard.title}: non possiede ripari, nessuna perdita.`;
      } else {
        logMessage = `${player.name} pesca ${eventCard.title}: perde ${shelters.length} ${shelters.length === 1 ? 'riparo' : 'ripari'}.`;
      }
    } else if (eventCard.effect_type === 'lose_villages') {
      const villages = await fetchPlayerSettlementsByLevel(playerId, 'villaggio', eventCard.effect_value);
      await deleteSettlementsByIds(villages.map((settlement) => settlement.id));
      if (villages.length === 0) {
        logMessage = `${player.name} pesca ${eventCard.title}: non possiede villaggi, nessuna perdita.`;
      } else {
        logMessage = `${player.name} pesca ${eventCard.title}: perde ${villages.length} ${villages.length === 1 ? 'villaggio' : 'villaggi'}.`;
      }
    } else if (eventCard.effect_type === 'lose_city') {
      const cities = await fetchPlayerSettlementsByLevel(playerId, 'citta', 1);
      await deleteSettlementsByIds(cities.map((settlement) => settlement.id));
      if (cities.length === 0) {
        logMessage = `${player.name} pesca ${eventCard.title}: non possiede citta, nessuna perdita.`;
      } else {
        logMessage = `${player.name} pesca ${eventCard.title}: perde 1 citta.`;
      }
    } else if (eventCard.effect_type === 'gain_shelters') {
      if (!player.current_territory_id) {
        logMessage = `${player.name} pesca ${eventCard.title}: nessun territorio attuale, nessun riparo costruito.`;
      } else {
        const existingSettlement = await fetchPlayerSettlementInTerritory(playerId, player.current_territory_id);
        if (existingSettlement) {
          logMessage = `${player.name} pesca ${eventCard.title}: ha gia un insediamento in questo territorio, nessun nuovo riparo.`;
        } else {
          await run('INSERT INTO settlements (player_id, territory_id, level) VALUES (?, ?, ?)', [playerId, player.current_territory_id, 'riparo']);
          logMessage = `${player.name} pesca ${eventCard.title}: costruisce 1 riparo nel territorio attuale.`;
        }
      }
    } else if (eventCard.effect_type === 'gain_village') {
      if (!player.current_territory_id) {
        logMessage = `${player.name} pesca ${eventCard.title}: nessun territorio attuale, nessun villaggio conquistato.`;
      } else {
        const existingSettlement = await fetchPlayerSettlementInTerritory(playerId, player.current_territory_id);
        if (!existingSettlement) {
          await run('INSERT INTO settlements (player_id, territory_id, level) VALUES (?, ?, ?)', [playerId, player.current_territory_id, 'villaggio']);
          logMessage = `${player.name} pesca ${eventCard.title}: conquista 1 villaggio.`;
        } else if (existingSettlement.level === 'riparo') {
          await run('UPDATE settlements SET level = ? WHERE id = ?', ['villaggio', existingSettlement.id]);
          logMessage = `${player.name} pesca ${eventCard.title}: il riparo nel territorio attuale diventa un villaggio.`;
        } else if (existingSettlement.level === 'villaggio') {
          logMessage = `${player.name} pesca ${eventCard.title}: possiede gia un villaggio in questo territorio, nessun cambiamento.`;
        } else {
          logMessage = `${player.name} pesca ${eventCard.title}: possiede gia una citta in questo territorio, nessun cambiamento.`;
        }
      }
    }

    await run('UPDATE players SET resources = ? WHERE id = ?', [newResources, playerId]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      logMessage,
      JSON.stringify({ eventCardId: eventCard.id, effectType: eventCard.effect_type, effectValue: eventCard.effect_value })
    ]);

    const updatedPlayer = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    const settlements = await fetchSettlements();
    const territories = await fetchTerritoriesWithSettlements();
    const log = await all('SELECT * FROM game_log ORDER BY id DESC');
    res.json({
      success: true,
      data: {
        player: updatedPlayer,
        event: eventCard,
        settlements,
        territories,
        log: log.map(serializeLogRow)
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
    const gameState = await fetchGameState();
    if (!gameState || !gameState.current_player_id) {
      return res.status(400).json({ success: false, error: 'Lo stato della partita non e inizializzato.' });
    }

    const players = await all('SELECT id, name FROM players ORDER BY id');
    if (players.length === 0) {
      return res.status(400).json({ success: false, error: 'No players found.' });
    }

    const currentIndex = players.findIndex((player) => player.id === gameState.current_player_id);
    if (currentIndex === -1) {
      return res.status(400).json({ success: false, error: 'Il giocatore corrente non esiste piu.' });
    }

    const isLastPlayer = currentIndex === players.length - 1;
    const nextPlayer = isLastPlayer ? players[0] : players[currentIndex + 1];
    const nextRound = isLastPlayer ? gameState.round + 1 : gameState.round;

    await run('UPDATE game_state SET current_player_id = ?, round = ? WHERE id = ?', [nextPlayer.id, nextRound, gameState.id]);

    const message = isLastPlayer
      ? `Fine round ${gameState.round}. Ora inizia il round ${nextRound}. Tocca ad ${nextPlayer.name}.`
      : `Fine turno di ${gameState.current_player_name}. Ora tocca a ${nextPlayer.name}.`;

    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      gameState.current_player_id,
      message,
      JSON.stringify({ fromPlayerId: gameState.current_player_id, toPlayerId: nextPlayer.id, round: nextRound })
    ]);

    const updatedGameState = await fetchGameState();
    res.json({ success: true, data: updatedGameState });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reset', async (_req, res) => {
  try {
    const forest = await get('SELECT id FROM territories WHERE name = ?', ['Foresta']);
    const plain = await get('SELECT id FROM territories WHERE name = ?', ['Pianura']);
    const cave = await get('SELECT id FROM territories WHERE name = ?', ['Grotta']);
    const ayla = await get('SELECT id FROM players WHERE name = ?', ['Ayla']);

    await run('DELETE FROM player_beliefs');
    await run('DELETE FROM game_log');
    await run('DELETE FROM settlements');
    await run('UPDATE players SET resources = 10, current_territory_id = CASE name WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? ELSE NULL END', ['Ayla', forest?.id ?? null, 'Bram', plain?.id ?? null, 'Iria', cave?.id ?? null]);
    await run('DELETE FROM game_state');
    await run('INSERT INTO game_state (current_player_id, round) VALUES (?, ?)', [ayla?.id ?? null, 1]);

    const players = await all('SELECT players.id, players.name, players.tribe, players.resources, players.current_territory_id, territories.name AS current_territory_name FROM players LEFT JOIN territories ON territories.id = players.current_territory_id ORDER BY players.id');
    const gameState = await fetchGameState();
    res.json({ success: true, data: { message: 'Game reset successfully.', players, gameState } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
