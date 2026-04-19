import { useEffect, useState } from 'react';
import { readIndent } from '../api';
import './IndentDetailModal.css';

const TRACKERS = {
  external: ['Submitted', 'HOD', 'Dept Admin', 'Director', 'Registrar', 'PS Admin', 'Purchased', 'Delivered', 'Stocked'],
  internal: ['Submitted', 'HOD', 'Dept Admin', 'Stock Issued'],
  rejected: ['Submitted', 'Rejected by HOD'],
  draft: ['Draft', 'Submitted', 'HOD', 'Dept Admin', 'Director', 'Registrar', 'PS Admin', 'Purchased', 'Delivered', 'Stocked'],
};

function statusTone(data) {
  if (!data) return 'neutral';
  if (data.status === 'DRAFT') return 'draft';
  if (data.status === 'REJECTED') return 'rejected';
  if (data.status === 'PURCHASED') return data.delivery_confirmed ? 'completed' : 'purchased';
  if (['STOCK_CHECKED', 'INTERNAL_ISSUED', 'STOCK_ENTRY', 'STOCKED'].includes(data.status)) return 'completed';
  if (['BIDDING', 'EXTERNAL_PROCUREMENT'].includes(data.status)) return 'procurement';
  if (['SUBMITTED', 'UNDER_HOD_REVIEW', 'FORWARDED', 'FORWARDED_TO_DIRECTOR', 'APPROVED_BY_DEP_ADMIN', 'APPROVED'].includes(data.status)) return 'approval';
  return 'neutral';
}

function humanStatus(data) {
  if (!data) return 'Unknown';
  if (data.status === 'DRAFT') return 'Draft';
  if (data.status === 'PURCHASED') return data.delivery_confirmed ? 'Delivered' : 'Awaiting Delivery';
  if (data.status === 'REJECTED') return 'Rejected';
  if (['STOCK_CHECKED', 'INTERNAL_ISSUED', 'STOCK_ENTRY', 'STOCKED'].includes(data.status)) return 'Completed';
  if (['BIDDING', 'EXTERNAL_PROCUREMENT'].includes(data.status)) return 'In Procurement';
  if (['SUBMITTED', 'UNDER_HOD_REVIEW', 'FORWARDED', 'FORWARDED_TO_DIRECTOR', 'APPROVED_BY_DEP_ADMIN', 'APPROVED'].includes(data.status)) return 'In Approval';
  return data.status;
}

function workflowSteps(data) {
  if (!data) return TRACKERS.external;
  if (data.status === 'DRAFT') return TRACKERS.draft;
  if (data.status === 'REJECTED') return TRACKERS.rejected;
  if (data.procurement_type === 'INTERNAL' || ['STOCK_CHECKED', 'INTERNAL_ISSUED', 'STOCK_ENTRY', 'STOCKED'].includes(data.status)) {
    return TRACKERS.internal;
  }
  return TRACKERS.external;
}

function currentStageIndex(data) {
  if (!data) return 0;
  if (data.status === 'DRAFT') return 0;
  if (data.status === 'REJECTED') return 1;
  if (data.procurement_type === 'INTERNAL' || ['STOCK_CHECKED', 'INTERNAL_ISSUED', 'STOCK_ENTRY', 'STOCKED'].includes(data.status)) {
    if (data.status === 'STOCKED' || data.status === 'INTERNAL_ISSUED') return 3;
    if (data.status === 'STOCK_CHECKED') return 2;
    return 2;
  }
  if (data.status === 'PURCHASED') return data.delivery_confirmed ? 7 : 6;
  if (data.status === 'BIDDING' || data.status === 'EXTERNAL_PROCUREMENT') return 5;
  if (data.status === 'APPROVED') return 4;
  if (data.status === 'APPROVED_BY_DEP_ADMIN' || data.status === 'FORWARDED_TO_DIRECTOR') return 3;
  if (data.status === 'FORWARDED') return 2;
  if (data.status === 'UNDER_HOD_REVIEW' || data.status === 'SUBMITTED') return 1;
  return 0;
}

