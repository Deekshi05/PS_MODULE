import { useMemo, useState } from 'react';
import { writeCreateIndent } from '../api';
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

const URGENCY_LEVELS = ['Low', 'Medium', 'High'];

const URGENCY_TO_API = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
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

export default function IndentForm({ actingRole, onCreated }) {
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

  const requestedByRole = ROLE_LABELS[actingRole] || actingRole || 'Employee';

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
    setError('');
    setOk('Form has been reset.');
  }

  function saveDraft() {
    setError('');
    setStatus('Draft');
    setCurrentHolder(ROLE_LABELS[actingRole] || 'Employee');

    const draft = {
      indentId,
      requestDate,
      department,
      requestedBy,
      designation,
      contactDetails,
      items,
      purposeOfRequirement,
      urgencyLevel,
      expectedUsage,
      status: 'Draft',
      currentHolder: ROLE_LABELS[actingRole] || 'Employee',
      uploadedDocs: uploadedDocs.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    };

    localStorage.setItem('indent_form_draft', JSON.stringify(draft));
    setOk('Draft saved on frontend. Backend integration can be connected later.');
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

    const payload = {
      purpose: purposeText.slice(0, 255),
      why_requirement_needed: purposeText,
      designation: designation.trim(),
      date_of_request: requestDate || null,
      urgency_level: URGENCY_TO_API[urgencyLevel] || 'MEDIUM',
      expected_usage: expectedUsage.trim(),
      estimated_cost: grandTotal > 0 ? Number(grandTotal.toFixed(2)) : null,
      as_draft: false,
      items: validItems.map((item) => ({
        item_name: item.itemName.trim(),
        item_description: (item.itemDescription || '').trim(),
        quantity: Number(item.quantity),
        unit_price:
          item.estimatedPrice !== '' && item.estimatedPrice != null
            ? Number(item.estimatedPrice)
            : null,
        category: item.category || '',
      })),
      contacts: contactDetails
        .filter((c) => c.value.trim())
        .map((c) => ({
          label: c.label || 'Contact',
          primary_contact: c.value.trim(),
          phone_or_email: c.value.trim(),
        })),
      documents,
    };

    setSubmitting(true);
    try {
      await writeCreateIndent({ actingRole, payload });
      setStatus('Submitted');
      setCurrentHolder(NEXT_HOLDER[actingRole] || 'Department Head');
      setOk('Indent submitted successfully.');
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
      <form onSubmit={submitIndent} className="form">
        <div className="subhead">A. Basic Information (Auto + Editable)</div>

        <div className="indentGrid indentGridTwo">
          <label>
            Indent ID (auto-generated)
            <input value={indentId} readOnly />
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
          <button type="button" className="btn ghost" onClick={saveDraft}>
            Save Draft
          </button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit (Send)'}
          </button>
          <button type="button" className="btn danger" onClick={resetForm}>
            Reset
          </button>
        </div>

        {ok ? <div className="ok">{ok}</div> : null}
        {error ? <div className="error">{error}</div> : null}
      </form>
    </div>
  );
}

