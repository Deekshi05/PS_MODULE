import { useState } from 'react';
import { writePSAdminAction } from '../api';

export default function PSAdminActionBar({ indent, category, onDone }) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isInternalApproved =
    category === 'pending' &&
    indent.status === 'APPROVED' &&
    indent.procurement_type === 'INTERNAL';

  const canBidding = category === 'pending' && indent.status === 'APPROVED' && !isInternalApproved;

  const canPurchase = category === 'bidding' && indent.status === 'BIDDING';
  const canDirectPurchase =
    category === 'pending' && indent.status === 'APPROVED' && !isInternalApproved;
  const canInternalAllocate = isInternalApproved;
  const canStockEntry = category === 'purchased' && indent.status === 'PURCHASED' && indent.delivery_confirmed;

  async function doAction(action) {
    setError('');
    setLoading(true);
    try {
      const payload = { action, notes };
      await writePSAdminAction({ 
        actingRole: 'PS_ADMIN', 
        indentId: indent.id, 
        payload 
      });
      setNotes('');
      onDone?.();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="actionBar">
      <input 
        value={notes} 
        onChange={(e) => setNotes(e.target.value)} 
        placeholder="Notes (optional)" 
      />

      {error ? <div className="error" style={{ marginBottom: 10 }}>{error}</div> : null}

      <div className="row">
        {canInternalAllocate ? (
          <button
            className="btn success"
            disabled={loading}
            onClick={() => doAction('INTERNAL_ALLOCATE')}
          >
            {loading ? 'Processing...' : 'Allocate from warehouse'}
          </button>
        ) : null}

        {canBidding ? (
          <button 
            className="btn" 
            disabled={loading} 
            onClick={() => doAction('BIDDING')}
          >
            {loading ? 'Processing...' : 'Start Bidding'}
          </button>
        ) : null}

        {canDirectPurchase ? (
          <button 
            className="btn" 
            disabled={loading} 
            onClick={() => doAction('PURCHASE')}
          >
            {loading ? 'Processing...' : 'Direct Procurement'}
          </button>
        ) : null}
        
        {canPurchase ? (
          <button 
            className="btn success" 
            disabled={loading} 
            onClick={() => doAction('PURCHASE')}
          >
            {loading ? 'Processing...' : 'Mark as Purchased'}
          </button>
        ) : null}

        {canStockEntry ? (
          <button 
            className="btn success" 
            disabled={loading} 
            onClick={() => doAction('STOCK_ENTRY')}
          >
            {loading ? 'Processing...' : 'Stock Entry'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
