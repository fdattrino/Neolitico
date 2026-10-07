import { useEffect, useState } from 'react';
import PlayerPanel from './components/PlayerPanel';
import BeliefCards from './components/BeliefCards';
import EventPanel from './components/EventPanel';
import GameLog from './components/GameLog';
import MapBoard from './components/MapBoard';
import SavedGames from './components/SavedGames';

const API_BASE = 'http://localhost:3000/api';
const PHASE_LABELS = {
  setup_placement: 'Collocazione iniziale',
  production: 'Produzione del round',
  maintenance: 'Mantenimento',
  event: 'Imprevisto',
  population: 'Crescita popolazione',
  movement: 'Movimento',
  post_movement_check: 'Verifica post movimento',
  beliefs: 'Credenze',
  transformation: 'Trasformazione',
  game_over: 'Fine partita'
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
  const [lastEvent, setLastEvent] = useState(null);
  const [saves, setSaves] = useState([]);
  const [currentSaveName, setCurrentSaveName] = useState('');
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
      try {
        const savesRes = await fetch(`${API_BASE}/saves`);
        const savesData = await savesRes.json();
        setSaves(savesData.data || []);
      } catch (_savesError) {
        setSaves([]);
      }
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

  const drawEvent = async (playerId) => {
    const result = await performAction(
      () => fetch(`${API_BASE}/players/${playerId}/draw-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Evento risolto.',
      'Pesca evento non riuscita'
    );
    const player = players.find((item) => Number(item.id) === Number(playerId));
    setLastEvent({ ...result.data.event, playerName: player?.name });
    return result;
  };

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

  const saveGame = async (rawName) => {
    const name = rawName.trim();
    const send = (overwrite) => fetch(`${API_BASE}/saves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, overwrite })
    });

    let response = await send(false);
    let result = await response.json();

    if (response.status === 409 && result.exists) {
      if (!window.confirm(`Esiste già una partita chiamata "${name}". Vuoi sovrascriverla?`)) {
        return;
      }
      response = await send(true);
      result = await response.json();
    }

    if (!response.ok) {
      setSuccessMessage('');
      setError(result.error || 'Salvataggio non riuscito');
      throw new Error(result.error);
    }

    setError('');
    setCurrentSaveName(result.data?.name || name);
    await loadData();
    setSuccessMessage(`Partita "${result.data?.name || name}" salvata.`);
  };

  const loadSavedGame = async (save) => {
    if (!window.confirm(`Caricare "${save.name}"? La partita in corso verrà sostituita: salvala prima se vuoi conservarla.`)) {
      return;
    }
    await performAction(
      () => fetch(`${API_BASE}/saves/${save.id}/load`, { method: 'POST' }),
      `Partita "${save.name}" caricata.`,
      'Caricamento non riuscito'
    );
    setCurrentSaveName(save.name);
    setLastEvent(null);
  };

  const deleteSavedGame = async (save) => {
    if (!window.confirm(`Eliminare definitivamente "${save.name}"?`)) {
      return;
    }
    await performAction(
      () => fetch(`${API_BASE}/saves/${save.id}`, { method: 'DELETE' }),
      `Partita "${save.name}" eliminata.`,
      'Eliminazione non riuscita'
    );
  };

  const resetGame = async () => {
    const confirmed = window.confirm('Avviare una nuova partita? Questa azione resetta le risorse e il diario. Se vuoi conservare quella attuale, salvala prima con "Salva partita".');
    if (!confirmed) {
      return;
    }

    await performAction(
      () => fetch(`${API_BASE}/reset`, { method: 'POST' }),
      'Nuova partita avviata.',
      'Reset non riuscito'
    );
    setLastEvent(null);
    setCurrentSaveName('');
  };

  const movePlayer = (playerId, fromTerritoryId, toTerritoryId, sheltersToMove = 0, villagesToMove = 0) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromTerritoryId, toTerritoryId, sheltersToMove, villagesToMove })
      }),
      'Spostamento completato.',
      'Spostamento non riuscito'
    )
  );

  const finishMovement = (playerId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/finish-movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Fase trasferimento conclusa.',
      'Conclusione trasferimenti non riuscita'
    )
  );

  const battleInTerritory = (territoryId, attackerId, battleType) => (
    performAction(
      () => fetch(`${API_BASE}/territories/${territoryId}/battle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attackerId, battleType })
      }),
      'Battaglia risolta.',
      'Battaglia non riuscita'
    )
  );

  const applyRoundProduction = async () => {
    const result = await performAction(
      () => fetch(`${API_BASE}/production/apply-round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      '',
      'Produzione del round non riuscita'
    );

    const totalProduction = (result.data?.productionResults || []).reduce(
      (sum, playerResult) => sum + Number(playerResult.totalProduction ?? 0),
      0
    );
    setSuccessMessage(`Produzione del round completata: +${totalProduction} risorse complessive.`);
  };

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

  const upgradeToVillage = (playerId, territoryId, quantity) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/upgrade-to-village`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territoryId, quantity })
      }),
      'Villaggio formato con successo.',
      'Formazione villaggio non riuscita'
    )
  );

  const upgradeToCity = (playerId, territoryId, quantity) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/upgrade-to-city`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ territoryId, quantity })
      }),
      'Città fondata con successo.',
      'Fondazione città non riuscita'
    )
  );

  const finishTransformation = (playerId) => (
    performAction(
      () => fetch(`${API_BASE}/players/${playerId}/finish-transformation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }),
      'Fase trasformazione conclusa.',
      'Conclusione trasformazioni non riuscita'
    )
  );

  const advanceCurrentPhase = () => {
    if (currentPhase === 'transformation' && currentPlayerId) {
      return finishTransformation(currentPlayerId);
    }

    return advancePhase();
  };

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
      ? (isLastPlayerInOrder
        ? (currentPhase === 'transformation'
          ? 'production'
          : TURN_PHASE_ORDER[currentPhaseIndex + 1] || 'production')
        : currentPhase)
      : 'production';
  const standings = orderedPlayers
    .map((player) => {
      const own = developments.filter((development) => Number(development.player_id) === Number(player.id));
      const sum = (field) => own.reduce((total, development) => total + Number(development[field] ?? 0), 0);
      return {
        id: player.id,
        name: player.name,
        cities: sum('cities'),
        villages: sum('villages'),
        shelters: sum('shelters'),
        resources: Number(player.resources ?? 0)
      };
    })
    .sort((a, b) => (b.cities - a.cities) || (b.villages - a.villages) || (b.resources - a.resources));
  const isDraw = standings.length > 1
    && standings[0].cities === standings[1].cities
    && standings[0].villages === standings[1].villages
    && standings[0].resources === standings[1].resources;
  const advanceButtonLabel = currentPlayer && nextPlayer
    ? `${PHASE_LABELS[currentPhase] || currentPhase} ${currentPlayer.name} -> ${PHASE_LABELS[nextPhase] || nextPhase} ${nextPlayer.name}`
    : 'Avanza fase';
  const canAdvanceSetupPlacement = currentPhase !== 'setup_placement'
    || Number(currentPlayer?.shelters_to_place ?? 0) === 0;
  const advancePhaseDisabled = currentPhase === 'population'
    || currentPhase === 'production'
    || currentPhase === 'movement'
    || currentPhase === 'event'
    || currentPhase === 'game_over'
    || !canAdvanceSetupPlacement;

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-content">
          <div>
            <p className="eyebrow">Gioco didattico</p>
            <h1>Neolitico</h1>
            <p className="subtitle">Simula la vita della comunità preistorica: risorse, credenze, prede ed evoluzione degli insediamenti.</p>
          </div>
          <div className="hero-buttons">
            <button className="hero-button" onClick={() => document.getElementById('saved-games')?.scrollIntoView({ behavior: 'smooth' })}>
              Salva / carica
            </button>
            <button className="hero-button" onClick={resetGame}>
              Nuova partita
            </button>
          </div>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {loading ? (
        <p className="status">Caricamento della partita…</p>
      ) : (
        <>
          {currentPhase === 'game_over' && (
            <section className="turn-panel">
              <div>
                <p className="eyebrow">Fine partita dopo 10 round</p>
                <h2>{isDraw ? 'Pareggio!' : `Vince ${standings[0]?.name}!`}</h2>
                <ul>
                  {standings.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.name}</strong>: {entry.cities} città, {entry.villages} villaggi, {entry.shelters} ripari, {entry.resources} risorse
                    </li>
                  ))}
                </ul>
                <p className="hint">Vince chi ha più città; a parità decidono i villaggi e poi le risorse. Premi "Nuova partita" per ricominciare.</p>
              </div>
            </section>
          )}
          <section className="turn-panel">
            <div>
              <p className="eyebrow">Turno corrente</p>
              <h2>Round {gameState?.round} - Fase: {PHASE_LABELS[currentPhase] || currentPhase} - Tocca ad {gameState?.current_player_name}</h2>
            </div>
            <div className="actions">
              {currentPhase === 'production' && (
                <button onClick={applyRoundProduction}>Applica produzione del round</button>
              )}
              {currentPhase === 'maintenance' && currentPlayerId && (
                <button onClick={() => applyMaintenance(currentPlayerId)}>Applica mantenimento</button>
              )}
              {currentPhase === 'population' && currentPlayerId && (
                <button onClick={() => growPopulation(currentPlayerId)}>Crescita popolazione</button>
              )}
              {currentPhase === 'post_movement_check' && (
                <button onClick={verifyPostMovement}>Verifica conflitti</button>
              )}
              <button onClick={advanceCurrentPhase} disabled={advancePhaseDisabled}>
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
                onFinishMovement={finishMovement}
                onBattle={battleInTerritory}
                onPlaceShelter={placeShelter}
                onUpgradeVillage={upgradeToVillage}
                onUpgradeCity={upgradeToCity}
                onFinishTransformation={finishTransformation}
              />
            </section>
            <div className="bottom-layout">
              <section className="panel beliefs-panel">
                <BeliefCards beliefs={beliefs} players={players} currentPlayerId={currentPlayerId} currentPhase={currentPhase} onBuy={buyBelief} />
              </section>
              <div className="events-stack">
                <section className="panel events-panel">
                  <EventPanel players={players} currentPlayerId={currentPlayerId} currentPhase={currentPhase} onDraw={drawEvent} events={events} lastEvent={lastEvent} />
                </section>
                <section className="panel log-panel">
                  <GameLog log={log} />
                </section>
              </div>
            </div>
            <section className="panel saves-panel" id="saved-games">
              <SavedGames
                saves={saves}
                currentName={currentSaveName}
                onSave={saveGame}
                onLoad={loadSavedGame}
                onDelete={deleteSavedGame}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
