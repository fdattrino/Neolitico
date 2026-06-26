import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000/api';

function MapBoard({ players, onMove, onBuild, onUpgrade, refreshTrigger }) {
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState({});

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
      playersByTerritory[player.current_territory_id] = playersByTerritory[player.current_territory_id] || [];
      playersByTerritory[player.current_territory_id].push(player.name);
    }
  });

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
                        <button onClick={() => handleUpgrade(settlement.id)} disabled={settlement.level === 'citta'}>
                          Migliora
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
              <div key={player.id} className="move-control">
                <strong>{player.name}</strong>
                <span>{player.current_territory_name || 'Sconosciuto'}</span>
                <select
                  value={selectedTerritoryIds[player.id] || ''}
                  onChange={(event) => setSelectedTerritoryIds((current) => ({ ...current, [player.id]: event.target.value }))}
                >
                  <option value="">Seleziona territorio</option>
                  {territories.map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      {territory.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => handleMove(player.id)}>Sposta</button>
                <button onClick={() => handleBuild(player.id)}>Costruisci riparo</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default MapBoard;
