import { useEffect, useMemo, useState } from 'react';
import {
  readIndent,
  writeCreateIndent,
  writeDeleteIndentDraft,
  writeSubmitIndentDraft,
  writeUpdateIndentDraft,
} from '../api';
import './IndentForm.css';

const DEPARTMENTS = [
  'Computer Science',
  'Electronics',
  'Mechanical',
  'Civil',
  'Chemistry',
  'Physics',
  'Administration',
];

const URGENCY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

const URGENCY_TO_API = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
  Critical: 'CRITICAL',
};

const API_TO_URGENCY_LEVEL = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
const STATUS_OPTIONS = ['Draft', 'Submitted', 'Approved', 'Rejected'];
const CATEGORY_OPTIONS = ['IT', 'Lab', 'Furniture', 'Office Supplies', 'Maintenance', 'Other'];

const ROLE_LABELS = {
  EMPLOYEE: 'Employee',
  DEPADMIN: 'Department Head',
  HOD: 'Department Head',
  REGISTRAR: 'Registrar',
  DIRECTOR: 'Director',
  PS_ADMIN: 'PS Admin',
};

const NEXT_HOLDER = {
  EMPLOYEE: 'Department Head',
  DEPADMIN: 'Registrar',
  HOD: 'Registrar',
  REGISTRAR: 'Director',
  DIRECTOR: 'PS Admin',
  PS_ADMIN: 'Director',
};

function makeAutoIndentId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = Math.floor(Math.random() * 900 + 100);
  return `IND-${y}${m}${d}-${seq}`;
}

function makeInitialItems() {
  return [{ itemName: '', itemDescription: '', quantity: '1', estimatedPrice: '', category: 'IT' }];
}

function makeInitialContacts() {
  return [{ label: 'Primary Contact', value: '' }];
}

function readFileAsBase64Doc(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read file'));
        return;
      }
      const comma = result.indexOf(',');
      const data = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({ filename: file.name, data });
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function mapFormItemsToApi(items) {
  return items
    .filter((item) => (item.itemName || '').trim())
    .map((item) => {
      const qty = Number(item.quantity);
      const q = Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 1;
      const priceRaw = item.estimatedPrice;
      const unitPrice =
        priceRaw !== '' && priceRaw != null && !Number.isNaN(Number(priceRaw)) ? Number(priceRaw) : null;
      return {
        item_name: item.itemName.trim(),
        item_description: (item.itemDescription || '').trim(),
        quantity: q,
        unit_price: unitPrice,
        category: item.category || '',
      };
    });
}

function mapContactsToApi(contactDetails) {
  return contactDetails
    .filter((c) => c.value.trim())
    .map((c) => ({
      label: c.label || 'Contact',
      primary_contact: c.value.trim(),
      phone_or_email: c.value.trim(),
    }));
}

function mapApiContactsToForm(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return makeInitialContacts();
  }
  return contacts.map((c, idx) => {
    if (typeof c === 'object' && c != null) {
      return {
        label: c.label || `Contact ${idx + 1}`,
        value: String(c.primary_contact || c.phone_or_email || c.value || '').trim(),
      };
    }
    return { label: `Contact ${idx + 1}`, value: String(c || '') };
  });
}

function mapApiItemsToForm(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return makeInitialItems();
  }
  return items.map((line) => {
    const cat = (line.category || '').trim();
    const category = CATEGORY_OPTIONS.includes(cat) ? cat : 'Other';
    return {
      itemName: (line.item_name || line.item?.name || '').trim(),
      itemDescription: (line.item_description || '').trim(),
      quantity: String(line.quantity ?? 1),
      estimatedPrice:
        line.unit_price != null && line.unit_price !== '' ? String(line.unit_price) : '',
      category,
    };
  });
}

