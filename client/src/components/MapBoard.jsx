import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000/api';

function MapBoard({ players, currentPlayerId, onMove, onBuild, onUpgrade, refreshTrigger }) {
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState({});
  const activePlayerId = Number(currentPlayerId);
  const normalizeId = (value) => Number(value);

  useEffect(() => {
    const loadMapData = async () => {
      try {
        setLoading(true);
        const [territoriesResponse, settlementsResponse] = await Promise.all([fetch(`${API_BASE}/territories`), fetch(`${API_BASE}/settlements`)]);
        const territoriesResult = await territoriesResponse.json();
        const settlementsResult = await settlementsResponse.json();

        if (!territoriesResponse.ok || !settlementsResponse.ok) {
          throw new Error('Impossibile caricare la mappa');
        }

        const territoriesWithSettlements = (territoriesResult.data || []).map((territory) => ({
          ...territory,
          settlements: territory.settlements || []
        }));

        const settlementsById = new Map((settlementsResult.data || []).map((settlement) => [settlement.id, settlement]));
        setTerritories(
          territoriesWithSettlements.map((territory) => ({
            ...territory,
            settlements: territory.settlements.map((settlement) => settlementsById.get(settlement.id) || settlement)
          }))
        );
        setError('');
      } catch (err) {
        setError(err.message || 'Impossibile caricare la mappa');
      } finally {
        setLoading(false);
      }
    };

    loadMapData();
  }, [refreshTrigger]);

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

  const currentSettlementByPlayer = players.reduce((acc, player) => {
    const territory = territories.find((item) => normalizeId(item.id) === normalizeId(player.current_territory_id));
    const currentSettlement = territory?.settlements?.find((settlement) => normalizeId(settlement.player_id) === normalizeId(player.id)) || null;
    acc[player.id] = currentSettlement;
    return acc;
  }, {});

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
  }, [territories, players, activePlayerId]);

  const handleMove = async (playerId) => {
    const selectedTerritoryId = selectedTerritoryIds[playerId];
    if (!selectedTerritoryId) {
      return;
    }
    await onMove(playerId, Number(selectedTerritoryId));
  };

  const handleBuild = async (playerId) => {
    try {
      setError('');
      await onBuild(playerId);
    } catch (err) {
      setError(err.message || 'Costruzione non riuscita');
    }
  };

  const handleUpgrade = async (settlementId) => {
    try {
      setError('');
      await onUpgrade(settlementId);
    } catch (err) {
      setError(err.message || 'Miglioramento non riuscito');
    }
  };

  const getSettlementAction = (player) => {
    const currentSettlement = currentSettlementByPlayer[player.id];
    const isActivePlayer = Number(player.id) === activePlayerId;

    if (!isActivePlayer) {
      return {
        label: 'In attesa del turno',
        disabled: true,
        action: () => {}
      };
    }

    if (!currentSettlement) {
      return {
        label: 'Costruisci riparo',
        disabled: false,
        action: () => handleBuild(player.id)
      };
    }

    if (currentSettlement.level === 'riparo') {
      return {
        label: 'Migliora a villaggio',
        disabled: false,
        action: () => handleUpgrade(currentSettlement.id)
      };
    }

    if (currentSettlement.level === 'villaggio') {
      return {
        label: 'Migliora a citta',
        disabled: false,
        action: () => handleUpgrade(currentSettlement.id)
      };
    }

    return {
      label: 'Citta completa',
      disabled: true,
      action: () => {}
    };
  };

  return (
    <div className="map-board">
      <h2>Mappa dei territori</h2>
      {error && <p className="alert">{error}</p>}
      {loading ? (
        <p className="hint">Caricamento mappa…</p>
      ) : (
        <>
          <div className="map-grid">
            {territories.map((territory) => (
              <div key={territory.id} className="territory-cell">
                <h3>{territory.name}</h3>
                <span className="territory-type">{territory.terrain_type}</span>
                <p className="territory-description">{territory.description}</p>
                <div className="territory-players">
                  {(playersByTerritory[territory.id] || []).length > 0 ? (
                    playersByTerritory[territory.id].map((playerName) => (
                      <span key={`${territory.id}-${playerName}`} className="player-chip">{playerName}</span>
                    ))
                  ) : (
                    <span className="hint">Nessun giocatore</span>
                  )}
                </div>
                <div className="settlement-list">
                  {(territory.settlements || []).length > 0 ? (
                    territory.settlements.map((settlement) => (
                      <div key={settlement.id} className="settlement-item">
                        <span>{settlement.player_name}: {settlement.level}</span>
                        <button onClick={() => handleUpgrade(settlement.id)} disabled={settlement.level === 'citta' || Number(settlement.player_id) !== activePlayerId}>
                          {settlement.level === 'citta' ? 'Citta completa' : Number(settlement.player_id) !== activePlayerId ? 'In attesa del turno' : 'Migliora'}
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="hint">Nessun insediamento</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="move-controls">
            {players.map((player) => (
              (() => {
                const settlementAction = getSettlementAction(player);
                const reachableTerritories = getReachableTerritories(player);
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
                    <button onClick={() => handleMove(player.id)} disabled={moveDisabled}>Sposta</button>
                    <button onClick={settlementAction.action} disabled={settlementAction.disabled}>
                      {settlementAction.label}
                    </button>
                    {!isActivePlayer && <span className="turn-waiting">In attesa del turno</span>}
                    {isActivePlayer && hasMovedThisTurn && <span className="turn-waiting">Spostamento già effettuato</span>}
                    {isActivePlayer && reachableTerritories.length === 0 && <span className="turn-waiting">Nessun territorio adiacente disponibile</span>}
                  </div>
                );
              })()
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default MapBoard;
