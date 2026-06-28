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
  const [events, setEvents] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [developments, setDevelopments] = useState([]);
  const [log, setLog] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [playersRes, beliefsRes, eventsRes, territoriesRes, developmentsRes, gameStateRes, logRes] = await Promise.all([
        fetch(`${API_BASE}/players`),
        fetch(`${API_BASE}/beliefs`),
        fetch(`${API_BASE}/events`),
        fetch(`${API_BASE}/territories`),
        fetch(`${API_BASE}/developments`),
        fetch(`${API_BASE}/game-state`),
        fetch(`${API_BASE}/log`)
      ]);

      const [playersData, beliefsData, eventsData, territoriesData, developmentsData, gameStateData, logData] = await Promise.all([
        playersRes.json(),
        beliefsRes.json(),
        eventsRes.json(),
        territoriesRes.json(),
        developmentsRes.json(),
        gameStateRes.json(),
        logRes.json()
      ]);

      if (!playersRes.ok || !beliefsRes.ok || !eventsRes.ok || !territoriesRes.ok || !developmentsRes.ok || !gameStateRes.ok || !logRes.ok) {
        throw new Error('Errore nel caricamento dei dati');
      }

      setPlayers(playersData.data || []);
      setBeliefs(beliefsData.data || []);
      setEvents(eventsData.data || []);
      setTerritories(territoriesData.data || []);
      setDevelopments(developmentsData.data || []);
      setGameState(gameStateData.data || null);
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

  const performAction = async (request, successText, fallbackError) => {
    try {
      setError('');
      setSuccessMessage('');
      const response = await request();
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || fallbackError);
      }
      await loadData();
      if (successText) {
        setSuccessMessage(successText);
      }
      return result;
    } catch (err) {
      setError(err.message || fallbackError);
      throw err;
    }
  };

  const buyBelief = (playerId, beliefCardId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/buy-belief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ belief_card_id: beliefCardId })
      }),
      'Credenza acquistata.',
      'Acquisto non riuscito'
    )
  );

  const drawEvent = (playerId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/draw-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Evento risolto.',
      'Pesca evento non riuscita'
    )
  );

  const resetGame = async () => {
    const confirmed = window.confirm('Avviare una nuova partita? Questa azione resetta le risorse e il diario.');
    if (!confirmed) {
      return;
    }

    await performAction(
      () => fetch(`${API_BASE}/reset`, { method: 'POST' }),
      'Nuova partita avviata.',
      'Reset non riuscito'
    );
  };

  const movePlayer = (playerId, territoryId, sheltersToMove = 0, villagesToMove = 0) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territoryId, sheltersToMove, villagesToMove })
      }),
      'Spostamento completato.',
      'Spostamento non riuscito'
    )
  );

  const battleInTerritory = (territoryId) => (
    performAction(
      () => fetch(`${API_BASE}/territories/${territoryId}/battle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Battaglia risolta.',
      'Battaglia non riuscita'
    )
  );

  const gatherResources = async (playerId) => {
    const result = await performAction(
      () => fetch(`${API_BASE}/players/${playerId}/gather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      '',
      'Raccolta risorse non riuscita'
    );

    const developmentBonus = Number(result.data?.developmentBonus ?? result.data?.settlementBonus ?? 0);
    if (developmentBonus > 0) {
      setSuccessMessage(`Raccolta completata: +${result.data?.territoryBonus ?? 0} base e +${developmentBonus} dagli insediamenti, totale +${result.data?.totalGain ?? 0}.`);
    } else {
      setSuccessMessage(`Raccolta completata: +${result.data?.totalGain ?? result.data?.bonus ?? 0} risorse.`);
    }
  };

  const buildShelter = (playerId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/build-shelter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Riparo costruito con successo.',
      'Costruzione non riuscita'
    )
  );

  const upgradeToVillage = (playerId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/upgrade-to-village`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Villaggio formato con successo.',
      'Formazione villaggio non riuscita'
    )
  );

  const upgradeToCity = (playerId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/upgrade-to-city`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Città fondata con successo.',
      'Fondazione città non riuscita'
    )
  );

  const endTurn = () => (
    performAction(
      () => fetch(`${API_BASE}/turn/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Turno aggiornato.',
      'Fine turno non riuscita'
    )
  );

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-content">
          <div>
            <p className="eyebrow">Gioco didattico</p>
            <h1>Neolitico</h1>
            <p className="subtitle">Simula la vita della comunità preistorica: risorse, credenze, prede ed evoluzione degli insediamenti.</p>
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
          <div className="game-layout">
            <div className="left-column">
              <section className="panel">
                <PlayerPanel
                  players={players}
                  territories={territories}
                  developments={developments}
                  currentPlayerId={gameState?.current_player_id}
                  onGather={gatherResources}
                  onBuildShelter={buildShelter}
                  onUpgradeVillage={upgradeToVillage}
                  onUpgradeCity={upgradeToCity}
                />
              </section>
              <section className="panel">
                <MapBoard
                  players={players}
                  territories={territories}
                  developments={developments}
                  currentPlayerId={gameState?.current_player_id}
                  onMove={movePlayer}
                  onBattle={battleInTerritory}
                />
              </section>
              <section className="panel">
                <EventPanel players={players} currentPlayerId={gameState?.current_player_id} onDraw={drawEvent} events={events} />
              </section>
              <section className="panel">
                <GameLog log={log} />
              </section>
            </div>
            <div className="right-column">
              <section className="panel">
                <BeliefCards beliefs={beliefs} players={players} currentPlayerId={gameState?.current_player_id} onBuy={buyBelief} />
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
