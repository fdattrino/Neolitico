const express = require('express');
const { run, get, all } = require('../db');

const router = express.Router();

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

router.post('/players/:id/buy-belief', async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    const beliefCardId = Number(req.body.belief_card_id ?? req.body.beliefCardId);

    if (!beliefCardId || Number.isNaN(playerId)) {
      return res.status(400).json({ success: false, error: 'Valid player id and belief card id are required.' });
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
    const territories = await all('SELECT * FROM territories ORDER BY position_y, position_x, id');
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
    if (eventCard.effect_type === 'gain_resources') {
      newResources = player.resources + eventCard.effect_value;
    } else if (eventCard.effect_type === 'lose_resources') {
      newResources = Math.max(0, player.resources - eventCard.effect_value);
    }

    await run('UPDATE players SET resources = ? WHERE id = ?', [newResources, playerId]);
    await run('INSERT INTO game_log (player_id, message, details) VALUES (?, ?, ?)', [
      playerId,
      `Drew event: ${eventCard.title}`,
      eventCard.description
    ]);

    const updatedPlayer = await get('SELECT * FROM players WHERE id = ?', [playerId]);
    res.json({ success: true, data: { player: updatedPlayer, event: eventCard } });
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

router.post('/reset', async (_req, res) => {
  try {
    const forest = await get('SELECT id FROM territories WHERE name = ?', ['Foresta']);
    const plain = await get('SELECT id FROM territories WHERE name = ?', ['Pianura']);
    const cave = await get('SELECT id FROM territories WHERE name = ?', ['Grotta']);

    await run('DELETE FROM player_beliefs');
    await run('DELETE FROM game_log');
    await run('UPDATE players SET resources = 10, current_territory_id = CASE name WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? ELSE NULL END', ['Ayla', forest?.id ?? null, 'Bram', plain?.id ?? null, 'Iria', cave?.id ?? null]);

    const players = await all('SELECT players.id, players.name, players.tribe, players.resources, players.current_territory_id, territories.name AS current_territory_name FROM players LEFT JOIN territories ON territories.id = players.current_territory_id ORDER BY players.id');
    res.json({ success: true, data: { message: 'Game reset successfully.', players } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
