function GameLog({ log = [] }) {
  return (
    <div>
      <h2>Diario della partita</h2>
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
