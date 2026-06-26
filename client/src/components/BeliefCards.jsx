function BeliefCards({ beliefs, players, currentPlayerId, onBuy }) {
  const isAlreadyOwned = (player, beliefId) => (player.owned_belief_ids || []).includes(beliefId);
  const activePlayerId = Number(currentPlayerId);

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
              {players.map((player) => {
                const alreadyOwned = isAlreadyOwned(player, belief.id);
                const insufficientResources = player.resources < belief.cost;
                const isActivePlayer = Number(player.id) === activePlayerId;
                const disabled = alreadyOwned || insufficientResources || !isActivePlayer;

                return (
                  <button
                    key={player.id}
                    onClick={() => onBuy(player.id, belief.id)}
                    disabled={disabled}
                  >
                    {alreadyOwned ? 'Gia posseduta' : insufficientResources ? 'Risorse insufficienti' : !isActivePlayer ? `In attesa del turno: ${player.name}` : `Compra per ${player.name}`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BeliefCards;
