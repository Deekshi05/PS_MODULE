import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import RoleSelector from './RoleSelector';
import EmployeeDashboard from './EmployeeDashboard';
import HodDashboard from './HodDashboard';
import PSAdminDashboard from './PSAdminDashboard';
import IndentForm from './IndentForm';

function Icon({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' };
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path
            d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'list':
      return (
        <svg {...common}>
          <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M3.5 6h.5M3.5 12h.5M3.5 18h.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path
            d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M10.5 19a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function IndentWorkflowPage({ actingRole, allowedRoles, onSetRole, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const isEmployee = useMemo(() => actingRole === 'EMPLOYEE', [actingRole]);
  const isPSAdmin = useMemo(() => actingRole === 'PS_ADMIN', [actingRole]);
  const isDepadmin = useMemo(() => actingRole === 'DEPADMIN', [actingRole]);
  const pageTitle = tab === 'create' ? 'Create Indent' : isEmployee ? 'My Indents' : isPSAdmin ? 'Procurement Management' : 'Approval Queue';

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="sbLogo" title="Purchase & Store">
          PS
        </div>
        <button
          className={tab === 'dashboard' ? 'sbBtn active' : 'sbBtn'}
          onClick={() => setTab('dashboard')}
          title="Dashboard"
          type="button"
        >
          <Icon name="list" />
        </button>
        <button
          className={tab === 'create' ? 'sbBtn active' : 'sbBtn'}
          onClick={() => setTab('create')}
          title="Create indent"
          type="button"
        >
          <Icon name="plus" />
        </button>
        <div style={{ flex: '1 1 auto' }} />
        <button
          className="sbBtn"
          title="Notifications"
          type="button"
          onClick={() => setTab('dashboard')}
        >
          <Icon name="bell" />
        </button>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="title">FUSION - Purchase & Store</div>
          <div className="topRight">
            {isDepadmin ? (
              <Link className="btn" to="/depadmin/stock">
                DepAdmin Stock
              </Link>
            ) : null}
            <RoleSelector role={actingRole} setRole={onSetRole} allowedRoles={allowedRoles} />
            <a className="link small" href="/workflow-reference.png" target="_blank" rel="noreferrer">
              Workflow reference
            </a>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                onLogout?.();
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="content">
          <div className="pageHead">
            <div>
              <div className="breadcrumb">Home &nbsp;›&nbsp; {pageTitle}</div>
            </div>
            <div className="segTabs" role="tablist" aria-label="Page tabs">
              <button
                type="button"
                className={tab === 'dashboard' ? 'segBtn active' : 'segBtn'}
                onClick={() => setTab('dashboard')}
              >
                Dashboard
              </button>
              <button
                type="button"
                className={tab === 'create' ? 'segBtn active' : 'segBtn'}
                onClick={() => setTab('create')}
              >
                Create Indent
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panelBody">
              {tab === 'create' ? (
                <IndentForm
                  actingRole={actingRole}
                  onCreated={() => {
                    setRefreshKey((k) => k + 1);
                    setTab('dashboard');
                  }}
                />
              ) : isEmployee ? (
                <EmployeeDashboard actingRole={actingRole} refreshKey={refreshKey} />
              ) : isPSAdmin ? (
                <PSAdminDashboard actingRole={actingRole} refreshKey={refreshKey} />
              ) : (
                <HodDashboard actingRole={actingRole} refreshKey={refreshKey} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

