import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

function ActionBar({ actingRole, indent, onDone }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  async function doAction(action) {
    setError('');
    setLoading(true);
    try {
      const body = { action, notes };
      await apiFetch(`/ps/api/indents/${indent.id}/hod-action/`, { actingRole, method: 'POST', body });
      setNotes('');
      onDone?.();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  async function loadBreakdown() {
    setLoadingBreakdown(true);
    try {
      const data = await apiFetch(`/ps/api/indents/${indent.id}/stock-breakdown/`, { actingRole });
      setBreakdown(data);
    } catch (err) {
      setError(err.message || 'Failed to load stock breakdown');
    } finally {
      setLoadingBreakdown(false);
    }
  }

  return (
    <div className="actionBar">
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
      {actingRole === 'DEPADMIN' ? (
        <div className="row">
          <button className="btn ghost" type="button" disabled={loadingBreakdown} onClick={loadBreakdown}>
            {loadingBreakdown ? 'Checking stock…' : 'View stock breakdown'}
          </button>
          <button
            className="btn"
            type="button"
            disabled={loading}
            onClick={async () => {
              setError('');
              setLoading(true);
              try {
                await apiFetch(`/ps/api/indents/${indent.id}/check-stock/`, { actingRole, method: 'POST', body: {} });
                onDone?.();
              } catch (err) {
                setError(err.message || 'Check stock failed');
              } finally {
                setLoading(false);
              }
            }}
          >
            Check Stock
          </button>
        </div>
      ) : null}

      {breakdown ? (
        <div className="muted small">
          <div>
            Stock check: <b>{breakdown.all_available ? 'ALL AVAILABLE' : 'SHORTFALL'}</b>
          </div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {breakdown.items.map((x) => (
              <li key={x.item_id}>
                {x.item_name}: requested {x.requested_qty}, available {x.available_qty} {x.ok ? '✓' : '✗'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="row">
        <button className="btn" disabled={loading} onClick={() => doAction('APPROVE')}>
          Approve
        </button>
        <button className="btn danger" disabled={loading} onClick={() => doAction('REJECT')}>
          Reject
        </button>
        {actingRole === 'DEPADMIN' ? (
          <button className="btn ghost" disabled={loading} onClick={() => doAction('FORWARD')}>
            Forward to Director
          </button>
        ) : null}
      </div>
      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}

export default function HodDashboard({ actingRole, refreshKey }) {
  const [indents, setIndents] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState('PENDING');
  const [query, setQuery] = useState('');

  function reload() {
    setTick((t) => t + 1);
  }

  useEffect(() => {
    let cancelled = false;
    setError('');
    const path = tab === 'DECIDED' ? '/ps/api/indents/decisions/' : '/ps/api/indents/';
    apiFetch(path, { actingRole })
      .then((data) => {
        if (cancelled) return;
        if (tab === 'DECIDED') setDecisions(data);
        else setIndents(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [actingRole, refreshKey, tick, tab]);

  const list = tab === 'DECIDED' ? decisions : indents;
  const filtered = query.trim()
    ? list.filter((i) => (i.purpose || '').toLowerCase().includes(query.trim().toLowerCase()))
    : list;

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
            {tab === 'PENDING' ? <ActionBar actingRole={actingRole} indent={i} onDone={reload} /> : null}
          </div>
        ))}
        {!filtered.length && !error ? (
          <div className="muted">{tab === 'DECIDED' ? 'No approved/rejected indents yet.' : 'No indents assigned to you.'}</div>
        ) : null}
      </div>
    </div>
  );
}

