import { useEffect, useState } from 'react';
import PlayerPanel from './components/PlayerPanel';
import BeliefCards from './components/BeliefCards';
import EventPanel from './components/EventPanel';
import GameLog from './components/GameLog';

const API_BASE = 'http://localhost:3000/api';

function App() {
  const [players, setPlayers] = useState([]);
  const [beliefs, setBeliefs] = useState([]);
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playersRes, beliefsRes, logRes] = await Promise.all([
        fetch(`${API_BASE}/players`),
        fetch(`${API_BASE}/beliefs`),
        fetch(`${API_BASE}/log`)
      ]);

      const playersData = await playersRes.json();
      const beliefsData = await beliefsRes.json();
      const logData = await logRes.json();

      if (!playersRes.ok || !beliefsRes.ok || !logRes.ok) {
        throw new Error('Errore nel caricamento dei dati');
      }

      setPlayers(playersData.data || []);
      setBeliefs(beliefsData.data || []);
      setLog(logData.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Impossibile raggiungere il backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const buyBelief = async (playerId, beliefCardId) => {
    try {
      const response = await fetch(`${API_BASE}/players/${playerId}/buy-belief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ belief_card_id: beliefCardId })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Acquisto non riuscito');
      }
      await loadData();
    } catch (err) {
      setError(err.message || 'Acquisto non riuscito');
    }
  };

  const drawEvent = async (playerId) => {
    try {
      const response = await fetch(`${API_BASE}/players/${playerId}/draw-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Pesca evento non riuscita');
      }
      await loadData();
    } catch (err) {
      setError(err.message || 'Pesca evento non riuscita');
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Gioco didattico</p>
          <h1>Neolitico</h1>
          <p className="subtitle">Simula la vita della comunità preistorica: risorse, credenze ed eventi.</p>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <p className="status">Caricamento della partita…</p>
      ) : (
        <div className="layout">
          <section className="panel">
            <PlayerPanel players={players} />
          </section>
          <section className="panel">
            <BeliefCards beliefs={beliefs} players={players} onBuy={buyBelief} />
          </section>
          <section className="panel">
            <div className="events-stack">
              <EventPanel players={players} onDraw={drawEvent} />
              <div className="divider" />
              <GameLog log={log} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
