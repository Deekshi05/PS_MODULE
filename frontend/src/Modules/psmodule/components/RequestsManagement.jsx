import { useEffect, useState } from 'react';
import {
  approveTransferRequest,
  fetchRequestList,
  getDepartmentFromRole,
  rejectTransferRequest,
} from '../api';

const statusClasses = {
  PENDING: 'badge warn',
  APPROVED: 'badge good',
  REJECTED: 'badge',
};

export default function RequestsManagement({ actingRole, userRole }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const department = getDepartmentFromRole(userRole);
  const isDepadmin = actingRole === 'DEPADMIN';
  const depadminRole = userRole;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetchRequestList()
      .then((data) => {
        if (!active) return;
        setRequests(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Unable to load requests.');
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

  async function handleApprove(id) {
    setError('');
    try {
      await approveTransferRequest(id);
      setRequests((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'APPROVED' } : item)));
    } catch (err) {
      setError(err.message || 'Approval failed.');
    }
  }

  async function handleReject(id) {
    setError('');
    try {
      await rejectTransferRequest(id);
      setRequests((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'REJECTED' } : item)));
    } catch (err) {
      setError(err.message || 'Rejection failed.');
    }
  }

  return (
    <div>
      <div className="pageHead">
        <div>
          <div className="breadcrumb">Department Stock &nbsp;›&nbsp; Manage Requests</div>
        </div>
        <div className="badge">Department: {department || 'Unknown'}</div>
      </div>

      <div className="panel">
        <div className="panelBody">
          {error ? <div className="error">{error}</div> : null}
          {loading ? (
            <div>Loading requests…</div>
          ) : requests.length === 0 ? (
            <div className="muted">No transfer requests available.</div>
          ) : (
            <div className="table">
              <div className="thead">
                <div>Stock</div>
                <div>Requested by</div>
                <div>Requested from</div>
                <div>Qty</div>
                <div>Status</div>
              </div>
              {requests.map((request) => {
                const canAct = request.requested_from === depadminRole && request.status === 'PENDING';
                return (
                  <div key={request.id} className="trow">
                    <div>{request.stock?.stock_name || 'Unknown'}</div>
                    <div>{request.requested_by || 'Unknown'}</div>
                    <div>{request.requested_from}</div>
                    <div>{request.requested_quantity || 1}</div>
                    <div>
                      <span className={statusClasses[request.status] || 'badge'}>{request.status}</span>
                      {canAct ? (
                        <div className="actionBar">
                          <button className="btn" type="button" onClick={() => handleApprove(request.id)}>
                            Approve
                          </button>
                          <button className="btn danger" type="button" onClick={() => handleReject(request.id)}>
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
