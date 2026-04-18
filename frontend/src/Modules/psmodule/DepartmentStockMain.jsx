import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import StockDashboard from './components/StockDashboard';
import RequestStock from './components/RequestStock';
import RequestsManagement from './components/RequestsManagement';
import { fetchMe, getUserRole } from './api';

const navItems = [
  { path: '/depadmin/stock', label: 'Stock Dashboard' },
  { path: '/depadmin/request', label: 'Request Stock' },
  { path: '/depadmin/requests', label: 'Manage Requests' },
];

export default function DepartmentStockMain({ actingRole }) {
  const [me, setMe] = useState(null);
  const [department, setDepartment] = useState('Unknown');
  const [actualUserRole, setActualUserRole] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const userRole = getUserRole();
  const isDepadmin = actualUserRole || actingRole === 'DEPADMIN';

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const data = await fetchMe();
        if (!active) return;
        setMe(data);
        const deptCode = data?.department?.code;
        if (Array.isArray(data?.allowed_roles) && data.allowed_roles.includes('DEPADMIN') && typeof deptCode === 'string') {
          const derivedRole = `depadmin_${deptCode.toLowerCase()}`;
          setActualUserRole(derivedRole);
          setDepartment(`dep_${deptCode.toLowerCase()}`);
        } else {
          setActualUserRole('');
          setDepartment('Unknown');
        }
      } catch (error) {
        if (!active) return;
        console.error('Unable to fetch depadmin profile', error);
        setActualUserRole('');
        setDepartment('Unknown');
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    }

    loadMe();
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return <div className="loading">Loading depadmin profile…</div>;
  }

  if (!isDepadmin) {
    return <Navigate to="/indent" replace />;
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="sbLogo" title="Department Stock">
          DS
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => (isActive ? 'sbBtn active' : 'sbBtn')}
          >
            {item.label[0]}
          </NavLink>
        ))}
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="title">DepAdmin Stock Transfer</div>
          <div className="topRight">
            <div className="pill">{userRole || actingRole}</div>
            <div className="pill">Department: {department || 'Unknown'}</div>
          </div>
        </div>

        <div className="content">
          <div className="pageHead">
            <div>
              <div className="breadcrumb">DepAdmin Stock Management</div>
            </div>
          </div>
          <div className="panel">
            <div className="panelBody">
              <Routes>
                <Route index element={<Navigate to="/depadmin/stock" replace />} />
                <Route path="stock" element={<StockDashboard actingRole={actingRole} userRole={actualUserRole} />} />
                <Route path="request" element={<RequestStock actingRole={actingRole} userRole={actualUserRole} />} />
                <Route path="requests" element={<RequestsManagement actingRole={actingRole} userRole={actualUserRole} />} />
                <Route path="*" element={<Navigate to="/depadmin/stock" replace />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
