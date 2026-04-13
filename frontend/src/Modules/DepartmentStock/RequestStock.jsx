import { useEffect, useMemo, useState } from 'react';
import {
  createTransferRequest,
  fetchAvailableStockList,
  getDepartmentFromRole,
} from './departmentStockApi';

export default function RequestStock({ actingRole, userRole }) {
  const [stocks, setStocks] = useState([]);
  const [stockId, setStockId] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState(1);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const department = getDepartmentFromRole(userRole);
  const isDepadmin = actingRole === 'DEPADMIN';

  useEffect(() => {
    let active = true;
    fetchAvailableStockList()
      .then((data) => {
        if (!active) return;
        setStocks(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Unable to load available stock list.');
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedStock = useMemo(
    () => stocks.find((item) => String(item.id) === String(stockId)),
    [stockId, stocks]
  );

  const selectedStockName = selectedStock?.stock_name || '';
  const maxRequestable = selectedStock?.quantity ?? 1;

  useEffect(() => {
    if (selectedStock?.department) {
      setTargetDepartment(selectedStock.department.replace('dep_', 'depadmin_'));
    } else {
      setTargetDepartment('');
    }
  }, [selectedStock]);

  if (!isDepadmin) {
    return <div className="error">Access denied. DepAdmin role required.</div>;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatusMessage('');
    setError('');
    if (!stockId) {
      setError('Please choose a stock item.');
      return;
    }
    if (!targetDepartment) {
      setError('Please choose a stock item to populate the source depadmin role.');
      return;
    }
    if (!requestedQuantity || requestedQuantity < 1) {
      setError('Please enter a requested quantity of at least 1.');
      return;
    }
    if (requestedQuantity > maxRequestable) {
      setError(`Requested quantity cannot exceed available quantity of ${maxRequestable}.`);
      return;
    }

    setLoading(true);
    try {
      await createTransferRequest(stockId, targetDepartment, requestedQuantity);
      setStatusMessage(`Transfer request created for ${selectedStockName || 'selected stock'} (${requestedQuantity}).`);
      setStockId('');
      setTargetDepartment('');
      setRequestedQuantity(1);
    } catch (err) {
      setError(err.message || 'Could not create transfer request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="pageHead">
        <div>
          <div className="breadcrumb">Department Stock &nbsp;›&nbsp; Request Stock</div>
        </div>
        <div className="badge">From: {department || 'Unknown'}</div>
      </div>

      <div className="panel">
        <div className="panelBody">
          {error ? <div className="error">{error}</div> : null}
          {statusMessage ? <div className="ok">{statusMessage}</div> : null}
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Requesting department
              <input value={department} disabled />
            </label>
            <label>
              Stock item
              <select value={stockId} onChange={(event) => setStockId(event.target.value)}>
                <option value="">Select stock item</option>
                {stocks.map((stock) => (
                  <option key={stock.id} value={stock.id}>
                    {stock.stock_name} ({stock.department})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Requested from (depadmin role)
              <input value={targetDepartment} disabled />
            </label>
            <label>
              Quantity
              <input
                type="number"
                min="1"
                max={maxRequestable}
                value={requestedQuantity}
                onChange={(event) => setRequestedQuantity(Number(event.target.value))}
              />
            </label>
            {selectedStock ? (
              <div className="muted small">Available quantity for this stock: {selectedStock.quantity ?? 0}</div>
            ) : null}
            <div className="row">
              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Sending request…' : 'Submit transfer request'}
              </button>
              <div className="muted small">Target department is for UI only; final routing is enforced by the backend depadmin role.</div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
