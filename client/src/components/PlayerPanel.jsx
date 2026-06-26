function PlayerPanel({ players, currentPlayerId, onGather }) {
  const activePlayerId = Number(currentPlayerId);

  return (
    <div>
      <h2>Giocatori</h2>
      <div className="card-list">
        {players.map((player) => (
          (() => {
            const isActivePlayer = Number(player.id) === activePlayerId;
            const hasGatheredThisTurn = Number(player.has_gathered_this_turn) === 1;
            const gatherDisabled = !isActivePlayer || hasGatheredThisTurn;

            return (
              <div key={player.id} className="card">
                <h3>{player.name}</h3>
                <p><strong>Tribù:</strong> {player.tribe}</p>
                <p><strong>Risorse:</strong> {player.resources}</p>
                <p><strong>Territorio:</strong> {player.current_territory_name || 'Nessuno'}</p>
                <div className="actions">
                  <button onClick={() => onGather(player.id)} disabled={gatherDisabled}>
                    {!isActivePlayer ? 'In attesa del turno' : hasGatheredThisTurn ? 'Risorse già raccolte' : 'Raccogli risorse'}
                  </button>
                </div>
              </div>
            );
          })()
        ))}
      </div>
    </div>
  );
}

export default PlayerPanel;
