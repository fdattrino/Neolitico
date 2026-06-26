function BeliefCards({ beliefs, players, onBuy }) {
  return (
    <div>
      <h2>Carte Credenza</h2>
      <div className="card-list">
        {beliefs.map((belief) => (
          <div key={belief.id} className="card">
            <h3>{belief.name}</h3>
            <p>{belief.description}</p>
            <p><strong>Costo:</strong> {belief.cost} risorse</p>
            <div className="actions">
              {players.map((player) => (
                <button key={player.id} onClick={() => onBuy(player.id, belief.id)}>
                  Compra per {player.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BeliefCards;
