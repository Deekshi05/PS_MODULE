import { useEffect, useState } from 'react';
import { readPSAdminCategories } from '../api';
import IndentDetailModal from './IndentDetailModal';
import PSAdminActionBar from './PSAdminActionBar';

const TRACKER_STEPS = {
  external: ['Submitted', 'HOD', 'Dept Admin', 'Director', 'Registrar', 'PS Admin', 'Purchased', 'Delivered', 'Stocked'],
  internal: ['Submitted', 'HOD', 'Dept Admin', 'Stock Issued'],
  rejection: ['Submitted', 'Rejected by HOD'],
  draft: ['Draft', 'Submitted', 'HOD', 'Dept Admin', 'Director', 'Registrar', 'PS Admin', 'Purchased', 'Delivered', 'Stocked'],
};

function statusLabel(indent) {
  if (!indent) return 'Unknown';
  if (indent.status === 'DRAFT') return 'Draft';
  if (indent.status === 'PURCHASED') return indent.delivery_confirmed ? 'Delivered' : 'Awaiting Delivery';
  if (indent.status === 'REJECTED') return 'Rejected';
  if (['STOCK_CHECKED', 'INTERNAL_ISSUED', 'STOCK_ENTRY', 'STOCKED'].includes(indent.status)) return 'Completed';
  if (['BIDDING', 'EXTERNAL_PROCUREMENT'].includes(indent.status)) return 'In Procurement';
  if (['SUBMITTED', 'UNDER_HOD_REVIEW', 'FORWARDED', 'FORWARDED_TO_DIRECTOR', 'APPROVED_BY_DEP_ADMIN', 'APPROVED'].includes(indent.status)) return 'In Approval';
  return indent.status;
}

function toneClass(indent) {
  if (!indent) return 'neutral';
  if (indent.status === 'DRAFT') return 'draft';
  if (['SUBMITTED', 'UNDER_HOD_REVIEW', 'FORWARDED', 'FORWARDED_TO_DIRECTOR', 'APPROVED_BY_DEP_ADMIN', 'APPROVED'].includes(indent.status)) return 'approval';
  if (['BIDDING', 'EXTERNAL_PROCUREMENT'].includes(indent.status)) return 'procurement';
  if (indent.status === 'PURCHASED') return indent.delivery_confirmed ? 'completed' : 'purchased';
  if (['STOCK_CHECKED', 'INTERNAL_ISSUED', 'STOCK_ENTRY', 'STOCKED'].includes(indent.status)) return 'completed';
  if (indent.status === 'REJECTED') return 'rejected';
  return 'neutral';
}

function getStagePath(indent) {
  if (indent?.status === 'REJECTED') return TRACKER_STEPS.rejection;
  if (['STOCK_CHECKED', 'INTERNAL_ISSUED', 'STOCK_ENTRY', 'STOCKED'].includes(indent?.status) || indent?.procurement_type === 'INTERNAL') {
    return TRACKER_STEPS.internal;
  }
  if (indent?.status === 'DRAFT') return TRACKER_STEPS.draft;
  return TRACKER_STEPS.external;
}

function getCurrentStageIndex(indent) {
  if (!indent) return 0;
  if (indent.status === 'DRAFT') return 0;
  if (indent.status === 'REJECTED') return 1;
  if (['STOCK_CHECKED', 'INTERNAL_ISSUED', 'STOCK_ENTRY', 'STOCKED'].includes(indent.status) || indent.procurement_type === 'INTERNAL') {
    if (indent.status === 'STOCKED' || indent.delivery_confirmed) return 3;
    if (indent.status === 'STOCK_CHECKED') return 2;
    return 2;
  }
  if (indent.status === 'PURCHASED') return indent.delivery_confirmed ? 7 : 6;
  if (indent.status === 'BIDDING' || indent.status === 'EXTERNAL_PROCUREMENT') return 5;
  if (indent.status === 'APPROVED') return 4;
  if (indent.status === 'APPROVED_BY_DEP_ADMIN' || indent.status === 'FORWARDED_TO_DIRECTOR') return 3;
  if (indent.status === 'FORWARDED') return 2;
  if (indent.status === 'UNDER_HOD_REVIEW' || indent.status === 'SUBMITTED') return 1;
  return 0;
}

