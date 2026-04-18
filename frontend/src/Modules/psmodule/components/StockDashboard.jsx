import { useEffect, useState } from 'react';
import { fetchStockList, getDepartmentFromRole, getUserRole } from '../api';

export default function StockDashboard({ actingRole, userRole }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isDepadmin = actingRole === 'DEPADMIN';
  const department = getDepartmentFromRole(userRole);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetchStockList()
      .then((data) => {
        if (!active) return;
        setStocks(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Unable to load stock.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!isDepadmin) {
    return <div className="error">Access denied. DepAdmin role required.</div>;
  }

  return (
    <div>
      <div className="pageHead">
        <div>
          <div className="breadcrumb">Department Stock &nbsp;›&nbsp; Stock Dashboard</div>
        </div>
        <div className="badge">Department: {department || 'Unknown'}</div>
      </div>

      <div className="panel">
        <div className="panelBody">
          {error ? <div className="error">{error}</div> : null}
          {loading ? (
            <div>Loading stock…</div>
          ) : stocks.length === 0 ? (
            <div className="muted">No stock records found for your department.</div>
          ) : (
            <div className="table">
              <div className="thead">
                <div>Stock Name</div>
                <div>Department</div>
                <div>Quantity</div>
                <div className="subhead">ID</div>
                <div className="subhead">Status</div>
              </div>
              {stocks.map((stock) => (
                <div key={stock.id} className="trow">
                  <div>{stock.stock_name}</div>
                  <div>{stock.department}</div>
                  <div>{stock.quantity ?? 0}</div>
                  <div>{stock.id}</div>
                  <div>
                    <span className="badge good">Owned</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
