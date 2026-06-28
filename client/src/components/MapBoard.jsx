import { useEffect, useState } from 'react';

function MapBoard({ players, territories, developments, currentPlayerId, onMove, onBattle }) {
  const [error, setError] = useState('');
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState({});
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

  const playersByTerritory = territories.reduce((acc, territory) => {
    acc[territory.id] = [];
    return acc;
  }, {});

  players.forEach((player) => {
    if (player.current_territory_id) {
      const territoryId = normalizeId(player.current_territory_id);
      playersByTerritory[territoryId] = playersByTerritory[territoryId] || [];
      playersByTerritory[territoryId].push(player.name);
    }
  });

  const getReachableTerritories = (player) => {
    const currentTerritory = territories.find((territory) => normalizeId(territory.id) === normalizeId(player.current_territory_id));
    if (!currentTerritory) {
      return [];
    }

    return territories.filter((territory) => {
      const distance = Math.abs(territory.position_x - currentTerritory.position_x) + Math.abs(territory.position_y - currentTerritory.position_y);
      return distance === 1;
    });
  };

  const getCurrentDevelopment = (player) => (
    developments.find(
      (development) => normalizeId(development.player_id) === normalizeId(player.id)
        && normalizeId(development.territory_id) === normalizeId(player.current_territory_id)
    ) || null
  );

  useEffect(() => {
    if (territories.length === 0 || players.length === 0 || Number.isNaN(activePlayerId)) {
      return;
    }

    const activePlayer = players.find((player) => normalizeId(player.id) === activePlayerId);
    if (!activePlayer) {
      return;
    }

    const reachableTerritories = getReachableTerritories(activePlayer);

    setSelectedTerritoryIds((current) => {
      const currentSelection = current[activePlayer.id];
      const selectionStillValid = reachableTerritories.some((territory) => normalizeId(territory.id) === normalizeId(currentSelection));

      if (selectionStillValid) {
        return current;
      }

      if (reachableTerritories.length === 0) {
        return { ...current, [activePlayer.id]: '' };
      }

      return { ...current, [activePlayer.id]: String(reachableTerritories[0].id) };
    });

    setMoveSelections((current) => {
      const development = getCurrentDevelopment(activePlayer);
      const maxShelters = Number(development?.shelters ?? 0);
      const maxVillages = Number(development?.villages ?? 0);
      const currentSelection = current[activePlayer.id] || {};
      return {
        ...current,
        [activePlayer.id]: {
          sheltersToMove: Math.min(Number(currentSelection.sheltersToMove ?? 0), maxShelters),
          villagesToMove: Math.min(Number(currentSelection.villagesToMove ?? 0), maxVillages)
        }
      };
    });
  }, [territories, players, activePlayerId]);

  const handleMove = async (playerId) => {
    const selectedTerritoryId = selectedTerritoryIds[playerId];
    if (!selectedTerritoryId) {
      return;
    }

    const selection = moveSelections[playerId] || {};
    const sheltersToMove = Number(selection.sheltersToMove ?? 0);
    const villagesToMove = Number(selection.villagesToMove ?? 0);

    try {
      setError('');
      await onMove(playerId, Number(selectedTerritoryId), sheltersToMove, villagesToMove);
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

  const canBattleInTerritory = (territory) => {
    if (Number(territory.prey_remaining ?? 0) !== 0) {
      return false;
    }

    const territoryDevelopments = developmentsByTerritory[territory.id] || [];
    if (territoryDevelopments.length < 2) {
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

      <div className="map-grid">
        {territories.map((territory) => (
          <div key={territory.id} className="territory-cell">
            <div className="territory-head">
              <h3>{territory.name}</h3>
              <span className="territory-type">{territory.terrain_type}</span>
            </div>
            <p className="territory-description">{territory.description}</p>
            <p className="territory-prey">Prede: {territory.prey_remaining} / {territory.total_prey}</p>
            <div className="territory-players">
              {(playersByTerritory[territory.id] || []).length > 0 ? (
                playersByTerritory[territory.id].map((playerName) => (
                  <span key={`${territory.id}-${playerName}`} className="player-chip">{playerName}</span>
                ))
              ) : (
                <span className="hint">Nessun giocatore</span>
              )}
            </div>
            <div className="development-list">
              {(developmentsByTerritory[territory.id] || []).length > 0 ? (
                developmentsByTerritory[territory.id].map((development) => (
                  <div key={development.id} className="development-item">
                    <strong>{development.player_name}</strong>
                    <span>{development.shelters} ripari, {development.villages} villaggi, {development.cities} città</span>
                  </div>
                ))
              ) : (
                <span className="hint">Nessun insediamento</span>
              )}
            </div>
            {canBattleInTerritory(territory) && (
              <div className="territory-actions">
                <button onClick={() => handleBattle(territory.id)}>Battaglia</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="move-controls">
        {players.map((player) => {
          const reachableTerritories = getReachableTerritories(player);
          const currentDevelopment = getCurrentDevelopment(player);
          const maxShelters = Number(currentDevelopment?.shelters ?? 0);
          const maxVillages = Number(currentDevelopment?.villages ?? 0);
          const selection = moveSelections[player.id] || { sheltersToMove: 0, villagesToMove: 0 };
          const isActivePlayer = Number(player.id) === activePlayerId;
          const hasMovedThisTurn = Number(player.has_moved_this_turn) === 1;
          const moveDisabled = !isActivePlayer || hasMovedThisTurn || reachableTerritories.length === 0 || !selectedTerritoryIds[player.id];

          return (
            <div key={player.id} className="move-control">
              <strong>{player.name}</strong>
              <span>{player.current_territory_name || 'Sconosciuto'}</span>
              <select
                value={selectedTerritoryIds[player.id] || ''}
                onChange={(event) => setSelectedTerritoryIds((current) => ({ ...current, [player.id]: event.target.value }))}
                disabled={!isActivePlayer || hasMovedThisTurn || reachableTerritories.length === 0}
              >
                <option value="">{reachableTerritories.length > 0 ? 'Seleziona territorio' : 'Nessun territorio adiacente'}</option>
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
                  disabled={!isActivePlayer || hasMovedThisTurn || maxShelters === 0}
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
                  disabled={!isActivePlayer || hasMovedThisTurn || maxVillages === 0}
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
              {isActivePlayer && hasMovedThisTurn && <span className="turn-waiting">Spostamento già effettuato</span>}
              {isActivePlayer && reachableTerritories.length === 0 && <span className="turn-waiting">Nessun territorio adiacente disponibile</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MapBoard;
