import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmployeeDashboard from './EmployeeDashboard';
import HodDashboard from './HodDashboard';
import PSAdminDashboard from './PSAdminDashboard';
import IndentForm from './IndentForm';
import Sidebar from './ui/Sidebar';
import Navbar from './ui/Navbar';


export default function IndentWorkflowPage({ actingRole, allowedRoles, onSetRole, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [dashboardTab, setDashboardTab] = useState('notifications');
  const [sortBy, setSortBy] = useState('most_recent');
  const [refreshKey, setRefreshKey] = useState(0);
  const [draftIndentIdToLoad, setDraftIndentIdToLoad] = useState(null);

  const clearDraftIndentToLoad = useCallback(() => setDraftIndentIdToLoad(null), []);

  const isEmployee = useMemo(() => actingRole === 'EMPLOYEE', [actingRole]);
  const isPSAdmin = useMemo(() => actingRole === 'PS_ADMIN', [actingRole]);
  const isDepadmin = useMemo(() => actingRole === 'DEPADMIN', [actingRole]);
  const pageTitle = tab === 'create' ? 'Create Indent' : isEmployee ? 'Real Dashboard' : isPSAdmin ? 'Procurement Management' : 'Approval Queue';

  return (
    <div className="dashboardShell">
      <Sidebar activeKey={tab} onSelect={(next) => setTab(next)} />
      <div className="dashboardMain">
        <Navbar title="FUSION - IIITDMJ's ERP Portal" actingRole={actingRole} allowedRoles={allowedRoles} onSetRole={onSetRole} onLogout={onLogout} />

        <div className="dashboardBody">
          <div className="dashboardHeader">
            <div className="dashboardHeaderLeft">
              {isDepadmin ? (
                <Link className="adminLink" to="/depadmin/stock">
                  DepAdmin Stock
                </Link>
              ) : null}
            </div>

            <div className="dashboardHeaderRight" />
          </div>

          <div className="workspaceBody">
            {tab === 'create' ? (
              <IndentForm
                actingRole={actingRole}
                draftIndentIdToLoad={draftIndentIdToLoad}
                onDraftEditLoaded={clearDraftIndentToLoad}
                onCreated={() => {
                  setRefreshKey((k) => k + 1);
                  setTab('dashboard');
                }}
                onDraftSaved={() => setRefreshKey((k) => k + 1)}
                onDraftDeleted={() => setRefreshKey((k) => k + 1)}
              />
            ) : isEmployee ? (
              <EmployeeDashboard
                actingRole={actingRole}
                refreshKey={refreshKey}
                onDraftDeleted={() => setRefreshKey((k) => k + 1)}
                onEditDraft={(id) => {
                  setDraftIndentIdToLoad(id);
                  setTab('create');
                }}
              />
            ) : isPSAdmin ? (
              <PSAdminDashboard actingRole={actingRole} refreshKey={refreshKey} />
            ) : (
              <HodDashboard actingRole={actingRole} refreshKey={refreshKey} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

