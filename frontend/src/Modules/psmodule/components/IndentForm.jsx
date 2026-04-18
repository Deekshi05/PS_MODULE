import { useState } from 'react';
import { writeCreateIndent } from '../api';

export default function IndentForm({ actingRole, onCreated }) {
  const [purpose, setPurpose] = useState('');
  const [justification, setJustification] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [items, setItems] = useState([{ item_id: '', quantity: 1, estimated_cost: '' }]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  function updateLine(idx, patch) {
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setItems((prev) => [...prev, { item_id: '', quantity: 1, estimated_cost: '' }]);
  }

  function removeLine(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setOk('');
    setLoading(true);
    try {
      // Client-side validation
      if (!purpose.trim()) {
        throw new Error('Purpose is required');
      }
      
      const validItems = items.filter((l) => l.item_id.trim() !== '');
      if (validItems.length === 0) {
        throw new Error('At least one item with a valid item ID is required');
      }
      
      for (const item of validItems) {
        if (!item.quantity || Number(item.quantity) < 1) {
          throw new Error('All items must have a quantity of at least 1');
        }
      }

      const payload = {
        purpose,
        justification,
        estimated_cost: estimatedCost ? Number(estimatedCost) : null,
        items: validItems.map((l) => ({
          item_id: Number(l.item_id),
          quantity: Number(l.quantity),
          estimated_cost: l.estimated_cost ? Number(l.estimated_cost) : null,
        })),
      };

      const created = await writeCreateIndent({ actingRole, payload });
      setOk(`Indent submitted (ID ${created.id}).`);
      onCreated?.();
      setPurpose('');
      setJustification('');
      setEstimatedCost('');
      setItems([{ item_id: '', quantity: 1, estimated_cost: '' }]);
    } catch (err) {
      setError(err.message || 'Submit failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Create indent</h2>
      <form onSubmit={submit} className="form">
        <label>
          Purpose <span style={{ color: 'red' }}>*</span>
          <input 
            value={purpose} 
            onChange={(e) => setPurpose(e.target.value)} 
            placeholder="e.g., Lab consumables"
            required
          />
        </label>

        <label>
          Justification
          <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} />
        </label>

        <label>
          Estimated total cost (optional)
          <input value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} inputMode="decimal" />
        </label>

        <div className="subhead">Items <span style={{ color: 'red' }}>*</span></div>
        <div className="table">
          <div className="thead">
            <div>Item ID</div>
            <div>Qty</div>
            <div>Est. cost</div>
            <div />
          </div>
          {items.map((line, idx) => (
            <div className="trow" key={idx}>
              <div>
                <input
                  value={line.item_id}
                  onChange={(e) => updateLine(idx, { item_id: e.target.value })}
                  placeholder="e.g., 1"
                  inputMode="numeric"
                />
              </div>
              <div>
                <input
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                  inputMode="numeric"
                />
              </div>
              <div>
                <input
                  value={line.estimated_cost}
                  onChange={(e) => updateLine(idx, { estimated_cost: e.target.value })}
                  inputMode="decimal"
                />
              </div>
              <div>
                <button type="button" className="btn ghost" onClick={() => removeLine(idx)} disabled={items.length <= 1}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="row">
          <button type="button" className="btn ghost" onClick={addLine}>
            Add item
          </button>
          <div className="spacer" />
          <button className="btn" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit indent'}
          </button>
        </div>

        {ok ? <div className="ok">{ok}</div> : null}
        {error ? <div className="error">{error}</div> : null}
      </form>
    </div>
  );
}

