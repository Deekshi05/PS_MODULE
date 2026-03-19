import { useEffect, useState } from 'react';
import { readDecisions, readIndents } from '../api';
import HodActionBar from './HodActionBar';

export default function HodDashboard({ actingRole, refreshKey }) {
  const [indents, setIndents] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (tab === 'DECIDED') {
          const data = await readDecisions({ actingRole });
          if (!cancelled) setDecisions(data);
        } else {
          const data = await readIndents({ actingRole });
          if (!cancelled) setIndents(data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [actingRole, refreshKey, tab, tick]);

  const list = tab === 'DECIDED' ? decisions : indents;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery ? list.filter((i) => (i.purpose || '').toLowerCase().includes(normalizedQuery)) : list;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{tab === 'DECIDED' ? 'My decisions' : 'Approval queue'}</h2>
        <div className="row">
          <button className={tab === 'PENDING' ? 'chip active' : 'chip'} type="button" onClick={() => setTab('PENDING')}>
            Pending
          </button>
          <button className={tab === 'DECIDED' ? 'chip active' : 'chip'} type="button" onClick={() => setTab('DECIDED')}>
            Approved/Rejected
          </button>
        </div>
      </div>

      {actingRole === 'DEPADMIN' ? (
        <div className="row" style={{ marginTop: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search indents by purpose…"
            style={{ flex: '1 1 320px' }}
          />
        </div>
      ) : null}

      {error ? <div className="error">{error}</div> : null}

      <div className="list">
        {filtered.map((i) => (
          <div className="listItem" key={i.id}>
            <div className="row">
              <div>
                <div className="title">Indent #{i.id}</div>
                <div className="muted small">{i.purpose}</div>
              </div>
              <div className="right">
                <div className="badge">{i.status}</div>
                <div className={`badge ${i.stock_available ? 'good' : 'warn'}`}>
                  Stock: {i.stock_available ? 'Available' : 'Not available'}
                </div>
                {i.procurement_type ? <div className="badge">Type: {i.procurement_type}</div> : null}
              </div>
            </div>
            {tab === 'PENDING' ? <HodActionBar actingRole={actingRole} indent={i} onDone={() => setTick((t) => t + 1)} /> : null}
          </div>
        ))}
        {!filtered.length && !error ? (
          <div className="muted">{tab === 'DECIDED' ? 'No approved/rejected indents yet.' : 'No indents assigned to you.'}</div>
        ) : null}
      </div>
    </div>
  );
}