function Timeline({ data }) {
  const steps = workflowSteps(data);
  const current = currentStageIndex(data);

  return (
    <div className="timelineBlock">
      <div className="timelineHead">
        <h4>Workflow timeline</h4>
        <span className={`badge badge-${statusTone(data)}`}>{humanStatus(data)}</span>
      </div>
      <div className="timelineList">
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
          return (
            <div className={`timelineItem ${state}`} key={step}>
              <span className="timelineDot" />
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function summarizeItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return { names: 'No items added', count: '0 items' };
  }
  const names = items
    .map((item) => item.item_name || item.item?.name || item.item_description || 'Item')
    .filter(Boolean);
  const unique = [...new Set(names)];
  const preview = unique.slice(0, 3).join(', ');
  const extra = unique.length > 3 ? ` +${unique.length - 3} more` : '';
  return { names: `${preview}${extra}`, count: `${items.length} item${items.length === 1 ? '' : 's'}` };
}

function formatWhen(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

function formatUrgency(code) {
  if (!code) return '—';
  const map = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };
  return map[code] || code;
}

function DetailDl({ rows }) {
  return (
    <dl className="indentDetailGrid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value === '' || value == null ? '—' : value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function IndentDetailModal({ actingRole, indentId, onClose, onEditDraft, onDeleteDraft }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!indentId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    readIndent({ actingRole, indentId })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load indent.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actingRole, indentId]);

  useEffect(() => {
    if (!indentId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [indentId, onClose]);

  if (!indentId) return null;

  const deptName = data?.department_detail?.name ?? data?.department_detail?.code ?? data?.department;
  const requester =
    data?.requested_by?.username ??
    (data?.requested_by?.employee_id != null ? `Employee #${data.requested_by.employee_id}` : null);
  const itemSummary = summarizeItems(data?.items);

  return (
    <div className="indentDetailOverlay" role="presentation" onClick={onClose}>
      <div className="indentDetailPanel" role="dialog" aria-modal="true" aria-labelledby="indent-detail-title" onClick={(e) => e.stopPropagation()}>
        <div className="indentDetailHead">
          <div>
            <h3 id="indent-detail-title">Indent #{indentId}</h3>
            <div className="indentDetailMeta">{data?.public_reference_id || '—'} · {data?.purpose || 'No purpose provided'}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {!loading && !error && data?.status === 'DRAFT' && onEditDraft ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onEditDraft(indentId);
                  onClose();
                }}
              >
                Edit draft
              </button>
            ) : null}
            {!loading && !error && data?.status === 'DRAFT' && onDeleteDraft ? (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  void onDeleteDraft();
                }}
              >
                Delete draft
              </button>
            ) : null}
            <button type="button" className="btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {loading ? <div className="muted">Loading…</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {!loading && !error && data ? (
          <>
            <div className="indentDetailHero">
              <div>
                <div className="sectionLabel">Status</div>
                <div className="heroValue">{humanStatus(data)}</div>
              </div>
              <div>
                <div className="sectionLabel">Items</div>
                <div className="heroValue">{itemSummary.names}</div>
                <div className="muted small">{itemSummary.count}</div>
              </div>
              <div>
                <div className="sectionLabel">Cost</div>
                <div className="heroValue">{data.grand_total != null ? `₹${Number(data.grand_total).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}</div>
              </div>
            </div>

            <Timeline data={data} />

            <DetailDl
              rows={[
                ['Status', humanStatus(data)],
                ['Reference', data.public_reference_id],
                ['Current approver', data.current_approver != null ? `#${data.current_approver}` : '—'],
                ['Purpose', data.purpose],
                ['Department', deptName],
                ['Requested by', requester],
                ['Designation', data.designation],
                ['Date of request', data.date_of_request],
                ['Urgency', formatUrgency(data.urgency_level)],
                ['Procurement type', data.procurement_type],
                ['Stock available', data.stock_available ? 'Yes' : 'No'],
                ['Delivery confirmed', data.delivery_confirmed ? 'Yes' : 'No'],
                ['Grand total', data.grand_total != null ? data.grand_total : '—'],
                ['Estimated cost', data.estimated_cost != null ? String(data.estimated_cost) : '—'],
                ['Created', formatWhen(data.created_at)],
                ['Updated', formatWhen(data.updated_at)],
              ]}
            />

            {data.justification ? (
              <div className="indentDetailSection">
                <h4>Justification</h4>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{data.justification}</div>
              </div>
            ) : null}

            {data.why_requirement_needed ? (
              <div className="indentDetailSection">
                <h4>Why this requirement</h4>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{data.why_requirement_needed}</div>
              </div>
            ) : null}

            {data.expected_usage ? (
              <div className="indentDetailSection">
                <h4>Expected usage</h4>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{data.expected_usage}</div>
              </div>
            ) : null}

            {Array.isArray(data.contacts) && data.contacts.length > 0 ? (
              <div className="indentDetailSection">
                <h4>Contacts</h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.9rem' }}>
                  {data.contacts.map((c, idx) => (
                    <li key={idx}>
                      {typeof c === 'object' && c !== null
                        ? [c.label, c.primary_contact || c.phone_or_email, c.value].filter(Boolean).join(' · ') ||
                          JSON.stringify(c)
                        : String(c)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="indentDetailSection">
              <h4>Line items</h4>
              {data.items?.length ? (
                <table className="indentDetailTable">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit price</th>
                      <th>Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((line) => (
                      <tr key={line.id}>
                        <td>{line.item_name || line.item?.name || '—'}</td>
                        <td>{line.item_description || '—'}</td>
                        <td>{line.quantity}</td>
                        <td>{line.unit_price != null ? line.unit_price : '—'}</td>
                        <td>{line.line_total ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="muted small">No line items.</div>
              )}
            </div>

            {Array.isArray(data.documents) && data.documents.length > 0 ? (
              <div className="indentDetailSection">
                <h4>Documents</h4>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.9rem' }}>
                  {data.documents.map((doc) => (
                    <li key={doc.id}>
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          {doc.original_filename || 'Download'}
                        </a>
                      ) : (
                        doc.original_filename || 'Attachment'
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
