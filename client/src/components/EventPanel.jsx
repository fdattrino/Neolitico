function EventPanel({ players, currentPlayerId, onDraw }) {
  return (
    <div>
      <h2>Pesca Evento</h2>
      <div className="actions">
        {players.map((player) => (
          <button key={player.id} onClick={() => onDraw(player.id)} disabled={player.id !== currentPlayerId}>
            {player.id === currentPlayerId ? `Pesca per ${player.name}` : `In attesa del turno: ${player.name}`}
          </button>
        ))}
      </div>
      <p className="hint">Ogni evento può aumentare o diminuire le risorse del giocatore.</p>
    </div>
  );
}

export default EventPanel;
