import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000/api';
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
const SETTLEMENT_RESOURCE_BONUSES = {
  riparo: 2,
  villaggio: 5,
  citta: 10
};

function PlayerPanel({ players, currentPlayerId, onGather, refreshTrigger }) {
  const activePlayerId = Number(currentPlayerId);
  const [territories, setTerritories] = useState([]);

  useEffect(() => {
    const loadTerritories = async () => {
      try {
        const response = await fetch(`${API_BASE}/territories`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Impossibile caricare i territori');
        }

        setTerritories(result.data || []);
      } catch (_err) {
        setTerritories([]);
      }
    };

    loadTerritories();
  }, [refreshTrigger]);

  const getExpectedGatherBonus = (player) => {
    const territory = territories.find((item) => Number(item.id) === Number(player.current_territory_id));
    if (!territory) {
      return null;
    }

    const territoryBonus = TERRITORY_RESOURCE_BONUSES[territory.name] || 0;
    const settlement = (territory.settlements || []).find((item) => Number(item.player_id) === Number(player.id));
    const settlementBonus = settlement ? SETTLEMENT_RESOURCE_BONUSES[settlement.level] || 0 : 0;

    return territoryBonus + settlementBonus;
  };

  return (
    <div>
      <h2>Giocatori</h2>
      <div className="card-list">
        {players.map((player) => (
          (() => {
            const isActivePlayer = Number(player.id) === activePlayerId;
            const hasGatheredThisTurn = Number(player.has_gathered_this_turn) === 1;
            const gatherDisabled = !isActivePlayer || hasGatheredThisTurn;
            const expectedBonus = getExpectedGatherBonus(player);
            const gatherLabel = !isActivePlayer
              ? 'In attesa del turno'
              : hasGatheredThisTurn
                ? 'Risorse già raccolte'
                : expectedBonus
                  ? `Raccogli risorse (+${expectedBonus})`
                  : 'Raccogli risorse';

            return (
              <div key={player.id} className="card">
                <h3>{player.name}</h3>
                <p><strong>Tribù:</strong> {player.tribe}</p>
                <p><strong>Risorse:</strong> {player.resources}</p>
                <p><strong>Territorio:</strong> {player.current_territory_name || 'Nessuno'}</p>
                <div className="actions">
                  <button onClick={() => onGather(player.id)} disabled={gatherDisabled}>
                    {gatherLabel}
                  </button>
                </div>
              </div>
            );
          })()
        ))}
      </div>
    </div>
  );
}

export default PlayerPanel;
