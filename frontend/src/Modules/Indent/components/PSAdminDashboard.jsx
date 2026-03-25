import { useEffect, useState } from 'react';
import { readPSAdminCategories } from '../api';
import PSAdminActionBar from './PSAdminActionBar';

export default function PSAdminDashboard({ actingRole, refreshKey }) {
  const [categories, setCategories] = useState({ pending: [], bidding: [], purchased: [], stocked: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await readPSAdminCategories({ actingRole });
        if (!cancelled) {
          setCategories(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load indents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [actingRole, refreshKey, tick]);

  const normalizedQuery = query.trim().toLowerCase();

  const filterIndents = (indents) => {
    if (!normalizedQuery) return indents;
    return indents.filter((i) => (i.purpose || '').toLowerCase().includes(normalizedQuery));
  };

  const pendingIndents = filterIndents(categories.pending || []);
  const biddingIndents = filterIndents(categories.bidding || []);
  const purchasedIndents = filterIndents(categories.purchased || []);
  const stockedIndents = filterIndents(categories.stocked || []);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Procurement Management</h2>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search indents by purpose…"
          style={{ flex: '1 1 320px' }}
        />
      </div>

      {error ? <div className="error">{error}</div> : null}

      {loading && Object.keys(categories).every((k) => !categories[k]?.length) ? (
        <div className="muted">Loading indents...</div>
      ) : (
        <>
          {/* Pending Category */}
          <div style={{ marginTop: 20 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>
              Pending ({pendingIndents.length})
            </h3>
            <div className="list">
              {pendingIndents.length ? (
                pendingIndents.map((i) => (
                  <div className="listItem" key={i.id}>
                    <div className="row">
                      <div>
                        <div className="title">Indent #{i.id}</div>
                        <div className="muted small">{i.purpose}</div>
                        <div className="muted small">Department: {i.department}</div>
                      </div>
                      <div className="right">
                        <div className="badge">{i.status}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="muted small">Items: {i.items?.length || 0}</div>
                      {i.items?.map((item) => (
                        <div key={item.id} className="muted small">
                          - {item.item.name}: {item.quantity} {item.item.unit}
                        </div>
                      ))}
                    </div>
                    <PSAdminActionBar 
                      indent={i} 
                      category="pending" 
                      onDone={() => setTick((t) => t + 1)} 
                    />
                  </div>
                ))
              ) : (
                <div className="muted small">No pending indents</div>
              )}
            </div>
          </div>

          {/* Bidding Category */}
          <div style={{ marginTop: 20 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>
              Bidding ({biddingIndents.length})
            </h3>
            <div className="list">
              {biddingIndents.length ? (
                biddingIndents.map((i) => (
                  <div className="listItem" key={i.id}>
                    <div className="row">
                      <div>
                        <div className="title">Indent #{i.id}</div>
                        <div className="muted small">{i.purpose}</div>
                        <div className="muted small">Department: {i.department}</div>
                      </div>
                      <div className="right">
                        <div className="badge" style={{ backgroundColor: '#ff9800' }}>{i.status}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="muted small">Items: {i.items?.length || 0}</div>
                      {i.items?.map((item) => (
                        <div key={item.id} className="muted small">
                          - {item.item.name}: {item.quantity} {item.item.unit}
                        </div>
                      ))}
                    </div>
                    <PSAdminActionBar 
                      indent={i} 
                      category="bidding" 
                      onDone={() => setTick((t) => t + 1)} 
                    />
                  </div>
                ))
              ) : (
                <div className="muted small">No indents in bidding</div>
              )}
            </div>
          </div>

          {/* Purchased Category */}
          <div style={{ marginTop: 20 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>
              Purchased ({purchasedIndents.length})
            </h3>
            <div className="list">
              {purchasedIndents.length ? (
                purchasedIndents.map((i) => (
                  <div className="listItem" key={i.id}>
                    <div className="row">
                      <div>
                        <div className="title">Indent #{i.id}</div>
                        <div className="muted small">{i.purpose}</div>
                        <div className="muted small">Department: {i.department}</div>
                      </div>
                      <div className="right">
                        <div className="badge" style={{ backgroundColor: '#4caf50' }}>{i.status}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="muted small">Items: {i.items?.length || 0}</div>
                      {i.items?.map((item) => (
                        <div key={item.id} className="muted small">
                          - {item.item.name}: {item.quantity} {item.item.unit}
                        </div>
                      ))}
                    </div>
                    <PSAdminActionBar
                      indent={i}
                      category="purchased"
                      onDone={() => setTick((t) => t + 1)}
                    />
                  </div>
                ))
              ) : (
                <div className="muted small">No purchased indents</div>
              )}
            </div>
          </div>

          {/* Stocked Category */}
          <div style={{ marginTop: 20 }}>
            <h3 style={{ margin: '0 0 12px 0' }}>
              Stocked ({stockedIndents.length})
            </h3>
            <div className="list">
              {stockedIndents.length ? (
                stockedIndents.map((i) => (
                  <div className="listItem" key={i.id}>
                    <div className="row">
                      <div>
                        <div className="title">Indent #{i.id}</div>
                        <div className="muted small">{i.purpose}</div>
                        <div className="muted small">Department: {i.department}</div>
                      </div>
                      <div className="right">
                        <div className="badge" style={{ backgroundColor: '#2e7d32' }}>{i.status}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="muted small">Items: {i.items?.length || 0}</div>
                      {i.items?.map((item) => (
                        <div key={item.id} className="muted small">
                          - {item.item.name}: {item.quantity} {item.item.unit}
                        </div>
                      ))}
                    </div>
                    <div className="muted small" style={{ marginTop: 8, color: '#2e7d32' }}>
                      ✓ Stock updated
                    </div>
                  </div>
                ))
              ) : (
                <div className="muted small">No stocked indents</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