function toCurrency(value) {
  if (value == null || value === '') return '—';
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return `₹${number.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function summarizeItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return { labelText: 'No items added', countText: '0 items' };
  }

  const labels = items
    .map((item) => item.item_name || item.item?.name || item.item_description || 'Item')
    .filter(Boolean);
  const unique = [...new Set(labels)];
  const preview = unique.slice(0, 2);
  const remaining = unique.length - preview.length;
  return {
    labelText: preview.length ? `${preview.join(', ')}${remaining > 0 ? ` +${remaining} more` : ''}` : 'No items added',
    countText: `${items.length} item${items.length === 1 ? '' : 's'}`,
  };
}

function StatusPill({ indent }) {
  return <span className={`badge badge-${toneClass(indent)}`}>{statusLabel(indent)}</span>;
}

function WorkflowTracker({ indent }) {
  const stages = getStagePath(indent);
  const current = getCurrentStageIndex(indent);

  return (
    <div className="workflowTracker" aria-label="Workflow progress">
      {stages.map((stage, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
        return (
          <div className={`workflowStage ${state}`} key={stage}>
            <span className="workflowDot" />
            <span>{stage}</span>
          </div>
        );
      })}
    </div>
  );
}

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

  return (
    <div className="roleDashboard">
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
          <div className="indentCards">
            {visible.length ? (
              visible.map((i) => (
                <article className={`indentCard indentCard-${toneClass(i)}`} key={`${i._category || 'unknown'}-${i.id}`}>
                  <button className="indentCardBody" type="button" aria-label={`Open indent ${i.id}`} onClick={() => setDetailId(i.id)}>
                    <div className="indentCardTop">
                      <div>
                        <div className="indentCardTitleRow">
                          <div className="indentCardTitle">Indent #{i.id}</div>
                          <StatusPill indent={i} />
                        </div>
                        <div className="muted small indentCardMeta">Ref: {i.public_reference_id || '—'} · Department: {i.department}</div>
                      </div>
                      <div className={`stockPill ${i.stock_available ? 'available' : 'missing'}`}>
                        {i.stock_available ? '📦 Stock: Available' : '📦 Stock: Not Available'}
                      </div>
                    </div>

                    <div className="indentCardSummary">
                      <div>
                        <div className="sectionLabel">Purpose</div>
                        <div className="sectionText">{i.purpose || 'No purpose provided'}</div>
                      </div>
                      <div>
                        <div className="sectionLabel">Items</div>
                        <div className="sectionText">{summarizeItems(i.items).labelText}</div>
                        <div className="muted small">{summarizeItems(i.items).countText}</div>
                      </div>
                      <div>
                        <div className="sectionLabel">Cost</div>
                        <div className="sectionText">{toCurrency(i.grand_total ?? i.estimated_cost)}</div>
                      </div>
                    </div>

                    <WorkflowTracker indent={i} />
                  </button>

                  <div className="indentCardFooter">
                    <div className="muted small">Delivery Confirmed: <b>{i.delivery_confirmed ? 'Yes' : 'No'}</b></div>
                    {(i._category === 'stock_entry' || i.status === 'STOCK_ENTRY' || i.status === 'STOCKED') ? (
                      <div className="muted small" style={{ color: '#166534' }}>✓ Stock entry completed</div>
                    ) : null}
                  </div>

                  {(i._category === 'pending' || i._category === 'bidding' || i._category === 'purchased') ? (
                    <div style={{ padding: '0 16px 16px' }}>
                      <PSAdminActionBar indent={i} category={i._category} onDone={() => setTick((t) => t + 1)} />
                    </div>
                  ) : null}
                </article>
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