export default function IndentForm({
  actingRole,
  onCreated,
  onDraftSaved,
  onDraftDeleted,
  draftIndentIdToLoad,
  onDraftEditLoaded,
}) {
  const [indentId, setIndentId] = useState(makeAutoIndentId());
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10));
  const [department, setDepartment] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [designation, setDesignation] = useState('');
  const [contactDetails, setContactDetails] = useState(makeInitialContacts());

  const [items, setItems] = useState(makeInitialItems());

  const [purposeOfRequirement, setPurposeOfRequirement] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('Medium');
  const [expectedUsage, setExpectedUsage] = useState('');

  const [uploadedDocs, setUploadedDocs] = useState([]);

  const [status, setStatus] = useState('Draft');
  const [currentHolder, setCurrentHolder] = useState(NEXT_HOLDER[actingRole] || 'Department Head');

  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [backendIndentId, setBackendIndentId] = useState(null);
  const [publicReferenceId, setPublicReferenceId] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);

  const requestedByRole = ROLE_LABELS[actingRole] || actingRole || 'Employee';

  useEffect(() => {
    if (!draftIndentIdToLoad || actingRole !== 'EMPLOYEE') {
      return undefined;
    }
    let cancelled = false;
    setLoadingDraft(true);
    setError('');
    setOk('');

    readIndent({ actingRole, indentId: draftIndentIdToLoad })
      .then((data) => {
        if (cancelled) return;
        if (data.status !== 'DRAFT') {
          setError('This indent is not a draft and cannot be edited here.');
          onDraftEditLoaded?.();
          return;
        }
        const purposeText = (data.why_requirement_needed || data.purpose || '').trim();
        setPurposeOfRequirement(purposeText);
        setDesignation((data.designation || '').trim());
        if (data.date_of_request) {
          setRequestDate(String(data.date_of_request).slice(0, 10));
        }
        setUrgencyLevel(API_TO_URGENCY_LEVEL[data.urgency_level] || 'Medium');
        setExpectedUsage((data.expected_usage || '').trim());
        setContactDetails(mapApiContactsToForm(data.contacts));
        setItems(mapApiItemsToForm(data.items));
        setBackendIndentId(data.id);
        setPublicReferenceId(data.public_reference_id || '');
        setIndentId(data.public_reference_id || makeAutoIndentId());
        setUploadedDocs([]);
        setStatus('Draft');
        setCurrentHolder(ROLE_LABELS[actingRole] || 'Employee');
        const dn = (data.department_detail?.name || '').trim();
        setDepartment(DEPARTMENTS.includes(dn) ? dn : '');
        const un = data.requested_by?.username;
        setRequestedBy(un != null ? String(un) : '');
        setOk('Draft loaded for editing.');
        onDraftEditLoaded?.();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Could not load draft.');
          onDraftEditLoaded?.();
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDraft(false);
      });

    return () => {
      cancelled = true;
    };
  }, [draftIndentIdToLoad, actingRole, onDraftEditLoaded]);

  const itemsWithTotals = useMemo(() => {
    return items.map((item) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.estimatedPrice) || 0;
      return {
        ...item,
        totalPrice: qty * unitPrice,
      };
    });
  }, [items]);

  const grandTotal = useMemo(() => {
    return itemsWithTotals.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [itemsWithTotals]);

  function updateItem(idx, patch) {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function addItem() {
    setItems((prev) => [...prev, { itemName: '', itemDescription: '', quantity: '1', estimatedPrice: '', category: 'IT' }]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateContact(idx, patch) {
    setContactDetails((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function addContact() {
    setContactDetails((prev) => [...prev, { label: `Contact ${prev.length + 1}`, value: '' }]);
  }

  function removeContact(idx) {
    setContactDetails((prev) => prev.filter((_, i) => i !== idx));
  }

  function onUploadDocuments(e) {
    const files = Array.from(e.target.files || []);
    setUploadedDocs(files);
  }

  function validateForm() {
    if (!designation.trim()) {
      return 'Designation is required.';
    }
    if (!purposeOfRequirement.trim()) {
      return 'Purpose of Requirement is required.';
    }

    const hasAnyContact = contactDetails.some((contact) => contact.value.trim());
    if (!hasAnyContact) {
      return 'At least one contact detail is required.';
    }

    const validItems = items.filter((item) => item.itemName.trim());
    if (!validItems.length) {
      return 'At least one item with Item Name is required.';
    }

    for (const item of validItems) {
      if (!item.quantity || Number(item.quantity) <= 0) {
        return 'Each item must have a Quantity greater than 0.';
      }
      if (!item.estimatedPrice || Number(item.estimatedPrice) < 0) {
        return 'Each item must have a valid Estimated Price.';
      }
    }

    return '';
  }

  function resetForm() {
    setIndentId(makeAutoIndentId());
    setRequestDate(new Date().toISOString().slice(0, 10));
    setDepartment('');
    setRequestedBy('');
    setDesignation('');
    setContactDetails(makeInitialContacts());
    setItems(makeInitialItems());
    setPurposeOfRequirement('');
    setUrgencyLevel('Medium');
    setExpectedUsage('');
    setUploadedDocs([]);
    setStatus('Draft');
    setCurrentHolder(NEXT_HOLDER[actingRole] || 'Department Head');
    setBackendIndentId(null);
    setPublicReferenceId('');
    setError('');
    setOk('Form has been reset.');
    try {
      localStorage.removeItem('indent_form_draft');
    } catch {
      /* ignore */
    }
  }

  async function deleteServerDraft() {
    if (backendIndentId == null || actingRole !== 'EMPLOYEE') {
      return;
    }
    if (!window.confirm('Delete this draft permanently? This cannot be undone.')) {
      return;
    }
    setDeletingDraft(true);
    setError('');
    setOk('');
    try {
      await writeDeleteIndentDraft({ actingRole, indentId: backendIndentId });
      onDraftDeleted?.();
      resetForm();
      setOk('Draft deleted.');
    } catch (err) {
      setError(err?.message || 'Could not delete draft.');
    } finally {
      setDeletingDraft(false);
    }
  }

  async function saveDraft() {
    setError('');
    setOk('');
    if (actingRole !== 'EMPLOYEE') {
      setError('Only employees can save drafts to the server.');
      return;
    }

    const purposeText = (purposeOfRequirement || '').trim();
    const itemsPayload = mapFormItemsToApi(items);
    const documents =
      uploadedDocs.length > 0 ? await Promise.all(uploadedDocs.map((f) => readFileAsBase64Doc(f))) : null;

    const basePayload = {
      purpose: purposeText.slice(0, 255),
      why_requirement_needed: purposeText,
      designation: (designation || '').trim(),
      date_of_request: requestDate || null,
      urgency_level: URGENCY_TO_API[urgencyLevel] || 'MEDIUM',
      expected_usage: (expectedUsage || '').trim(),
      estimated_cost: grandTotal > 0 ? Number(grandTotal.toFixed(2)) : null,
      items: itemsPayload,
      contacts: mapContactsToApi(contactDetails),
    };

    const wasUpdate = backendIndentId != null;
    setSavingDraft(true);
    try {
      let data;
      if (wasUpdate) {
        const patchPayload = { ...basePayload };
        if (documents) patchPayload.documents = documents;
        data = await writeUpdateIndentDraft({ actingRole, indentId: backendIndentId, payload: patchPayload });
      } else {
        data = await writeCreateIndent({
          actingRole,
          payload: {
            ...basePayload,
            as_draft: true,
            documents: documents || [],
          },
        });
      }
      setBackendIndentId(data.id);
      setPublicReferenceId(data.public_reference_id || '');
      setStatus('Draft');
      setCurrentHolder(ROLE_LABELS[actingRole] || 'Employee');
      setOk(wasUpdate ? 'Draft updated on server.' : 'Draft saved on server.');
      onDraftSaved?.();
    } catch (err) {
      setError(err?.message || 'Could not save draft.');
    } finally {
      setSavingDraft(false);
    }
  }

  async function submitIndent(e) {
    e.preventDefault();
    setError('');
    setOk('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const validItems = items.filter((item) => item.itemName.trim());
    const purposeText = purposeOfRequirement.trim();
    const documents =
      uploadedDocs.length > 0 ? await Promise.all(uploadedDocs.map((f) => readFileAsBase64Doc(f))) : [];

    const itemsPayload = validItems.map((item) => ({
      item_name: item.itemName.trim(),
      item_description: (item.itemDescription || '').trim(),
      quantity: Number(item.quantity),
      unit_price:
        item.estimatedPrice !== '' && item.estimatedPrice != null
          ? Number(item.estimatedPrice)
          : null,
      category: item.category || '',
    }));

    const sharedPayload = {
      purpose: purposeText.slice(0, 255),
      why_requirement_needed: purposeText,
      designation: designation.trim(),
      date_of_request: requestDate || null,
      urgency_level: URGENCY_TO_API[urgencyLevel] || 'MEDIUM',
      expected_usage: expectedUsage.trim(),
      estimated_cost: grandTotal > 0 ? Number(grandTotal.toFixed(2)) : null,
      items: itemsPayload,
      contacts: mapContactsToApi(contactDetails),
    };

    setSubmitting(true);
    try {
      if (backendIndentId != null) {
        const patchPayload = { ...sharedPayload };
        if (documents) patchPayload.documents = documents;
        await writeUpdateIndentDraft({ actingRole, indentId: backendIndentId, payload: patchPayload });
        await writeSubmitIndentDraft({ actingRole, indentId: backendIndentId });
      } else {
        await writeCreateIndent({
          actingRole,
          payload: { ...sharedPayload, as_draft: false, documents: documents || [] },
        });
      }
      setStatus('Submitted');
      setCurrentHolder(NEXT_HOLDER[actingRole] || 'Department Head');
      setOk('Indent submitted successfully.');
      setBackendIndentId(null);
      setPublicReferenceId('');
      onCreated?.();
    } catch (err) {
      setError(err?.message || 'Submit failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h2>Create Indent</h2>
      {loadingDraft ? <div className="muted" style={{ marginBottom: 12 }}>Loading draft…</div> : null}
      <form onSubmit={submitIndent} className="form">
        <div className="subhead">A. Basic Information (Auto + Editable)</div>

        <div className="indentGrid indentGridTwo">
          <label>
            {publicReferenceId || backendIndentId != null ? 'Reference (server)' : 'Indent ID (local)'}
            <input value={publicReferenceId || indentId} readOnly />
          </label>

          <label>
            Date of Request (auto)
            <input type="date" value={requestDate} readOnly />
          </label>

          <label>
            Department (auto or dropdown)
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Select</option>
              {DEPARTMENTS.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </label>

          <label>
            Requested By (logged-in user)
            <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} />
          </label>

          <label>
            Designation
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g., Assistant Professor" />
          </label>
        </div>
        {backendIndentId != null ? (
          <div className="muted small" style={{ marginTop: 8 }}>
            Draft #{backendIndentId} — use Save Draft to update the server copy, or Submit when ready.
          </div>
        ) : null}

        <div className="subhead">Contact Details (Dynamic)</div>
        <div className="table">
          <div className="thead indentContactsHead">
            <div>Label</div>
            <div>Contact Details</div>
            <div />
          </div>
          {contactDetails.map((contact, idx) => (
            <div className="trow indentContactsRow" key={idx}>
              <div>
                <input value={contact.label} onChange={(e) => updateContact(idx, { label: e.target.value })} placeholder="Label" />
              </div>
              <div>
                <input
                  value={contact.value}
                  onChange={(e) => updateContact(idx, { value: e.target.value })}
                  placeholder="Phone / Email"
                />
              </div>
              <div>
                <button type="button" className="btn ghost" onClick={() => removeContact(idx)} disabled={contactDetails.length <= 1}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="row">
            <button type="button" className="btn ghost" onClick={addContact}>
              Add Contact
            </button>
          </div>
        </div>

        <div className="subhead">B. Item Details (Dynamic Multiple Items)</div>
        <div className="table">
          <div className="thead indentItemsHead">
            <div>Item Name</div>
            <div>Item Description</div>
            <div>Quantity</div>
            <div>Estimated Price (per unit)</div>
            <div>Category</div>
            <div />
          </div>

          {itemsWithTotals.map((item, idx) => (
            <div className="trow indentItemsRow" key={idx}>
              <div>
                <input
                  value={item.itemName}
                  onChange={(e) => updateItem(idx, { itemName: e.target.value })}
                  placeholder="Item Name"
                />
              </div>
              <div>
                <input
                  value={item.itemDescription}
                  onChange={(e) => updateItem(idx, { itemDescription: e.target.value })}
                  placeholder="Description"
                />
              </div>
              <div>
                <input
                  className="indentQtyInput"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                  inputMode="numeric"
                  min="1"
                  placeholder="Qty"
                />
              </div>
              <div>
                <input
                  className="indentPriceInput"
                  value={item.estimatedPrice}
                  onChange={(e) => updateItem(idx, { estimatedPrice: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div>
                <select value={item.category} onChange={(e) => updateItem(idx, { category: e.target.value })}>
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button type="button" className="btn ghost" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="row">
            <button type="button" className="btn ghost" onClick={addItem}>
              Add Item
            </button>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <div className="muted">
              Grand Total: <b>{grandTotal.toFixed(2)}</b>
            </div>
          </div>
        </div>

        <div className="subhead">C. Justification / Purpose</div>
        <label>
          Purpose of Requirement
          <textarea
            value={purposeOfRequirement}
            onChange={(e) => setPurposeOfRequirement(e.target.value)}
            rows={3}
            placeholder="Why this requirement is needed"
          />
        </label>

        <div className="indentGrid indentGridTwo">
          <label>
            Urgency Level
            <select value={urgencyLevel} onChange={(e) => setUrgencyLevel(e.target.value)}>
              {URGENCY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label>
            Expected Usage
            <input
              value={expectedUsage}
              onChange={(e) => setExpectedUsage(e.target.value)}
              placeholder="How and where the items will be used"
            />
          </label>
        </div>

        <div className="subhead">Upload Documents (PDF, Image)</div>
        <label>
          Supporting Documents
          <input type="file" accept=".pdf,image/*" multiple onChange={onUploadDocuments} />
        </label>
        {uploadedDocs.length ? (
          <div className="muted small">Uploaded: {uploadedDocs.map((doc) => doc.name).join(', ')}</div>
        ) : (
          <div className="muted small">No documents selected.</div>
        )}

        <div className="row">
          <button type="button" className="btn ghost" onClick={saveDraft} disabled={loadingDraft || savingDraft || submitting || deletingDraft}>
            {savingDraft ? 'Saving draft…' : 'Save Draft'}
          </button>
          {backendIndentId != null && actingRole === 'EMPLOYEE' ? (
            <button
              type="button"
              className="btn danger"
              onClick={deleteServerDraft}
              disabled={loadingDraft || savingDraft || submitting || deletingDraft}
            >
              {deletingDraft ? 'Deleting…' : 'Delete draft'}
            </button>
          ) : null}
          <button type="submit" className="btn" disabled={loadingDraft || submitting || deletingDraft}>
            {submitting ? 'Submitting…' : 'Submit (Send)'}
          </button>
          <button type="button" className="btn danger" onClick={resetForm} disabled={loadingDraft || submitting || savingDraft || deletingDraft}>
            Reset
          </button>
        </div>

        {ok ? <div className="ok">{ok}</div> : null}
        {error ? <div className="error">{error}</div> : null}
      </form>
    </div>
  );
}

