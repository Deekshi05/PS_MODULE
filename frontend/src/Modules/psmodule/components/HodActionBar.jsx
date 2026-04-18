import { useState } from 'react';
import { readStockBreakdown, writeCheckStock, writeCreateStockEntry, writeHodAction } from '../api';

export default function HodActionBar({ actingRole, indent, onDone, mode = 'PENDING' }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const canApprove = ['DEPADMIN', 'HOD', 'REGISTRAR', 'DIRECTOR'].includes(actingRole) && mode === 'PENDING';
  const canCheckStock = actingRole === 'DEPADMIN' && mode === 'PENDING';
  const canCreateStockEntry =
    ['DEPADMIN', 'PS_ADMIN'].includes(actingRole) && ['EXTERNAL_PROCUREMENT', 'APPROVED'].includes(indent.status);

  async function doAction(action) {
    setError('');
    setLoading(true);
    try {
      const payload = { action, notes };
      await writeHodAction({ actingRole, indentId: indent.id, payload });
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
    setError('');
    try {
      const data = await readStockBreakdown({ actingRole, indentId: indent.id });
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

      {canCheckStock ? (
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
                await writeCheckStock({ actingRole, indentId: indent.id });
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
        {canApprove ? (
          <button className="btn" disabled={loading} onClick={() => doAction('APPROVE')}>
            Approve
          </button>
        ) : null}
        {canApprove ? (
          <button className="btn danger" disabled={loading} onClick={() => doAction('REJECT')}>
            Reject
          </button>
        ) : null}
        {canApprove && actingRole === 'DEPADMIN' ? (
          <button className="btn ghost" disabled={loading} onClick={() => doAction('FORWARD')}>
            Forward to Director
          </button>
        ) : null}
        {canCreateStockEntry ? (
          <button
            className="btn"
            disabled={loading}
            onClick={async () => {
              setError('');
              setLoading(true);
              try {
                const items = (indent.items || []).map((line) => ({
                  item_id: line.item.id,
                  quantity: line.quantity,
                }));
                await writeCreateStockEntry({ actingRole, indentId: indent.id, payload: { notes, items } });
                setNotes('');
                onDone?.();
              } catch (err) {
                setError(err.message || 'Create stock entry failed');
              } finally {
                setLoading(false);
              }
            }}
          >
            Create Stock Entry
          </button>
        ) : null}
      </div>

      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}

