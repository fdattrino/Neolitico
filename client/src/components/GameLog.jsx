import { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:3000/api';

function GameLog({ refreshTrigger }) {
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLog = async () => {
      try {
        const response = await fetch(`${API_BASE}/log`);
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Impossibile caricare il diario');
        }
        setLog(result.data || []);
        setError('');
      } catch (err) {
        setError(err.message || 'Impossibile caricare il diario');
      }
    };

    loadLog();
  }, [refreshTrigger]);

  return (
    <div>
      <h2>Diario della partita</h2>
      {error && <p className="alert">{error}</p>}
      {log.length === 0 ? (
        <p className="hint">Nessuna azione registrata</p>
      ) : (
        <ul className="log-list">
          {log.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.message}</strong>
              {entry.details && (
                <div>
                  {typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default GameLog;
