function BeliefCards({ beliefs, players, currentPlayerId, currentPhase, onBuy }) {
  const isAlreadyOwned = (player, beliefId) => (player.owned_belief_ids || []).includes(beliefId);
  const activePlayerId = Number(currentPlayerId);
  const beliefById = beliefs.reduce((acc, belief) => {
    acc[belief.id] = belief;
    return acc;
  }, {});

  const getSameTypeCount = (player, typeCode) => (
    (player.owned_belief_ids || []).reduce((count, beliefId) => {
      const ownedBelief = beliefById[beliefId];
      return ownedBelief?.type_code === typeCode ? count + 1 : count;
    }, 0)
  );

  return (
    <div>
      <h2>Carte Credenza</h2>
      <div className="beliefs-grid">
        {beliefs.map((belief) => (
          <div key={belief.id} className="card belief-card">
            <h3>{belief.name}</h3>
            <p className="belief-meta"><strong>Tipo:</strong> {belief.type_code}</p>
            <p className="belief-meta"><strong>Costo:</strong> {belief.cost}</p>
            <p className="belief-meta"><strong>Guadagno:</strong> +{belief.resource_gain}</p>
            <p className="belief-description">{belief.description}</p>
            <div className="actions">
              {players.map((player) => {
                const alreadyOwned = isAlreadyOwned(player, belief.id);
                const insufficientResources = player.resources < belief.cost;
                const isActivePlayer = Number(player.id) === activePlayerId;
                const disabled = currentPhase !== 'beliefs' || alreadyOwned || insufficientResources || !isActivePlayer;
                const sameTypeBefore = getSameTypeCount(player, belief.type_code);
                const multiplier = sameTypeBefore + 1;
                const totalGain = Number(belief.resource_gain || 0) * multiplier;
                const buyLabel = multiplier > 1
                  ? `Compra per ${player.name} (+${totalGain}, x${multiplier})`
                  : `Compra per ${player.name} (+${totalGain})`;

                return (
                  <button
                    key={player.id}
                    onClick={() => onBuy(player.id, belief.id)}
                    disabled={disabled}
                  >
                    {currentPhase !== 'beliefs' ? 'Disponibile in Credenze' : alreadyOwned ? 'Gia posseduta' : insufficientResources ? 'Risorse insufficienti' : !isActivePlayer ? `In attesa del turno: ${player.name}` : buyLabel}
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
