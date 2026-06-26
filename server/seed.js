const { initDb, run } = require('./db');

async function seed() {
  await initDb();

  await run('DELETE FROM player_beliefs');
  await run('DELETE FROM game_log');
  await run('DELETE FROM players');
  await run('DELETE FROM belief_cards');
  await run('DELETE FROM event_cards');

  const players = [
    { name: 'Ayla', tribe: 'Cacciatrice', resources: 12 },
    { name: 'Bram', tribe: 'Costruttore', resources: 10 },
    { name: 'Iria', tribe: 'Guaritrice', resources: 11 }
  ];

  for (const player of players) {
    await run('INSERT INTO players (name, tribe, resources) VALUES (?, ?, ?)', [player.name, player.tribe, player.resources]);
  }

  const beliefCards = [
    { name: 'Animismo', description: 'La tribù interpreta i segni della natura come messaggi degli antenati.', cost: 4 },
    { name: 'Scambio di pietra', description: 'Un accordo con vicini aumenta l accesso alle risorse.', cost: 3 },
    { name: 'Ruolo del fuoco', description: 'La gestione del fuoco accelera la cucina e la coesione.', cost: 5 }
  ];

  for (const belief of beliefCards) {
    await run('INSERT INTO belief_cards (name, description, cost) VALUES (?, ?, ?)', [belief.name, belief.description, belief.cost]);
  }

  const eventCards = [
    { title: 'Marea abbondante', description: 'La pesca è ricca e la tribù raccoglie cibo in abbondanza.', effect_type: 'gain_resources', effect_value: 3 },
    { title: 'Inverno rigido', description: 'Le temperature scendono e i rifornimenti diminuiscono.', effect_type: 'lose_resources', effect_value: 2 },
    { title: 'Scoperta di una cava', description: 'Una nuova cava offre materiale per nuove costruzioni.', effect_type: 'gain_resources', effect_value: 4 }
  ];

  for (const event of eventCards) {
    await run('INSERT INTO event_cards (title, description, effect_type, effect_value) VALUES (?, ?, ?, ?)', [event.title, event.description, event.effect_type, event.effect_value]);
  }

  console.log('Seed data inserted into neolitico.sqlite');
}

seed().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
