const territories = [
  { name: 'Foresta', terrain_type: 'bosco', description: 'Territorio ricco di caccia, legna e frutti selvatici.', resource_bonus: 'caccia', position_x: 0, position_y: 0, total_prey: 10 },
  { name: 'Fiume', terrain_type: 'acqua', description: 'Favorisce pesca, irrigazione e spostamenti.', resource_bonus: 'pesca', position_x: 1, position_y: 0, total_prey: 7 },
  { name: 'Collina', terrain_type: 'altura', description: 'Zona adatta alla difesa e alla ricerca di selce.', resource_bonus: 'selce', position_x: 2, position_y: 0, total_prey: 6 },
  { name: 'Pianura', terrain_type: 'pianura', description: 'Territorio favorevole all\'agricoltura.', resource_bonus: 'agricoltura', position_x: 0, position_y: 1, total_prey: 8 },
  { name: 'Lago', terrain_type: 'acqua', description: 'Offre pesca, canneti e risorse alimentari.', resource_bonus: 'pesca', position_x: 1, position_y: 1, total_prey: 8 },
  { name: 'Montagna', terrain_type: 'montagna', description: 'Territorio difficile ma ricco di pietra e minerali.', resource_bonus: 'pietra', position_x: 2, position_y: 1, total_prey: 5 },
  { name: 'Costa', terrain_type: 'mare', description: 'Offre crostacei, pesca e contatti con altri gruppi.', resource_bonus: 'crostacei', position_x: 0, position_y: 2, total_prey: 9 },
  { name: 'Grotta', terrain_type: 'riparo', description: 'Luogo di rifugio, pitture rupestri e riti.', resource_bonus: 'riparo', position_x: 1, position_y: 2, total_prey: 5 },
  { name: 'Valle', terrain_type: 'valle', description: 'Area adatta alla nascita di villaggi stabili.', resource_bonus: 'insediamento', position_x: 2, position_y: 2, total_prey: 8 }
];

const players = [
  { name: 'Ayla', tribe: 'Cacciatrice', resources: 10, starting_territory: 'Foresta' },
  { name: 'Bram', tribe: 'Costruttore', resources: 10, starting_territory: 'Pianura' }
];

const resetPlayers = [
  { name: 'Ayla', tribe: 'Cacciatrice', resources: 10, starting_territory: 'Foresta' },
  { name: 'Bram', tribe: 'Costruttore', resources: 10, starting_territory: 'Pianura' }
];

