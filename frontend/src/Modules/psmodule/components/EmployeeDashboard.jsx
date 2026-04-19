import { useEffect, useMemo, useState } from 'react';
import { readIndents, writeConfirmDelivery } from '../api';
import IndentDetailModal from './IndentDetailModal';

export default function EmployeeDashboard({ actingRole, refreshKey }) {
  const [indents, setIndents] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [actionError, setActionError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    readIndents({ actingRole })
      .then((data) => {
        if (!cancelled) {
          setError('');
          setIndents(data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load');
      });

    return () => {
      cancelled = true;
    };
  }, [actingRole, refreshKey]);

  const counts = useMemo(() => {
    return indents.reduce(
      (acc, i) => {
        acc.ALL += 1;
        acc[i.status] = (acc[i.status] || 0) + 1;
        return acc;
      },
      { ALL: 0 }
    );
  }, [indents]);

  const visible = filter === 'ALL' ? indents : indents.filter((i) => i.status === filter);

  async function handleConfirmDelivery(indentId) {
    setActionError('');
    setActionLoadingId(indentId);
    try {
      await writeConfirmDelivery({ actingRole, indentId });
      const data = await readIndents({ actingRole });
      setIndents(data);
    } catch (err) {
      setActionError(err.message || 'Failed to confirm delivery');
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="card">
      <h2 style={{ color: '#000000' }}>My Indents</h2>
      <div className="row">
        <button className={filter === 'ALL' ? 'chip active' : 'chip'} onClick={() => setFilter('ALL')}>
          All ({counts.ALL || 0})
        </button>
        {['SUBMITTED', 'UNDER_HOD_REVIEW', 'FORWARDED', 'APPROVED', 'BIDDING', 'PURCHASED', 'STOCK_ENTRY', 'STOCKED', 'REJECTED'].map((s) => (
          <button key={s} className={filter === s ? 'chip active' : 'chip'} onClick={() => setFilter(s)}>
            {s} ({counts[s] || 0})
          </button>
        ))}
      </div>
      {error ? <div className="error">{error}</div> : null}
      {actionError ? <div className="error">{actionError}</div> : null}
      <div className="list">
        {visible.map((i) => (
          <div className="listItem" key={i.id}>
            <div
              className="row indentListClickable"
              role="button"
              tabIndex={0}
              aria-label={`View details for indent ${i.id}`}
              onClick={() => setDetailId(i.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailId(i.id);
                }
              }}
            >
              <div>
                <div className="title">Indent #{i.id}</div>
                <div className="muted small">{i.purpose}</div>
                <div className="muted small">
                  {i.procurement_type ? (
                    <>
                      Procurement: <b>{i.procurement_type}</b>
                    </>
                  ) : (
                    'Procurement: —'
                  )}
                  {'  '}|{'  '}
                  Current approver: <b>{i.current_approver ?? '—'}</b>
                </div>
              </div>
              <div className="right">
                <div className="badge">{i.status}</div>
                <div className={`badge ${i.stock_available ? 'good' : 'warn'}`}>
                  Stock: {i.stock_available ? 'Available' : 'Not available'}
                </div>
              </div>
            </div>
            {i.status === 'PURCHASED' ? (
              <div className="row" style={{ marginTop: 10, alignItems: 'center' }}>
                <div className="muted small">
                  Confirm Delivery: <b>{i.delivery_confirmed ? 'Completed' : 'Pending'}</b>
                </div>
                {!i.delivery_confirmed ? (
                  <button
                    className="btn success"
                    disabled={actionLoadingId === i.id}
                    onClick={() => handleConfirmDelivery(i.id)}
                  >
                    {actionLoadingId === i.id ? 'Processing...' : 'Confirm Delivery'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
        {!visible.length && !error ? <div className="muted">No indents for this filter.</div> : null}
      </div>
      {detailId != null ? (
        <IndentDetailModal actingRole={actingRole} indentId={detailId} onClose={() => setDetailId(null)} />
      ) : null}
    </div>
  );
}

