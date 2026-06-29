import { useEffect, useState } from 'react';

function MapBoard({
  players,
  territories,
  developments,
  currentPlayerId,
  currentPhase,
  onMove,
  onBattle,
  onPlaceShelter,
  onUpgradeVillage,
  onUpgradeCity
}) {
  const [error, setError] = useState('');
  const [moveSelections, setMoveSelections] = useState({});
  const activePlayerId = Number(currentPlayerId);
  const normalizeId = (value) => Number(value);

  const developmentsByTerritory = developments.reduce((acc, development) => {
    const territoryId = normalizeId(development.territory_id);
    if (!acc[territoryId]) {
      acc[territoryId] = [];
    }
    acc[territoryId].push(development);
    return acc;
  }, {});

  const getDevelopmentForPlayerInTerritory = (playerId, territoryId) => (
    developments.find(
      (development) => normalizeId(development.player_id) === normalizeId(playerId)
        && normalizeId(development.territory_id) === normalizeId(territoryId)
    ) || null
  );

  const getPlayerSourceTerritories = (player) => (
    developments
      .filter(
        (development) => normalizeId(development.player_id) === normalizeId(player.id)
          && (Number(development.shelters ?? 0) > 0 || Number(development.villages ?? 0) > 0)
      )
      .map((development) => {
        const territory = territories.find((item) => normalizeId(item.id) === normalizeId(development.territory_id));
        return territory
          ? {
            ...territory,
            shelters: Number(development.shelters ?? 0),
            villages: Number(development.villages ?? 0)
          }
          : null;
      })
      .filter(Boolean)
  );

  const getReachableTerritoriesFromSource = (sourceTerritoryId) => {
    const sourceTerritory = territories.find((territory) => normalizeId(territory.id) === normalizeId(sourceTerritoryId));
    if (!sourceTerritory) {
      return [];
    }

    return territories.filter((territory) => {
      const distance = Math.abs(territory.position_x - sourceTerritory.position_x) + Math.abs(territory.position_y - sourceTerritory.position_y);
      return distance === 1;
    });
  };

  useEffect(() => {
    if (territories.length === 0 || players.length === 0 || Number.isNaN(activePlayerId)) {
      return;
    }

    const activePlayer = players.find((player) => normalizeId(player.id) === activePlayerId);
    if (!activePlayer) {
      return;
    }

    const sourceTerritories = getPlayerSourceTerritories(activePlayer);

    setMoveSelections((current) => {
      const currentSelection = current[activePlayer.id] || {};
      const currentSourceTerritoryId = currentSelection.sourceTerritoryId;
      const validSourceTerritory = sourceTerritories.find((territory) => normalizeId(territory.id) === normalizeId(currentSourceTerritoryId));
      const selectedSourceTerritory = validSourceTerritory || sourceTerritories[0] || null;
      const reachableTerritories = selectedSourceTerritory ? getReachableTerritoriesFromSource(selectedSourceTerritory.id) : [];
      const currentDestinationTerritoryId = currentSelection.destinationTerritoryId;
      const validDestinationTerritory = reachableTerritories.find((territory) => normalizeId(territory.id) === normalizeId(currentDestinationTerritoryId));
      const selectedDestinationTerritoryId = validDestinationTerritory
        ? String(validDestinationTerritory.id)
        : reachableTerritories[0]
          ? String(reachableTerritories[0].id)
          : '';
      const maxShelters = Number(selectedSourceTerritory?.shelters ?? 0);
      const maxVillages = Number(selectedSourceTerritory?.villages ?? 0);

      return {
        ...current,
        [activePlayer.id]: {
          sourceTerritoryId: selectedSourceTerritory ? String(selectedSourceTerritory.id) : '',
          destinationTerritoryId: selectedDestinationTerritoryId,
          sheltersToMove: Math.min(Number(currentSelection.sheltersToMove ?? 0), maxShelters),
          villagesToMove: Math.min(Number(currentSelection.villagesToMove ?? 0), maxVillages)
        }
      };
    });
  }, [territories, players, activePlayerId]);

  const handleMove = async (playerId) => {
    const selection = moveSelections[playerId] || {};
    const sourceTerritoryId = selection.sourceTerritoryId;
    const destinationTerritoryId = selection.destinationTerritoryId;
    if (!sourceTerritoryId || !destinationTerritoryId) {
      return;
    }

    const sheltersToMove = Number(selection.sheltersToMove ?? 0);
    const villagesToMove = Number(selection.villagesToMove ?? 0);

    try {
      setError('');
      await onMove(playerId, Number(sourceTerritoryId), Number(destinationTerritoryId), sheltersToMove, villagesToMove);
    } catch (err) {
      setError(err.message || 'Spostamento non riuscito');
    }
  };

  const handleBattle = async (territoryId) => {
    try {
      setError('');
      await onBattle(territoryId);
    } catch (err) {
      setError(err.message || 'Battaglia non riuscita');
    }
  };

  const handlePlaceShelter = async (playerId, territoryId) => {
    try {
      setError('');
      await onPlaceShelter(playerId, territoryId);
    } catch (err) {
      setError(err.message || 'Collocazione riparo non riuscita');
    }
  };

  const handleUpgradeVillage = async (playerId, territoryId) => {
    try {
      setError('');
      await onUpgradeVillage(playerId, territoryId);
    } catch (err) {
      setError(err.message || 'Formazione villaggio non riuscita');
    }
  };

  const handleUpgradeCity = async (playerId, territoryId) => {
    try {
      setError('');
      await onUpgradeCity(playerId, territoryId);
    } catch (err) {
      setError(err.message || 'Fondazione città non riuscita');
    }
  };

  const activePlayer = players.find((player) => Number(player.id) === activePlayerId) || null;
  const activePlayerInPlacementPhase = Number(activePlayer?.shelters_to_place ?? 0) > 0;
  const activePlayerResources = Number(activePlayer?.resources ?? 0);

  const canBattleInTerritory = (territory) => {
    if (currentPhase !== 'post_movement_check') {
      return false;
    }

    const territoryDevelopments = developmentsByTerritory[territory.id] || [];
    if (territoryDevelopments.length < 2) {
      return false;
    }

    const totalShelters = territoryDevelopments.reduce((sum, development) => sum + Number(development.shelters ?? 0), 0);
    const insufficientPrey = Number(territory.prey_remaining ?? 0) <= 0 || Number(territory.prey_remaining ?? 0) < totalShelters;
    if (!insufficientPrey) {
      return false;
    }

    const [firstDevelopment, secondDevelopment] = territoryDevelopments;
    const bothHaveShelters = Number(firstDevelopment.shelters) > 0 && Number(secondDevelopment.shelters) > 0;
    const bothHaveVillages = Number(firstDevelopment.villages) > 0 && Number(secondDevelopment.villages) > 0;

    return bothHaveShelters || bothHaveVillages;
  };

  return (
    <div className="map-board">
      <h2>Mappa dei territori</h2>
      {error && <p className="alert">{error}</p>}

      <div className="map-wrapper">
        <div className="map-grid">
          {territories.map((territory) => {
            const activePlayerDevelopment = activePlayer
              ? getDevelopmentForPlayerInTerritory(activePlayer.id, territory.id)
              : null;
            const activePlayerShelters = Number(activePlayerDevelopment?.shelters ?? 0);
            const activePlayerVillages = Number(activePlayerDevelopment?.villages ?? 0);
            const canUpgradeVillageInTerritory = currentPhase === 'transformation'
              && Boolean(activePlayer)
              && !activePlayerInPlacementPhase
              && activePlayerShelters >= 3
              && activePlayerResources >= 8;
            const canUpgradeCityInTerritory = currentPhase === 'transformation'
              && Boolean(activePlayer)
              && !activePlayerInPlacementPhase
              && activePlayerVillages >= 3
              && activePlayerResources >= 40;

            return (
            <div key={territory.id} className="territory-cell territory-card">
              <div className="territory-head">
                <h3>{territory.name}</h3>
                <span className="territory-type">{territory.terrain_type}</span>
              </div>
              <p className="territory-description">{territory.description}</p>
              <p className="territory-prey">Prede: {territory.prey_remaining} / {territory.prey_capacity}</p>
              <div className="territory-yields">
                <span>Riparo: +{territory.shelter_yield}</span>
                <span>Villaggio: +{territory.village_yield}</span>
                <span>Città: +{territory.city_yield}</span>
              </div>
              
              <div className="development-list">
                {(developmentsByTerritory[territory.id] || []).length > 0 ? (
                  developmentsByTerritory[territory.id].map((development) => (
                    <div key={development.id} className="development-item">
                      <span>
                        {development.player_name}: {development.shelters} ripari, {development.villages} villaggi, {development.cities} città
                      </span>
                    </div>
                  ))
                ) : (
                  <p>Nessun insediamento</p>
                )}
              </div>
              {canBattleInTerritory(territory) && (
                <div className="territory-actions">
                  <button onClick={() => handleBattle(territory.id)}>Battaglia</button>
                </div>
              )}
              {currentPhase === 'setup_placement' && activePlayerInPlacementPhase && (
                <div className="territory-actions">
                  <button onClick={() => handlePlaceShelter(activePlayer.id, territory.id)}>Colloca riparo</button>
                </div>
              )}
              {(canUpgradeVillageInTerritory || canUpgradeCityInTerritory) && (
                <div className="territory-actions">
                  {canUpgradeVillageInTerritory && (
                    <button onClick={() => handleUpgradeVillage(activePlayer.id, territory.id)}>Forma villaggio</button>
                  )}
                  {canUpgradeCityInTerritory && (
                    <button onClick={() => handleUpgradeCity(activePlayer.id, territory.id)}>Fonda città</button>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      <div className="move-controls">
        {players.map((player) => {
          const sourceTerritories = getPlayerSourceTerritories(player);
          const selection = moveSelections[player.id] || {
            sourceTerritoryId: '',
            destinationTerritoryId: '',
            sheltersToMove: 0,
            villagesToMove: 0
          };
          const selectedSourceTerritory = sourceTerritories.find((territory) => normalizeId(territory.id) === normalizeId(selection.sourceTerritoryId)) || null;
          const reachableTerritories = selectedSourceTerritory ? getReachableTerritoriesFromSource(selectedSourceTerritory.id) : [];
          const maxShelters = Number(selectedSourceTerritory?.shelters ?? 0);
          const maxVillages = Number(selectedSourceTerritory?.villages ?? 0);
          const isActivePlayer = Number(player.id) === activePlayerId;
          const hasMovedThisTurn = Number(player.has_moved_this_turn) === 1;
          const isPlacementPhase = Number(player.shelters_to_place ?? 0) > 0;
          const moveDisabled = currentPhase !== 'movement'
            || !isActivePlayer
            || isPlacementPhase
            || hasMovedThisTurn
            || sourceTerritories.length === 0
            || reachableTerritories.length === 0
            || !selection.sourceTerritoryId
            || !selection.destinationTerritoryId;

          return (
            <div key={player.id} className="move-control">
              <strong>{player.name}</strong>
              <select
                value={selection.sourceTerritoryId || ''}
                onChange={(event) => setMoveSelections((current) => {
                  const sourceTerritoryId = event.target.value;
                  const nextReachableTerritories = getReachableTerritoriesFromSource(sourceTerritoryId);
                  return {
                    ...current,
                    [player.id]: {
                      sourceTerritoryId,
                      destinationTerritoryId: nextReachableTerritories[0] ? String(nextReachableTerritories[0].id) : '',
                      sheltersToMove: 0,
                      villagesToMove: 0
                    }
                  };
                })}
                disabled={currentPhase !== 'movement' || !isActivePlayer || isPlacementPhase || hasMovedThisTurn || sourceTerritories.length === 0}
              >
                <option value="">{sourceTerritories.length > 0 ? 'Territorio di partenza' : 'Nessun territorio con insediamenti'}</option>
                {sourceTerritories.map((territory) => (
                  <option key={`source-${player.id}-${territory.id}`} value={territory.id}>
                    {territory.name} ({territory.shelters} ripari, {territory.villages} villaggi)
                  </option>
                ))}
              </select>
              <select
                value={selection.destinationTerritoryId || ''}
                onChange={(event) => setMoveSelections((current) => ({
                  ...current,
                  [player.id]: {
                    ...current[player.id],
                    destinationTerritoryId: event.target.value
                  }
                }))}
                disabled={currentPhase !== 'movement' || !isActivePlayer || isPlacementPhase || hasMovedThisTurn || !selection.sourceTerritoryId || reachableTerritories.length === 0}
              >
                <option value="">{reachableTerritories.length > 0 ? 'Territorio di destinazione' : 'Nessun territorio adiacente'}</option>
                {reachableTerritories.map((territory) => (
                  <option key={territory.id} value={territory.id}>
                    {territory.name}
                  </option>
                ))}
              </select>
              <label className="move-transfer">
                <span>Ripari da portare</span>
                <select
                  value={selection.sheltersToMove}
                  onChange={(event) => setMoveSelections((current) => ({
                    ...current,
                    [player.id]: {
                      sheltersToMove: Number(event.target.value),
                      villagesToMove: Number(current[player.id]?.villagesToMove ?? selection.villagesToMove ?? 0)
                    }
                  }))}
                  disabled={currentPhase !== 'movement' || !isActivePlayer || isPlacementPhase || hasMovedThisTurn || maxShelters === 0}
                >
                  {Array.from({ length: maxShelters + 1 }, (_, index) => (
                    <option key={`shelters-${player.id}-${index}`} value={index}>
                      {index}
                    </option>
                  ))}
                </select>
              </label>
              <label className="move-transfer">
                <span>Villaggi da portare</span>
                <select
                  value={selection.villagesToMove}
                  onChange={(event) => setMoveSelections((current) => ({
                    ...current,
                    [player.id]: {
                      sheltersToMove: Number(current[player.id]?.sheltersToMove ?? selection.sheltersToMove ?? 0),
                      villagesToMove: Number(event.target.value)
                    }
                  }))}
                  disabled={currentPhase !== 'movement' || !isActivePlayer || isPlacementPhase || hasMovedThisTurn || maxVillages === 0}
                >
                  {Array.from({ length: maxVillages + 1 }, (_, index) => (
                    <option key={`villages-${player.id}-${index}`} value={index}>
                      {index}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={() => handleMove(player.id)} disabled={moveDisabled}>Sposta</button>
              {!isActivePlayer && <span className="turn-waiting">In attesa del turno</span>}
              {isActivePlayer && currentPhase !== 'movement' && <span className="turn-waiting">Disponibile in Movimento</span>}
              {isActivePlayer && isPlacementPhase && <span className="turn-waiting">Colloca prima i ripari iniziali</span>}
              {isActivePlayer && hasMovedThisTurn && <span className="turn-waiting">Spostamento già effettuato</span>}
              {isActivePlayer && sourceTerritories.length === 0 && <span className="turn-waiting">Nessun territorio con ripari o villaggi da spostare</span>}
              {isActivePlayer && sourceTerritories.length > 0 && selection.sourceTerritoryId && reachableTerritories.length === 0 && <span className="turn-waiting">Nessun territorio adiacente disponibile</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MapBoard;
