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
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playersRes, beliefsRes] = await Promise.all([
        fetch(`${API_BASE}/players`),
        fetch(`${API_BASE}/beliefs`)
      ]);

      const playersData = await playersRes.json();
      const beliefsData = await beliefsRes.json();

      if (!playersRes.ok || !beliefsRes.ok) {
        throw new Error('Errore nel caricamento dei dati');
      }

      setPlayers(playersData.data || []);
      setBeliefs(beliefsData.data || []);
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
      setSuccessMessage(`Spostamento completato.`);
    } catch (err) {
      setError(err.message || 'Spostamento non riuscito');
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
        <div className="layout">
          <section className="panel">
            <PlayerPanel players={players} />
            <div className="divider" />
            <MapBoard players={players} onMove={movePlayer} refreshTrigger={refreshTrigger} />
          </section>
          <section className="panel">
            <BeliefCards beliefs={beliefs} players={players} onBuy={buyBelief} />
          </section>
          <section className="panel">
            <div className="events-stack">
              <EventPanel players={players} onDraw={drawEvent} />
              <div className="divider" />
              <GameLog refreshTrigger={refreshTrigger} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
