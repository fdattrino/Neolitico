import { useEffect, useState } from 'react';
import PlayerPanel from './components/PlayerPanel';
import BeliefCards from './components/BeliefCards';
import EventPanel from './components/EventPanel';
import GameLog from './components/GameLog';
import MapBoard from './components/MapBoard';

const API_BASE = 'http://localhost:3000/api';

function App() {
  const [players, setPlayers] = useState([]);
  const [beliefs, setBeliefs] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playersRes, beliefsRes, gameStateRes] = await Promise.all([
        fetch(`${API_BASE}/players`),
        fetch(`${API_BASE}/beliefs`),
        fetch(`${API_BASE}/game-state`)
      ]);

      const playersData = await playersRes.json();
      const beliefsData = await beliefsRes.json();
      const gameStateData = await gameStateRes.json();

      if (!playersRes.ok || !beliefsRes.ok || !gameStateRes.ok) {
        throw new Error('Errore nel caricamento dei dati');
      }

      setPlayers(playersData.data || []);
      setBeliefs(beliefsData.data || []);
      setGameState(gameStateData.data || null);
      setError('');
    } catch (err) {
      setError(err.message || 'Impossibile raggiungere il backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const buyBelief = async (playerId, beliefCardId) => {
    try {
      setError('');
      setSuccessMessage('');
      const response = await fetch(`${API_BASE}/players/${playerId}/buy-belief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ belief_card_id: beliefCardId })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Acquisto non riuscito');
      }
      setRefreshTrigger((value) => value + 1);
    } catch (err) {
      setError(err.message || 'Acquisto non riuscito');
    }
  };

  const drawEvent = async (playerId) => {
    try {
      setError('');
      setSuccessMessage('');
      const response = await fetch(`${API_BASE}/players/${playerId}/draw-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Pesca evento non riuscita');
      }
      setRefreshTrigger((value) => value + 1);
    } catch (err) {
      setError(err.message || 'Pesca evento non riuscita');
    }
  };

  const resetGame = async () => {
    const confirmed = window.confirm('Avviare una nuova partita? Questa azione resetta le risorse e il diario.');
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
      const response = await fetch(`${API_BASE}/reset`, {
        method: 'POST'
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Reset non riuscito');
      }
      setRefreshTrigger((value) => value + 1);
      setSuccessMessage(result.data?.message || 'Nuova partita avviata.');
    } catch (err) {
      setError(err.message || 'Reset non riuscito');
    }
  };

  const movePlayer = async (playerId, territoryId) => {
    try {
      setError('');
      setSuccessMessage('');
      const response = await fetch(`${API_BASE}/players/${playerId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territoryId })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Spostamento non riuscito');
      }
      setRefreshTrigger((value) => value + 1);
      setSuccessMessage('Spostamento completato.');
    } catch (err) {
      setError(err.message || 'Spostamento non riuscito');
      throw err;
    }
  };

  const buildSettlement = async (playerId) => {
    try {
      setError('');
      setSuccessMessage('');
      const response = await fetch(`${API_BASE}/players/${playerId}/build-settlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Costruzione non riuscita');
      }
      setRefreshTrigger((value) => value + 1);
      setSuccessMessage('Riparo costruito con successo.');
    } catch (err) {
      setError(err.message || 'Costruzione non riuscita');
      throw err;
    }
  };

  const gatherResources = async (playerId) => {
    try {
      setError('');
      setSuccessMessage('');
      const response = await fetch(`${API_BASE}/players/${playerId}/gather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Raccolta risorse non riuscita');
      }
      setRefreshTrigger((value) => value + 1);
      if (Number(result.data?.settlementBonus ?? 0) > 0) {
        setSuccessMessage(`Raccolta completata: +${result.data?.territoryBonus ?? 0} base e +${result.data?.settlementBonus ?? 0} dall'insediamento, totale +${result.data?.totalGain ?? 0}.`);
      } else {
        setSuccessMessage(`Raccolta completata: +${result.data?.totalGain ?? result.data?.bonus ?? 0} risorse.`);
      }
    } catch (err) {
      setError(err.message || 'Raccolta risorse non riuscita');
      throw err;
    }
  };

  const upgradeSettlement = async (settlementId) => {
    try {
      setError('');
      setSuccessMessage('');
      const response = await fetch(`${API_BASE}/settlements/${settlementId}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Miglioramento non riuscito');
      }
      setRefreshTrigger((value) => value + 1);
      setSuccessMessage('Insediamento migliorato con successo.');
    } catch (err) {
      setError(err.message || 'Miglioramento non riuscito');
      throw err;
    }
  };

  const endTurn = async () => {
    try {
      setError('');
      setSuccessMessage('');
      const response = await fetch(`${API_BASE}/turn/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Fine turno non riuscita');
      }
      setRefreshTrigger((value) => value + 1);
      setSuccessMessage('Turno aggiornato.');
    } catch (err) {
      setError(err.message || 'Fine turno non riuscita');
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-content">
          <div>
            <p className="eyebrow">Gioco didattico</p>
            <h1>Neolitico</h1>
            <p className="subtitle">Simula la vita della comunità preistorica: risorse, credenze ed eventi.</p>
          </div>
          <button className="hero-button" onClick={resetGame}>
            Nuova partita
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {loading ? (
        <p className="status">Caricamento della partita…</p>
      ) : (
        <>
          <section className="turn-panel">
            <div>
              <p className="eyebrow">Turno corrente</p>
              <h2>Round {gameState?.round} - Tocca ad {gameState?.current_player_name}</h2>
            </div>
            <button onClick={endTurn}>Fine turno</button>
          </section>
          <div className="layout">
            <section className="panel">
              <PlayerPanel players={players} currentPlayerId={gameState?.current_player_id} onGather={gatherResources} refreshTrigger={refreshTrigger} />
              <div className="divider" />
              <MapBoard players={players} currentPlayerId={gameState?.current_player_id} onMove={movePlayer} onBuild={buildSettlement} onUpgrade={upgradeSettlement} refreshTrigger={refreshTrigger} />
            </section>
            <section className="panel">
              <BeliefCards beliefs={beliefs} players={players} currentPlayerId={gameState?.current_player_id} onBuy={buyBelief} />
            </section>
            <section className="panel">
              <div className="events-stack">
                <EventPanel players={players} currentPlayerId={gameState?.current_player_id} onDraw={drawEvent} />
                <div className="divider" />
                <GameLog refreshTrigger={refreshTrigger} />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