const beliefCards = [
  { number: 1, title: 'Venerazione degli antenati', description: 'La comunità onora i defunti e li considera guide del presente.', technology: 'Rituali sacri', type_code: 'spiritual', cost: 2, resource_gain: 2, effect_text: 'Ottieni +1 di coesione in ogni villaggio.' },
  { number: 2, title: 'Totem animale', description: 'Ogni clan associa il suo destino a un animale simbolico.', technology: 'Riti di clan', type_code: 'spiritual', cost: 2, resource_gain: 2, effect_text: 'Riduci il rischio di carestia nelle campagne di caccia.' },
  { number: 3, title: 'Rito di fertilità', description: 'Le cerimonie favoriscono la fecondità della terra e della comunità.', technology: 'Cerimonie di primavera', type_code: 'agricultural', cost: 3, resource_gain: 3, effect_text: 'Aumenta il raccolto di +1 durante la stagione favorevole.' },
  { number: 4, title: 'Calendario lunare', description: 'Il tempo viene scandito dai cicli della luna per pianificare raccolti e cacce.', technology: 'Osservazione astrale', type_code: 'scientific', cost: 3, resource_gain: 3, effect_text: 'Aggiungi +1 alle azioni pianificate in tempo utile.' },
  { number: 5, title: 'Focolare comune', description: 'Il fuoco del villaggio diventa simbolo di unione e continuità.', technology: 'Gestione del fuoco', type_code: 'social', cost: 3, resource_gain: 3, effect_text: 'Guadagni +1 di stabilità per il gruppo.' },
  { number: 6, title: 'Banchetto rituale', description: 'Le feste condivise rafforzano il legame tra i membri della tribù.', technology: 'Cucina collettiva', type_code: 'social', cost: 2, resource_gain: 2, effect_text: 'Ottieni +1 cibo per ogni grande raccolta.' },
  { number: 7, title: 'Armi di pietra', description: 'Le lame e gli strumenti in pietra migliorano la caccia e la difesa.', technology: 'Lavorazione litica', type_code: 'material', cost: 4, resource_gain: 3, effect_text: 'Aumenta la sicurezza del villaggio di +1.' },
  { number: 8, title: 'Scambio di selce', description: 'Il commercio di selce amplia i contatti con altri gruppi.', technology: 'Commercio di risorse', type_code: 'economic', cost: 4, resource_gain: 3, effect_text: 'Ottieni +1 risorsa in ogni scambio.' },
  { number: 9, title: 'Migrazione stagionale', description: 'La comunità si sposta seguendo le migrazioni degli animali.', technology: 'Spostamenti nomadi', type_code: 'expansion', cost: 3, resource_gain: 3, effect_text: 'Aggiungi +1 alle opportunità di caccia.' },
  { number: 10, title: 'Coltivazione del grano', description: 'L’agricoltura diventa una pratica stabile e condivisa.', technology: 'Agricoltura primitiva', type_code: 'agricultural', cost: 4, resource_gain: 3, effect_text: 'Aumenta il cibo di +2 a fine stagione.' },
  { number: 11, title: 'Ceramica domestica', description: 'La ceramica rende più sicure le riserve e i trasporti.', technology: 'Vasellame', type_code: 'material', cost: 4, resource_gain: 3, effect_text: 'Aumenta le scorte di cibo di +1.' },
  { number: 12, title: 'Tessitura della lana', description: 'La lavorazione dei tessuti protegge il villaggio dal freddo.', technology: 'Lavorazione dei filati', type_code: 'material', cost: 3, resource_gain: 3, effect_text: 'Riduci il dispendio di risorse in inverno.' },
  { number: 13, title: 'Difesa del villaggio', description: 'Le mura e le postazioni difensive rendono la comunità più protetta.', technology: 'Architettura difensiva', type_code: 'defensive', cost: 5, resource_gain: 5, effect_text: 'Guadagni +2 di difesa in caso di attacco.' },
  { number: 14, title: 'Navigazione fluviale', description: 'Le imbarcazioni permettono di attraversare fiumi e raggiungere nuove terre.', technology: 'Barche di legno', type_code: 'expansion', cost: 5, resource_gain: 5, effect_text: 'Aggiungi +1 accesso a nuove risorse.' },
  { number: 15, title: 'Allevamento di bovini', description: 'L’allevamento riduce la dipendenza dalla caccia.', technology: 'Pastorizia', type_code: 'agricultural', cost: 4, resource_gain: 3, effect_text: 'Aumenta il cibo di +1 a ogni ciclo.' },
  { number: 16, title: 'Apicoltura', description: 'Le api offrono miele, una risorsa preziosa e nutriente.', technology: 'Coltivazione di api', type_code: 'economic', cost: 3, resource_gain: 3, effect_text: 'Ottieni +1 risorsa di lusso.' },
  { number: 17, title: 'Monumenti megalitici', description: 'Le strutture monumentali celebrano la forza della comunità.', technology: 'Costruzioni cerimoniali', type_code: 'social', cost: 5, resource_gain: 5, effect_text: 'Raddoppia l’effetto simbolico delle credenze.' },
  { number: 18, title: 'Alleanze commerciali', description: 'Gli accordi con altre comunità ampliano la rete di scambi.', technology: 'Diplomazia del villaggio', type_code: 'economic', cost: 4, resource_gain: 3, effect_text: 'Aumenta i benefici degli scambi di +1.' },
  { number: 19, title: 'Sepolture sacre', description: 'Le sepolture elaborate rafforzano la memoria collettiva.', technology: 'Riti funerari', type_code: 'spiritual', cost: 3, resource_gain: 3, effect_text: 'Aumenta la stabilità del villaggio di +1.' },
  { number: 20, title: 'Narrazione orale', description: 'Le storie tramandano conoscenze e valori tra le generazioni.', technology: 'Tradizione orale', type_code: 'social', cost: 2, resource_gain: 2, effect_text: 'Ottieni +1 di conoscenza per il gruppo.' },
  { number: 21, title: 'Erboristeria', description: 'Le piante medicinali migliorano la salute della comunità.', technology: 'Piante curative', type_code: 'scientific', cost: 3, resource_gain: 3, effect_text: 'Riduci le perdite di risorse in caso di malattia.' },
  { number: 22, title: 'Lavoro cooperativo', description: 'Le grandi costruzioni richiedono organizzazione e collaborazione.', technology: 'Coordinamento collettivo', type_code: 'social', cost: 4, resource_gain: 3, effect_text: 'Aumenta la produttività di +2 nelle costruzioni.' }
];

