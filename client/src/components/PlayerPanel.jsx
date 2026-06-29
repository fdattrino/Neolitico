function PlayerPanel({
  players,
  territories,
  developments,
  currentPlayerId,
  onGather,
  onBuildShelter,
  onUpgradeVillage,
  onUpgradeCity
}) {
  const activePlayerId = Number(currentPlayerId);

  const getDevelopment = (player) => (
    developments.find(
      (item) => Number(item.player_id) === Number(player.id) && Number(item.territory_id) === Number(player.current_territory_id)
    ) || null
  );

  const getExpectedGatherBonus = (player) => {
    const territory = territories.find((item) => Number(item.id) === Number(player.current_territory_id));
    if (!territory) {
      return null;
    }

    const development = getDevelopment(player);
    const shelters = Number(development?.shelters ?? 0);
    const villages = Number(development?.villages ?? 0);
    const cities = Number(development?.cities ?? 0);
    const preyRemaining = Number(territory.prey_remaining ?? 0);
    const activeShelters = Math.min(shelters, preyRemaining);
    const shelterProduction = activeShelters * Number(territory.shelter_yield ?? 0);
    const villageProduction = villages * Number(territory.village_yield ?? 0);
    const cityProduction = cities * Number(territory.city_yield ?? 0);

    return {
      total: shelterProduction + villageProduction + cityProduction,
      preyRemaining,
      shelterProduction,
      villageProduction,
      cityProduction
    };
  };

  return (
    <div>
      <h2>Giocatori</h2>
      <div className="players-grid">
        {players.map((player) => {
          const isActivePlayer = Number(player.id) === activePlayerId;
          const hasGatheredThisTurn = Number(player.has_gathered_this_turn) === 1;
          const gatherData = getExpectedGatherBonus(player);
          const development = getDevelopment(player);
          const shelters = Number(development?.shelters ?? 0);
          const villages = Number(development?.villages ?? 0);
          const cities = Number(development?.cities ?? 0);
          const sheltersToPlace = Number(player.shelters_to_place ?? 0);
          const isPlacementPhase = sheltersToPlace > 0;
          const gatherDisabled = !isActivePlayer || isPlacementPhase || hasGatheredThisTurn || Number(gatherData?.total ?? 0) <= 0;
          const canBuildShelter = isActivePlayer && !isPlacementPhase && Number(player.resources) >= 5;
          const canUpgradeVillage = isActivePlayer && !isPlacementPhase && shelters >= 3;
          const canUpgradeCity = isActivePlayer && !isPlacementPhase && villages >= 3 && Number(player.resources) >= 40;

          const gatherLabel = !isActivePlayer
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
              <p><strong>Territorio:</strong> {player.current_territory_name || 'Nessuno'}</p>
              <p><strong>Ripari da collocare:</strong> {sheltersToPlace}</p>
              <p><strong>Sviluppo locale:</strong> {shelters} ripari, {villages} villaggi, {cities} città</p>
              <div className="actions player-actions">
                <button onClick={() => onGather(player.id)} disabled={gatherDisabled}>
                  {gatherLabel}
                </button>
                <button onClick={() => onBuildShelter(player.id)} disabled={!canBuildShelter}>
                  {!isActivePlayer ? 'In attesa del turno' : isPlacementPhase ? 'Disponibile dopo la collocazione iniziale' : Number(player.resources) < 5 ? 'Servono 5 risorse' : 'Costruisci riparo'}
                </button>
                <button onClick={() => onUpgradeVillage(player.id)} disabled={!canUpgradeVillage}>
                  {!isActivePlayer ? 'In attesa del turno' : isPlacementPhase ? 'Disponibile dopo la collocazione iniziale' : shelters < 3 ? 'Servono 3 ripari' : 'Forma villaggio'}
                </button>
                <button onClick={() => onUpgradeCity(player.id)} disabled={!canUpgradeCity}>
                  {!isActivePlayer ? 'In attesa del turno' : isPlacementPhase ? 'Disponibile dopo la collocazione iniziale' : villages < 3 ? 'Servono 3 villaggi' : Number(player.resources) < 40 ? 'Servono 40 risorse' : 'Fonda città'}
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
