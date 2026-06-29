function EventPanel({ players, currentPlayerId, currentPhase, onDraw, events = [] }) {
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
      <p className="hint">Ogni evento può aumentare o diminuire le risorse del giocatore. Eventi disponibili: {events.length}.</p>
    </div>
  );
}

export default EventPanel;
