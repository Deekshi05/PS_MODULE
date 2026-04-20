import { useEffect, useState } from 'react';
import { readDecisions, readIndents, readProcurementReady } from '../api';
import HodActionBar from './HodActionBar';
import IndentDetailModal from './IndentDetailModal';

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
  if (indent.status === 'INTERNAL_ISSUED') return 'Stock Issued';
  if (indent.status === 'REJECTED') return 'Rejected';
  if (['STOCK_CHECKED', 'STOCK_ENTRY', 'STOCKED'].includes(indent.status)) return 'Completed';
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
    if (indent.status === 'STOCKED' || indent.status === 'INTERNAL_ISSUED' || indent.delivery_confirmed) return 3;
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

export default function HodDashboard({ actingRole, refreshKey }) {
  const [indents, setIndents] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (tab === 'DECIDED') {
          const data = await readDecisions({ actingRole });
          if (!cancelled) setDecisions(data);
        } else if (tab === 'PROCUREMENT') {
          const data = await readProcurementReady({ actingRole });
          if (!cancelled) setIndents(data);
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
  const showProcurementTab = actingRole === 'DEPADMIN' || actingRole === 'PS_ADMIN';
  const title = tab === 'DECIDED' ? 'My decisions' : tab === 'PROCUREMENT' ? 'Procurement ready' : 'Approval queue';

  return (
    <div className="roleDashboard">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="row">
          <button className={tab === 'PENDING' ? 'chip active' : 'chip'} type="button" onClick={() => setTab('PENDING')}>
            Pending
          </button>
          {showProcurementTab ? (
            <button
              className={tab === 'PROCUREMENT' ? 'chip active' : 'chip'}
              type="button"
              onClick={() => setTab('PROCUREMENT')}
            >
              Procurement Ready
            </button>
          ) : null}
          <button className={tab === 'DECIDED' ? 'chip active' : 'chip'} type="button" onClick={() => setTab('DECIDED')}>
            Approved/Rejected
          </button>
        </div>
      </div>

      {actingRole === 'DEPADMIN' || actingRole === 'PS_ADMIN' ? (
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

      <div className="indentCards">
        {filtered.map((i) => (
          <article className={`indentCard indentCard-${toneClass(i)}`} key={i.id}>
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
              <div className="muted small">Type: <b>{i.procurement_type || '—'}</b> · Current stage: <b>{statusLabel(i)}</b></div>
              <div className="muted small">Delivery Confirmed: <b>{i.delivery_confirmed ? 'Yes' : 'No'}</b></div>
            </div>

            {tab !== 'DECIDED' ? (
              <div style={{ padding: '0 16px 16px' }}>
                <HodActionBar actingRole={actingRole} indent={i} mode={tab} onDone={() => setTick((t) => t + 1)} />
              </div>
            ) : null}
          </article>
        ))}
        {!filtered.length && !error ? (
          <div className="muted">
            {tab === 'DECIDED'
              ? 'No approved/rejected indents yet.'
              : tab === 'PROCUREMENT'
                ? 'No procurement-ready indents.'
                : 'No indents assigned to you.'}
          </div>
        ) : null}
      </div>
      {detailId != null ? (
        <IndentDetailModal actingRole={actingRole} indentId={detailId} onClose={() => setDetailId(null)} />
      ) : null}
    </div>
  );
}

