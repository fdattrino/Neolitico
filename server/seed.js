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
    { number: 1, title: 'Venerazione degli antenati', description: 'La comunità onora i defunti e li considera guide del presente.', technology: 'Rituali sacri', type_code: 'spiritual', cost: 2, effect_text: 'Ottieni +1 di coesione in ogni villaggio.' },
    { number: 2, title: 'Totem animale', description: 'Ogni clan associa il suo destino a un animale simbolico.', technology: 'Riti di clan', type_code: 'spiritual', cost: 2, effect_text: 'Riduci il rischio di carestia nelle campagne di caccia.' },
    { number: 3, title: 'Rito di fertilità', description: 'Le cerimonie favoriscono la fecondità della terra e della comunità.', technology: 'Cerimonie di primavera', type_code: 'agricultural', cost: 3, effect_text: 'Aumenta il raccolto di +1 durante la stagione favorevole.' },
    { number: 4, title: 'Calendario lunare', description: 'Il tempo viene scandito dai cicli della luna per pianificare raccolti e cacce.', technology: 'Osservazione astrale', type_code: 'scientific', cost: 3, effect_text: 'Aggiungi +1 alle azioni pianificate in tempo utile.' },
    { number: 5, title: 'Focolare comune', description: 'Il fuoco del villaggio diventa simbolo di unione e continuità.', technology: 'Gestione del fuoco', type_code: 'social', cost: 3, effect_text: 'Guadagni +1 di stabilità per il gruppo.' },
    { number: 6, title: 'Banchetto rituale', description: 'Le feste condivise rafforzano il legame tra i membri della tribù.', technology: 'Cucina collettiva', type_code: 'social', cost: 2, effect_text: 'Ottieni +1 cibo per ogni grande raccolta.' },
    { number: 7, title: 'Armi di pietra', description: 'Le lame e gli strumenti in pietra migliorano la caccia e la difesa.', technology: 'Lavorazione litica', type_code: 'material', cost: 4, effect_text: 'Aumenta la sicurezza del villaggio di +1.' },
    { number: 8, title: 'Scambio di selce', description: 'Il commercio di selce amplia i contatti con altri gruppi.', technology: 'Commercio di risorse', type_code: 'economic', cost: 4, effect_text: 'Ottieni +1 risorsa in ogni scambio.' },
    { number: 9, title: 'Migrazione stagionale', description: 'La comunità si sposta seguendo le migrazioni degli animali.', technology: 'Spostamenti nomadi', type_code: 'expansion', cost: 3, effect_text: 'Aggiungi +1 alle opportunità di caccia.' },
    { number: 10, title: 'Coltivazione del grano', description: 'L’agricoltura diventa una pratica stabile e condivisa.', technology: 'Agricoltura primitiva', type_code: 'agricultural', cost: 4, effect_text: 'Aumenta il cibo di +2 a fine stagione.' },
    { number: 11, title: 'Ceramica domestica', description: 'La ceramica rende più sicure le riserve e i trasporti.', technology: 'Vasellame', type_code: 'material', cost: 4, effect_text: 'Aumenta le scorte di cibo di +1.' },
    { number: 12, title: 'Tessitura della lana', description: 'La lavorazione dei tessuti protegge il villaggio dal freddo.', technology: 'Lavorazione dei filati', type_code: 'material', cost: 3, effect_text: 'Riduci il dispendio di risorse in inverno.' },
    { number: 13, title: 'Difesa del villaggio', description: 'Le mura e le postazioni difensive rendono la comunità più protetta.', technology: 'Architettura difensiva', type_code: 'defensive', cost: 5, effect_text: 'Guadagni +2 di difesa in caso di attacco.' },
    { number: 14, title: 'Navigazione fluviale', description: 'Le imbarcazioni permettono di attraversare fiumi e raggiungere nuove terre.', technology: 'Barche di legno', type_code: 'expansion', cost: 5, effect_text: 'Aggiungi +1 accesso a nuove risorse.' },
    { number: 15, title: 'Allevamento di bovini', description: 'L’allevamento riduce la dipendenza dalla caccia.', technology: 'Pastorizia', type_code: 'agricultural', cost: 4, effect_text: 'Aumenta il cibo di +1 a ogni ciclo.' },
    { number: 16, title: 'Apicoltura', description: 'Le api offrono miele, una risorsa preziosa e nutriente.', technology: 'Coltivazione di api', type_code: 'economic', cost: 3, effect_text: 'Ottieni +1 risorsa di lusso.' },
    { number: 17, title: 'Monumenti megalitici', description: 'Le strutture monumentali celebrano la forza della comunità.', technology: 'Costruzioni cerimoniali', type_code: 'social', cost: 5, effect_text: 'Raddoppia l’effetto simbolico delle credenze.' },
    { number: 18, title: 'Alleanze commerciali', description: 'Gli accordi con altre comunità ampliano la rete di scambi.', technology: 'Diplomazia del villaggio', type_code: 'economic', cost: 4, effect_text: 'Aumenta i benefici degli scambi di +1.' },
    { number: 19, title: 'Sepolture sacre', description: 'Le sepolture elaborate rafforzano la memoria collettiva.', technology: 'Riti funerari', type_code: 'spiritual', cost: 3, effect_text: 'Aumenta la stabilità del villaggio di +1.' },
    { number: 20, title: 'Narrazione orale', description: 'Le storie tramandano conoscenze e valori tra le generazioni.', technology: 'Tradizione orale', type_code: 'social', cost: 2, effect_text: 'Ottieni +1 di conoscenza per il gruppo.' },
    { number: 21, title: 'Erboristeria', description: 'Le piante medicinali migliorano la salute della comunità.', technology: 'Piante curative', type_code: 'scientific', cost: 3, effect_text: 'Riduci le perdite di risorse in caso di malattia.' },
    { number: 22, title: 'Lavoro cooperativo', description: 'Le grandi costruzioni richiedono organizzazione e collaborazione.', technology: 'Coordinamento collettivo', type_code: 'social', cost: 4, effect_text: 'Aumenta la produttività di +2 nelle costruzioni.' }
  ];

  for (const belief of beliefCards) {
    await run('INSERT INTO belief_cards (name, title, description, technology, type_code, cost, effect_text, number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [belief.title, belief.title, belief.description, belief.technology, belief.type_code, belief.cost, belief.effect_text, belief.number]);
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
