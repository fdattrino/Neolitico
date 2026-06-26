function BeliefCards({ beliefs, players, onBuy }) {
  const isAlreadyOwned = (player, beliefId) => (player.owned_belief_ids || []).includes(beliefId);

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
                const disabled = alreadyOwned || insufficientResources;

                return (
                  <button
                    key={player.id}
                    onClick={() => onBuy(player.id, belief.id)}
                    disabled={disabled}
                  >
                    {alreadyOwned ? 'Già posseduta' : insufficientResources ? 'Risorse insufficienti' : `Compra per ${player.name}`}
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
