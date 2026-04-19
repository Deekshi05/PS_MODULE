import { useState } from 'react';
import { writeCreateStockEntry, writeHodAction } from '../api';

export default function HodActionBar({ actingRole, indent, onDone, mode = 'PENDING' }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const canApprove = ['DEPADMIN', 'HOD', 'REGISTRAR', 'DIRECTOR'].includes(actingRole) && mode === 'PENDING';
  // Must match backend get_indent_for_stock_entry: PURCHASED + delivery confirmed only.
  const canCreateStockEntry =
    ['DEPADMIN', 'PS_ADMIN'].includes(actingRole) &&
    indent.status === 'PURCHASED' &&
    Boolean(indent.delivery_confirmed);

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

  return (
    <div className="actionBar">
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />

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
                const items = (indent.items || [])
                  .filter((line) => line.item?.id != null || line.item_id != null)
                  .map((line) => ({
                    item_id: line.item?.id ?? line.item_id,
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

