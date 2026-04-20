import { useEffect, useMemo, useState } from 'react';
import { readIndents, writeConfirmDelivery, writeDeleteIndentDraft } from '../api';
import IndentDetailModal from './IndentDetailModal';

const STATUS_GROUPS = [
  { key: 'ALL', label: 'All', matches: () => true, tone: 'neutral' },
  { key: 'DRAFT', label: 'Draft', matches: (indent) => indent.status === 'DRAFT', tone: 'draft' },
  {
    key: 'IN_APPROVAL',
    label: 'In Approval',
    matches: (indent) => ['SUBMITTED', 'UNDER_HOD_REVIEW', 'FORWARDED', 'FORWARDED_TO_DIRECTOR', 'APPROVED_BY_DEP_ADMIN', 'APPROVED'].includes(indent.status),
    tone: 'approval',
  },
  {
    key: 'IN_PROCUREMENT',
    label: 'In Procurement',
    matches: (indent) => ['BIDDING', 'EXTERNAL_PROCUREMENT'].includes(indent.status),
    tone: 'procurement',
  },
  { key: 'PURCHASED', label: 'Purchased', matches: (indent) => indent.status === 'PURCHASED', tone: 'purchased' },
  {
    key: 'COMPLETED',
    label: 'Completed',
    matches: (indent) => ['STOCK_ENTRY', 'STOCKED'].includes(indent.status),
    tone: 'completed',
  },
  { key: 'REJECTED', label: 'Rejected', matches: (indent) => indent.status === 'REJECTED', tone: 'rejected' },
];

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
  if (indent.status === 'STOCK_CHECKED') return 'Stock Checked';
  if (indent.status === 'INTERNAL_ISSUED') return 'Stock Issued';
  if (indent.status === 'REJECTED') return 'Rejected';
  if (['STOCK_ENTRY', 'STOCKED'].includes(indent.status)) return 'Completed';
  if (['BIDDING', 'EXTERNAL_PROCUREMENT'].includes(indent.status)) return 'In Procurement';
  if (['SUBMITTED', 'UNDER_HOD_REVIEW', 'FORWARDED', 'FORWARDED_TO_DIRECTOR', 'APPROVED_BY_DEP_ADMIN', 'APPROVED'].includes(indent.status)) return 'In Approval';
  return indent.status;
}

function toneClass(indent) {
  if (!indent) return 'neutral';
  if (indent.status === 'DRAFT') return 'draft';
  if (['SUBMITTED', 'UNDER_HOD_REVIEW', 'FORWARDED', 'FORWARDED_TO_DIRECTOR', 'APPROVED_BY_DEP_ADMIN', 'APPROVED'].includes(indent.status)) return 'approval';
  if (['BIDDING', 'EXTERNAL_PROCUREMENT'].includes(indent.status)) return 'procurement';
  if (indent.status === 'PURCHASED') return 'purchased';
  if (indent.status === 'STOCK_CHECKED') return 'procurement';
  if (indent.status === 'INTERNAL_ISSUED') return 'completed';
  if (['STOCK_ENTRY', 'STOCKED'].includes(indent.status)) return 'completed';
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

function getStatusTone(indent) {
  return toneClass(indent);
}

function StatusPill({ indent }) {
  return <span className={`badge badge-${getStatusTone(indent)}`}>{statusLabel(indent)}</span>;
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

export default function EmployeeDashboard({ actingRole, refreshKey, onEditDraft, onDraftDeleted }) {
  const [indents, setIndents] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [actionError, setActionError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
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
        const groups = STATUS_GROUPS.filter((group) => group.key !== 'ALL' && group.matches(i)).map((group) => group.key);
        groups.forEach((groupKey) => {
          acc[groupKey] = (acc[groupKey] || 0) + 1;
        });
        acc[i.status] = (acc[i.status] || 0) + 1;
        return acc;
      },
      { ALL: 0 }
    );
  }, [indents]);

  const visible = useMemo(() => {
    if (filter === 'ALL') return indents;
    const group = STATUS_GROUPS.find((item) => item.key === filter);
    if (!group) return indents;
    return indents.filter((indent) => group.matches(indent));
  }, [filter, indents]);

  const filterMeta = STATUS_GROUPS.map((group) => ({
    ...group,
    value: counts[group.key] || 0,
  }));

  async function handleDeleteDraft(indentId) {
    if (!window.confirm('Delete this draft permanently? This cannot be undone.')) {
      return;
    }
    setActionError('');
    setDeleteLoadingId(indentId);
    try {
      await writeDeleteIndentDraft({ actingRole, indentId });
      const data = await readIndents({ actingRole });
      setIndents(data);
      setDetailId((current) => (current === indentId ? null : current));
      onDraftDeleted?.();
    } catch (err) {
      setActionError(err.message || 'Failed to delete draft');
    } finally {
      setDeleteLoadingId(null);
    }
  }

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
    <div className="employeeDashboard">
      <div className="dashboardTabs" role="tablist" aria-label="Indent filters">
        {filterMeta.map((group) => (
          <button key={group.key} className={filter === group.key ? 'chip active' : 'chip'} onClick={() => setFilter(group.key)} type="button">
            {group.label} ({group.value || 0})
          </button>
        ))}
      </div>

      {error ? <div className="error">{error}</div> : null}
      {actionError ? <div className="error">{actionError}</div> : null}
      <div className="indentCards">
        {visible.map((i) => (
          <article className={`indentCard indentCard-${toneClass(i)}`} key={i.id}>
            <button className="indentCardBody" type="button" aria-label={`Open indent ${i.id}`} onClick={() => setDetailId(i.id)}>
              <div className="indentCardTop">
                <div>
                  <div className="indentCardTitleRow">
                    <div className="indentCardTitle">Indent #{i.id}</div>
                    <StatusPill indent={i} />
                  </div>
                  <div className="muted small indentCardMeta">Ref: {i.public_reference_id || '—'} · {i.department_detail?.name || i.department || 'Department'}</div>
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

              <div className="indentCardFooter">
                <div className="muted small">Current stage: <b>{statusLabel(i)}</b></div>
              </div>
            </button>

            <div className="indentCardActions">
              <button type="button" className="btn" onClick={() => setDetailId(i.id)}>
                👁 View
              </button>
              {i.status === 'DRAFT' && onEditDraft ? (
                <>
                  <button type="button" className="btn ghost" onClick={() => onEditDraft(i.id)}>
                    🧾 Edit
                  </button>
                  <button type="button" className="btn danger" disabled={deleteLoadingId === i.id} onClick={() => handleDeleteDraft(i.id)}>
                    {deleteLoadingId === i.id ? 'Deleting…' : '🗑 Delete'}
                  </button>
                </>
              ) : null}
              {i.status === 'PURCHASED' ? (
                <button className="btn success" disabled={actionLoadingId === i.id} onClick={() => handleConfirmDelivery(i.id)} type="button">
                  {actionLoadingId === i.id ? 'Processing…' : '📦 Confirm Delivery'}
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!visible.length && !error ? <div className="muted">No indents for this filter.</div> : null}
      </div>
      {detailId != null ? (
        <IndentDetailModal
          actingRole={actingRole}
          indentId={detailId}
          onClose={() => setDetailId(null)}
          onEditDraft={
            onEditDraft
              ? (id) => {
                  setDetailId(null);
                  onEditDraft(id);
                }
              : undefined
          }
          onDeleteDraft={detailId != null ? () => handleDeleteDraft(detailId) : undefined}
        />
      ) : null}
    </div>
  );
}