const eventCards = [
  { title: 'Giacimento di selce', description: 'Una cava di selce emerge tra le rocce e la tribù raccoglie materiale prezioso.', effect_type: 'gain_resources', effect_value: 20 },
  { title: 'Incendio', description: 'Un incendio distrugge riserve e attrezzi, lasciando la comunità più povera.', effect_type: 'lose_resources', effect_value: 15 },
  { title: 'Pioggia abbondante', description: 'Le piogge rigenerano il terreno e rendono la caccia più proficua.', effect_type: 'gain_resources', effect_value: 20 },
  { title: 'Inverno rigido', description: 'Le basse temperature costringono la tribù a consumare più risorse per sopravvivere.', effect_type: 'lose_resources', effect_value: 20 },
  { title: 'Rito propiziatorio della caccia', description: 'Il rito sostiene la caccia e porta fortuna alla comunità.', effect_type: 'gain_resources', effect_value: 20 },
  { title: 'Siccità', description: 'La mancanza d’acqua rende difficili raccolta e trasporto.', effect_type: 'lose_resources', effect_value: 15 },
  { title: 'Raccolta di miele', description: 'Una colonia di api offre un prezioso bottino di miele e dolcezze.', effect_type: 'gain_resources', effect_value: 10 },
  { title: 'Malattia', description: 'Una malattia colpisce il villaggio: si perdono 3 ripari o 1 villaggio.', effect_type: 'lose_shelters', effect_value: 3 },
  { title: 'Eruzione vulcanica', description: 'L’eruzione distrugge parte del territorio e costringe la tribù a perdere 2 ripari o 1 villaggio.', effect_type: 'lose_shelters', effect_value: 2 },
  { title: 'Sconfitta in battaglia', description: 'La tribù esce sconfitta e perde 2 villaggi.', effect_type: 'lose_villages', effect_value: 2 },
  { title: 'Assalto fortunato', description: 'Un attacco ben riuscito conquista 1 villaggio se la tribù ne possiede già uno.', effect_type: 'gain_village', effect_value: 1 },
  { title: 'Migrazione di animali', description: 'Gli animali si spostano verso nuovi pascoli e il popolo trova abbondanza.', effect_type: 'gain_resources', effect_value: 30 },
  { title: 'Scoperta del formaggio', description: 'Un nuovo metodo di conservazione del latte porta a un surplus di cibo.', effect_type: 'gain_resources', effect_value: 5 },
  { title: 'Terremoto', description: 'Il terremoto danneggia gravemente una città e la comunità deve ricostruire.', effect_type: 'lose_city', effect_value: 1 },
  { title: 'Guerra interna', description: 'Le tensioni interne bloccano la crescita della popolazione per un turno.', effect_type: 'info', effect_value: 0 },
  { title: 'Zona ricca di crostacei', description: 'Le rive pullulano di crostacei e la tribù raccoglie una ricca provvista.', effect_type: 'gain_resources', effect_value: 10 },
  { title: 'Lago pescoso', description: 'Il lago offre pesce in abbondanza e aumenta le scorte.', effect_type: 'gain_resources', effect_value: 5 },
  { title: 'Caccia al bisonte andata male', description: 'La spedizione fallisce e la tribù perde risorse preziose.', effect_type: 'lose_resources', effect_value: 20 },
  { title: 'Scoperta di stagno', description: 'Un nuovo stagno offre acqua e opportunità di raccolta.', effect_type: 'gain_resources', effect_value: 10 },
  { title: 'Inondazione', description: 'Le acque sommergono campi e insediamenti, causando gravi perdite.', effect_type: 'lose_resources', effect_value: 20 },
  { title: 'Cacciatori di teste', description: 'Un gruppo di guerrieri conquista un villaggio e lascia il territorio più fragile.', effect_type: 'info', effect_value: 0 },
  { title: 'Assalto fortunato maggiore', description: 'L’assalto riesce a conquistare 3 ripari in un’unica stagione.', effect_type: 'gain_shelters', effect_value: 3 }
];

module.exports = {
  territories,
  players,
  resetPlayers,
  beliefCards,
  eventCards
};
