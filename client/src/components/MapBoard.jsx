import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000/api';

function MapBoard({ players, onMove, refreshTrigger }) {
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTerritoryIds, setSelectedTerritoryIds] = useState({});

  useEffect(() => {
    const loadTerritories = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/territories`);
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Impossibile caricare la mappa');
        }
        setTerritories(result.data || []);
        setError('');
      } catch (err) {
        setError(err.message || 'Impossibile caricare la mappa');
      } finally {
        setLoading(false);
      }
    };

    loadTerritories();
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
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default MapBoard;
