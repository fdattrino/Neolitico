import { useEffect, useState } from 'react';
import PlayerPanel from './components/PlayerPanel';
import BeliefCards from './components/BeliefCards';
import EventPanel from './components/EventPanel';
import GameLog from './components/GameLog';
import MapBoard from './components/MapBoard';

const API_BASE = 'http://localhost:3000/api';
const PHASE_LABELS = {
  setup_placement: 'Collocazione iniziale',
  production: 'Produzione',
  maintenance: 'Mantenimento',
  event: 'Imprevisto',
  population: 'Crescita popolazione',
  movement: 'Movimento',
  post_movement_check: 'Verifica post movimento',
  beliefs: 'Credenze',
  transformation: 'Trasformazione'
};
const TURN_PHASE_ORDER = [
  'production',
  'maintenance',
  'event',
  'population',
  'movement',
  'post_movement_check',
  'beliefs',
  'transformation'
];

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

  const applyMaintenance = (playerId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Mantenimento risolto.',
      'Mantenimento non riuscito'
    )
  );

  const growPopulation = (playerId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/population`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Crescita popolazione completata.',
      'Crescita popolazione non riuscita'
    )
  );

  const verifyPostMovement = () => (
    performAction(
      () => fetch(`${API_BASE}/turn/post-movement-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Verifica post movimento completata.',
      'Verifica post movimento non riuscita'
    )
  );

  const advancePhase = () => (
    performAction(
      () => fetch(`${API_BASE}/phase/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Fase avanzata.',
      'Avanzamento fase non riuscito'
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

    const totalProduction = Number(result.data?.production?.totalProduction ?? 0);
    setSuccessMessage(`Produzione completata: +${totalProduction} risorse.`);
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

  const placeShelter = (playerId, territoryId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/place-shelter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territoryId })
      }),
      'Riparo collocato.',
      'Collocazione riparo non riuscita'
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

  const currentPhase = gameState?.current_phase || gameState?.phase || 'setup_placement';
  const currentPlayerId = gameState?.current_player_id;
  const orderedPlayers = [...players].sort((firstPlayer, secondPlayer) => Number(firstPlayer.id) - Number(secondPlayer.id));
  const currentPlayerIndex = orderedPlayers.findIndex((player) => Number(player.id) === Number(currentPlayerId));
  const isLastPlayerInOrder = currentPlayerIndex >= 0 && currentPlayerIndex === orderedPlayers.length - 1;
  const nextPlayer = currentPlayerIndex >= 0
    ? orderedPlayers[isLastPlayerInOrder ? 0 : currentPlayerIndex + 1]
    : null;
  const currentPlayer = currentPlayerIndex >= 0 ? orderedPlayers[currentPlayerIndex] : null;
  const currentPhaseIndex = TURN_PHASE_ORDER.indexOf(currentPhase);
  const nextPhase = currentPhase === 'setup_placement'
    ? (isLastPlayerInOrder ? 'production' : 'setup_placement')
    : currentPhaseIndex >= 0
      ? (currentPhase === 'transformation'
        ? 'production'
        : TURN_PHASE_ORDER[currentPhaseIndex + 1] || 'production')
      : 'production';
  const advanceButtonLabel = currentPlayer && nextPlayer
    ? `${PHASE_LABELS[currentPhase] || currentPhase} ${currentPlayer.name} -> ${PHASE_LABELS[nextPhase] || nextPhase} ${nextPlayer.name}`
    : 'Avanza fase';
  const canAdvanceSetupPlacement = currentPhase !== 'setup_placement'
    || Number(currentPlayer?.shelters_to_place ?? 0) === 0;

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
              <h2>Round {gameState?.round} - Fase: {PHASE_LABELS[currentPhase] || currentPhase} - Tocca ad {gameState?.current_player_name}</h2>
            </div>
            <div className="actions">
              {currentPhase === 'maintenance' && currentPlayerId && (
                <button onClick={() => applyMaintenance(currentPlayerId)}>Applica mantenimento</button>
              )}
              {currentPhase === 'population' && currentPlayerId && (
                <button onClick={() => growPopulation(currentPlayerId)}>Crescita popolazione</button>
              )}
              {currentPhase === 'post_movement_check' && (
                <button onClick={verifyPostMovement}>Verifica conflitti</button>
              )}
              <button onClick={advancePhase} disabled={!canAdvanceSetupPlacement}>
                {advanceButtonLabel}
              </button>
            </div>
          </section>
          <div className="game-layout">
            <section className="panel players-panel">
              <PlayerPanel
                players={players}
                territories={territories}
                developments={developments}
                currentPlayerId={currentPlayerId}
                currentPhase={currentPhase}
                onGather={gatherResources}
                onBuildShelter={buildShelter}
                onUpgradeVillage={upgradeToVillage}
                onUpgradeCity={upgradeToCity}
              />
            </section>
            <section className="panel map-panel">
              <MapBoard
                players={players}
                territories={territories}
                developments={developments}
                currentPlayerId={currentPlayerId}
                currentPhase={currentPhase}
                onMove={movePlayer}
                onBattle={battleInTerritory}
                onPlaceShelter={placeShelter}
              />
            </section>
            <div className="bottom-layout">
              <section className="panel beliefs-panel">
                <BeliefCards beliefs={beliefs} players={players} currentPlayerId={currentPlayerId} currentPhase={currentPhase} onBuy={buyBelief} />
              </section>
              <div className="events-stack">
                <section className="panel events-panel">
                  <EventPanel players={players} currentPlayerId={currentPlayerId} currentPhase={currentPhase} onDraw={drawEvent} events={events} />
                </section>
                <section className="panel log-panel">
                  <GameLog log={log} />
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
