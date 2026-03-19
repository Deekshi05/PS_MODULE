import { useEffect, useMemo, useState } from 'react';
import { readIndents } from '../api';

export default function EmployeeDashboard({ actingRole, refreshKey }) {
  const [indents, setIndents] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

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

  return (
    <div className="card">
      <h2>My indents</h2>
      <div className="row">
        <button className={filter === 'ALL' ? 'chip active' : 'chip'} onClick={() => setFilter('ALL')}>
          All ({counts.ALL || 0})
        </button>
        {['SUBMITTED', 'UNDER_HOD_REVIEW', 'FORWARDED', 'APPROVED', 'REJECTED'].map((s) => (
          <button key={s} className={filter === s ? 'chip active' : 'chip'} onClick={() => setFilter(s)}>
            {s} ({counts[s] || 0})
          </button>
        ))}
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="list">
        {visible.map((i) => (
          <div className="listItem" key={i.id}>
            <div className="row">
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
          </div>
        ))}
        {!visible.length && !error ? <div className="muted">No indents for this filter.</div> : null}
      </div>
    </div>
  );
}

