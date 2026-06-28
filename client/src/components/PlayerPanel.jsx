const TERRITORY_RESOURCE_BONUSES = {
  Foresta: 8,
  Fiume: 7,
  Collina: 6,
  Pianura: 9,
  Lago: 7,
  Montagna: 6,
  Costa: 8,
  Grotta: 5,
  Valle: 8
};

const DEVELOPMENT_RESOURCE_BONUSES = {
  shelter: 2,
  village: 5,
  city: 10
};

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

    const territoryBonus = TERRITORY_RESOURCE_BONUSES[territory.name] || 0;
    const development = getDevelopment(player);
    const developmentBonus = development
      ? (Number(development.shelters) * DEVELOPMENT_RESOURCE_BONUSES.shelter)
        + (Number(development.villages) * DEVELOPMENT_RESOURCE_BONUSES.village)
        + (Number(development.cities) * DEVELOPMENT_RESOURCE_BONUSES.city)
      : 0;

    return {
      total: territoryBonus + developmentBonus,
      territoryBonus,
      developmentBonus,
      preyRemaining: Number(territory.prey_remaining ?? 0)
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
          const gatherDisabled = !isActivePlayer || hasGatheredThisTurn || Number(gatherData?.preyRemaining ?? 0) <= 0;
          const canBuildShelter = isActivePlayer && Number(player.resources) >= 5;
          const canUpgradeVillage = isActivePlayer && shelters >= 3;
          const canUpgradeCity = isActivePlayer && villages >= 3 && Number(player.resources) >= 40;

          const gatherLabel = !isActivePlayer
            ? 'In attesa del turno'
            : hasGatheredThisTurn
              ? 'Risorse già raccolte'
              : Number(gatherData?.preyRemaining ?? 0) <= 0
                ? 'Prede esaurite'
                : gatherData
                  ? `Raccogli risorse (+${gatherData.total})`
                  : 'Raccogli risorse';

          return (
            <div key={player.id} className="card player-card">
              <h3>{player.name}</h3>
              <p><strong>Tribù:</strong> {player.tribe}</p>
              <p><strong>Risorse:</strong> {player.resources}</p>
              <p><strong>Territorio:</strong> {player.current_territory_name || 'Nessuno'}</p>
              <p><strong>Sviluppo locale:</strong> {shelters} ripari, {villages} villaggi, {cities} città</p>
              <div className="actions player-actions">
                <button onClick={() => onGather(player.id)} disabled={gatherDisabled}>
                  {gatherLabel}
                </button>
                <button onClick={() => onBuildShelter(player.id)} disabled={!canBuildShelter}>
                  {!isActivePlayer ? 'In attesa del turno' : Number(player.resources) < 5 ? 'Servono 5 risorse' : 'Costruisci riparo'}
                </button>
                <button onClick={() => onUpgradeVillage(player.id)} disabled={!canUpgradeVillage}>
                  {!isActivePlayer ? 'In attesa del turno' : shelters < 3 ? 'Servono 3 ripari' : 'Forma villaggio'}
                </button>
                <button onClick={() => onUpgradeCity(player.id)} disabled={!canUpgradeCity}>
                  {!isActivePlayer ? 'In attesa del turno' : villages < 3 ? 'Servono 3 villaggi' : Number(player.resources) < 40 ? 'Servono 40 risorse' : 'Fonda città'}
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
