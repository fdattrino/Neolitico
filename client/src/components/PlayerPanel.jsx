function PlayerPanel({ players }) {
  return (
    <div>
      <h2>Giocatori</h2>
      <div className="card-list">
        {players.map((player) => (
          <div key={player.id} className="card">
            <h3>{player.name}</h3>
            <p><strong>Tribù:</strong> {player.tribe}</p>
            <p><strong>Risorse:</strong> {player.resources}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlayerPanel;
