import { useEffect, useState } from 'react';
import { readPSAdminCategories } from '../api';
import IndentDetailModal from './IndentDetailModal';
import PSAdminActionBar from './PSAdminActionBar';

export default function PSAdminDashboard({ actingRole, refreshKey }) {
  const [categories, setCategories] = useState({ pending: [], bidding: [], purchased: [], stock_entry: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [detailId, setDetailId] = useState(null);

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

  const rawPending = categories.pending || [];
  const rawBidding = categories.bidding || [];
  const rawPurchased = categories.purchased || [];
  const rawStockEntry = categories.stock_entry || [];

  const pendingIndents = filterIndents(rawPending).map((i) => ({ ...i, _category: 'pending' }));
  const biddingIndents = filterIndents(rawBidding).map((i) => ({ ...i, _category: 'bidding' }));
  const purchasedIndents = filterIndents(rawPurchased).map((i) => ({ ...i, _category: 'purchased' }));
  const stockEntryIndents = filterIndents(rawStockEntry).map((i) => ({ ...i, _category: 'stock_entry' }));

  const allIndents = [...pendingIndents, ...biddingIndents, ...purchasedIndents, ...stockEntryIndents].sort(
    (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
  );

  const counts = {
    ALL: rawPending.length + rawBidding.length + rawPurchased.length + rawStockEntry.length,
    pending: rawPending.length,
    bidding: rawBidding.length,
    purchased: rawPurchased.length,
    stock_entry: rawStockEntry.length,
  };

  const activeLabelMap = {
    ALL: 'All',
    pending: 'Pending',
    bidding: 'Bidding',
    purchased: 'Purchased',
    stock_entry: 'Stock Entry',
  };

  const visible =
    activeCategory === 'ALL'
      ? allIndents
      : activeCategory === 'pending'
        ? pendingIndents
        : activeCategory === 'bidding'
          ? biddingIndents
          : activeCategory === 'purchased'
            ? purchasedIndents
            : stockEntryIndents;

  const activeLabel = activeLabelMap[activeCategory] || 'All';

  function getBadgeStyle(status) {
    if (status === 'BIDDING') return { backgroundColor: '#ff9800' };
    if (status === 'PURCHASED') return { backgroundColor: '#4caf50' };
    if (status === 'STOCK_ENTRY' || status === 'STOCKED') return { backgroundColor: '#2e7d32' };
    return undefined;
  }

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

      <div className="row" style={{ marginTop: 12 }}>
        <button className={activeCategory === 'ALL' ? 'chip active' : 'chip'} onClick={() => setActiveCategory('ALL')}>
          All ({counts.ALL || 0})
        </button>
        <button className={activeCategory === 'pending' ? 'chip active' : 'chip'} onClick={() => setActiveCategory('pending')}>
          Pending ({counts.pending || 0})
        </button>
        <button className={activeCategory === 'bidding' ? 'chip active' : 'chip'} onClick={() => setActiveCategory('bidding')}>
          Bidding ({counts.bidding || 0})
        </button>
        <button className={activeCategory === 'purchased' ? 'chip active' : 'chip'} onClick={() => setActiveCategory('purchased')}>
          Purchased ({counts.purchased || 0})
        </button>
        <button className={activeCategory === 'stock_entry' ? 'chip active' : 'chip'} onClick={() => setActiveCategory('stock_entry')}>
          Stock Entry ({counts.stock_entry || 0})
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {loading && Object.keys(categories).every((k) => !categories[k]?.length) ? (
        <div className="muted">Loading indents...</div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 12px 0' }}>
            {activeLabel} ({visible.length})
          </h3>
          <div className="list">
            {visible.length ? (
              visible.map((i) => (
                <div className="listItem" key={`${i._category || 'unknown'}-${i.id}`}>
                  <div
                    className="indentListClickable"
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
                    <div className="row">
                      <div>
                        <div className="title">Indent #{i.id}</div>
                        <div className="muted small">{i.purpose}</div>
                        <div className="muted small">Department: {i.department}</div>
                        {activeCategory === 'ALL' ? (
                          <div className="muted small">Category: {(i._category || '').toUpperCase()}</div>
                        ) : null}
                      </div>
                      <div className="right">
                        <div className="badge" style={getBadgeStyle(i.status)}>{i.status}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <div className="muted small">Items: {i.items?.length || 0}</div>
                      {i.items?.map((item) => (
                        <div key={item.id} className="muted small">
                          - {item.item?.name ?? item.item_name ?? 'Item'}: {item.quantity} {item.item?.unit ?? ''}
                        </div>
                      ))}
                    </div>
                  </div>

                  {i.status === 'PURCHASED' ? (
                    <div className="muted small" style={{ marginTop: 8 }}>
                      Delivery Confirmed: <b>{i.delivery_confirmed ? 'Yes' : 'No'}</b>
                    </div>
                  ) : null}

                  {(i._category === 'pending' || i._category === 'bidding' || i._category === 'purchased') ? (
                    <PSAdminActionBar
                      indent={i}
                      category={i._category}
                      onDone={() => setTick((t) => t + 1)}
                    />
                  ) : null}

                  {(i._category === 'stock_entry' || i.status === 'STOCK_ENTRY' || i.status === 'STOCKED') ? (
                    <div className="muted small" style={{ marginTop: 8, color: '#2e7d32' }}>
                      ✓ Stock entry completed
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="muted small">No indents for this category.</div>
            )}
          </div>
        </div>
      )}
      {detailId != null ? (
        <IndentDetailModal actingRole={actingRole} indentId={detailId} onClose={() => setDetailId(null)} />
      ) : null}
    </div>
  );
}
