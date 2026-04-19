import { useEffect, useState } from 'react';
import { readIndent } from '../api';
import './IndentDetailModal.css';

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

  return (
    <div className="indentDetailOverlay" role="presentation" onClick={onClose}>
      <div className="indentDetailPanel" role="dialog" aria-modal="true" aria-labelledby="indent-detail-title" onClick={(e) => e.stopPropagation()}>
        <div className="indentDetailHead">
          <h3 id="indent-detail-title">Indent #{indentId}</h3>
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
            <DetailDl
              rows={[
                ['Status', data.status],
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
