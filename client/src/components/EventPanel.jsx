function describeEffect(event) {
  const n = Number(event.effect_value);
  switch (event.effect_type) {
    case 'gain_resources':
      return `Guadagni ${n} risorse`;
    case 'lose_resources':
      return `Perdi ${n} risorse (al massimo quelle che possiedi)`;
    case 'lose_shelters':
      return `Perdi ${n} ${n === 1 ? 'riparo' : 'ripari'} (se non ne hai, perdi 1 villaggio)`;
    case 'lose_villages':
      return `Perdi ${n} ${n === 1 ? 'villaggio' : 'villaggi'}`;
    case 'lose_city':
      return 'Perdi 1 città';
    case 'gain_shelters':
      return `Ottieni ${n} ${n === 1 ? 'riparo' : 'ripari'}`;
    case 'gain_village':
      return `Ottieni ${n} ${n === 1 ? 'villaggio' : 'villaggi'} (solo se ne possiedi già uno)`;
    case 'block_population':
      return 'La tua prossima crescita della popolazione è bloccata';
    default:
      return 'Nessun effetto sulle risorse';
  }
}

function EventPanel({ players, currentPlayerId, currentPhase, onDraw, events = [], lastEvent = null }) {
  const activePlayerId = Number(currentPlayerId);

  return (
    <div>
      <h2>Pesca Evento</h2>
      <div className="actions">
        {players.map((player) => (
          <button key={player.id} onClick={() => onDraw(player.id)} disabled={currentPhase !== 'event' || Number(player.id) !== activePlayerId}>
            {currentPhase !== 'event' ? 'Disponibile in Imprevisto' : Number(player.id) === activePlayerId ? `Pesca per ${player.name}` : `In attesa del turno: ${player.name}`}
          </button>
        ))}
      </div>
      {lastEvent && (
        <div className="last-event">
          <strong>{lastEvent.playerName} ha pescato: {lastEvent.title}</strong>
          <p>{lastEvent.description}</p>
          <p><em>{describeEffect(lastEvent)}</em></p>
        </div>
      )}
      <p className="hint">Ogni evento può aumentare o diminuire le risorse o gli insediamenti del giocatore. Eventi disponibili: {events.length}.</p>
    </div>
  );
}

export default EventPanel;
