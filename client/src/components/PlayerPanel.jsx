function PlayerPanel({
  players,
  territories,
  developments,
  currentPlayerId,
  currentPhase,
  onBuildShelter
}) {
  const activePlayerId = Number(currentPlayerId);
  const getPlayerDevelopments = (player) => (
    developments.filter((item) => Number(item.player_id) === Number(player.id))
  );

  const getSettlementSummary = (player) => {
    const playerDevelopments = getPlayerDevelopments(player);

    return playerDevelopments.reduce((summary, development) => {
      const shelters = Number(development.shelters ?? 0);
      const villages = Number(development.villages ?? 0);
      const cities = Number(development.cities ?? 0);

      if (shelters <= 0 && villages <= 0 && cities <= 0) {
        return summary;
      }

      summary.totalShelters += shelters;
      summary.totalVillages += villages;
      summary.totalCities += cities;
      summary.territories.push({
        territoryId: Number(development.territory_id),
        territoryName: development.territory_name || territories.find((item) => Number(item.id) === Number(development.territory_id))?.name || 'Territorio sconosciuto',
        shelters,
        villages,
        cities
      });
      return summary;
    }, {
      totalShelters: 0,
      totalVillages: 0,
      totalCities: 0,
      territories: []
    });
  };

  return (
    <div>
      <h2>Giocatori</h2>
      <div className="players-grid">
        {players.map((player) => {
          const isActivePlayer = Number(player.id) === activePlayerId;
          const settlementSummary = getSettlementSummary(player);
          const sheltersToPlace = Number(player.shelters_to_place ?? 0);
          const isPlacementPhase = sheltersToPlace > 0;
          const canBuildShelter = currentPhase === 'transformation' && isActivePlayer && !isPlacementPhase && Number(player.resources) >= 5;

          return (
            <div key={player.id} className="card player-card">
              <h3>{player.name}</h3>
              <p><strong>Tribù:</strong> {player.tribe}</p>
              <p><strong>Risorse:</strong> {player.resources}</p>
              <p><strong>Ripari da collocare:</strong> {sheltersToPlace}</p>
              <p>
                <strong>Insediamenti totali:</strong> {settlementSummary.totalShelters} ripari, {settlementSummary.totalVillages} villaggi, {settlementSummary.totalCities} città
              </p>
              <div className="player-settlements">
                <strong>Insediamenti:</strong>
                {settlementSummary.territories.length > 0 ? (
                  <ul className="player-settlement-list">
                    {settlementSummary.territories.map((territoryDevelopment) => (
                      <li key={`${player.id}-${territoryDevelopment.territoryId}`}>
                        {territoryDevelopment.territoryName}: {territoryDevelopment.shelters} ripari, {territoryDevelopment.villages} villaggi, {territoryDevelopment.cities} città
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">Nessun insediamento</p>
                )}
              </div>
              <div className="actions player-actions">
                <button onClick={() => onBuildShelter(player.id)} disabled={!canBuildShelter}>
                  {currentPhase !== 'transformation' ? 'Disponibile in Trasformazione' : !isActivePlayer ? 'In attesa del turno' : isPlacementPhase ? 'Disponibile dopo la collocazione iniziale' : Number(player.resources) < 5 ? 'Servono 5 risorse' : 'Costruisci riparo'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayerPanel;
