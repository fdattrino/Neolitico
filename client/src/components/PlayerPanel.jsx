function PlayerPanel({
  players,
  territories,
  developments,
  currentPlayerId,
  currentPhase,
  onGather,
  onBuildShelter
}) {
  const activePlayerId = Number(currentPlayerId);
  const getPlayerDevelopments = (player) => (
    developments.filter((item) => Number(item.player_id) === Number(player.id))
  );

  const getExpectedGatherBonus = (player) => {
    const playerDevelopments = getPlayerDevelopments(player);
    if (playerDevelopments.length === 0) {
      return { total: 0, preyRemaining: 0, shelterProduction: 0, villageProduction: 0, cityProduction: 0 };
    }

    return playerDevelopments.reduce((summary, development) => {
      const territory = territories.find((item) => Number(item.id) === Number(development.territory_id));
      if (!territory) {
        return summary;
      }

      const shelters = Number(development.shelters ?? 0);
      const villages = Number(development.villages ?? 0);
      const cities = Number(development.cities ?? 0);
      const preyRemaining = Number(territory.prey_remaining ?? 0);
      const activeShelters = Math.min(shelters, preyRemaining);
      const shelterProduction = activeShelters * Number(territory.shelter_yield ?? 0);
      const villageProduction = villages * Number(territory.village_yield ?? 0);
      const cityProduction = cities * Number(territory.city_yield ?? 0);

      return {
        total: summary.total + shelterProduction + villageProduction + cityProduction,
        preyRemaining: summary.preyRemaining + preyRemaining,
        shelterProduction: summary.shelterProduction + shelterProduction,
        villageProduction: summary.villageProduction + villageProduction,
        cityProduction: summary.cityProduction + cityProduction
      };
    }, {
      total: 0,
      preyRemaining: 0,
      shelterProduction: 0,
      villageProduction: 0,
      cityProduction: 0
    });
  };

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
          const hasGatheredThisTurn = Number(player.has_gathered_this_turn) === 1;
          const gatherData = getExpectedGatherBonus(player);
          const settlementSummary = getSettlementSummary(player);
          const sheltersToPlace = Number(player.shelters_to_place ?? 0);
          const isPlacementPhase = sheltersToPlace > 0;
          const gatherDisabled = currentPhase !== 'production' || !isActivePlayer || isPlacementPhase || hasGatheredThisTurn || Number(gatherData?.total ?? 0) <= 0;
          const canBuildShelter = currentPhase === 'transformation' && isActivePlayer && !isPlacementPhase && Number(player.resources) >= 5;

          const gatherLabel = currentPhase !== 'production'
            ? 'Disponibile in Produzione'
            : !isActivePlayer
              ? 'In attesa del turno'
            : isPlacementPhase
              ? 'Colloca prima i ripari iniziali'
            : hasGatheredThisTurn
              ? 'Risorse già raccolte'
              : Number(gatherData?.total ?? 0) <= 0
                ? 'Nessuna produzione disponibile'
                : gatherData
                  ? `Raccogli risorse (+${gatherData.total})`
                  : 'Raccogli risorse';

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
                <button onClick={() => onGather(player.id)} disabled={gatherDisabled}>
                  {gatherLabel}
                </button>
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
