import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { clearTokens, getAccessToken, getMe } from './Modules/psmodule/api';
import Login from './Modules/psmodule/components/Login';
import GlobalRoutes from './routes/globalRoutes';

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

function App() {
  const [authed, setAuthed] = useState(Boolean(getAccessToken()));
  const [role, setRole] = useState(localStorage.getItem('acting_role') || 'EMPLOYEE');
  const [allowedRoles, setAllowedRoles] = useState(['EMPLOYEE']);

  const actingRole = useMemo(() => {
    const r = (role || 'EMPLOYEE').toUpperCase();
    if (['EMPLOYEE', 'DEPADMIN', 'PS_ADMIN', 'HOD', 'REGISTRAR', 'DIRECTOR'].includes(r)) return r;
    return 'EMPLOYEE';
  }, [role]);

  function onSetRole(r) {
    setRole(r);
    localStorage.setItem('acting_role', r);
  }

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        const roles = Array.isArray(me?.allowed_roles) && me.allowed_roles.length ? me.allowed_roles : ['EMPLOYEE'];
        setAllowedRoles(roles);
        if (!roles.includes(actingRole)) {
          onSetRole(roles[0]);
        }
      })
      .catch(() => {
        // If /me fails for any reason, keep a safe fallback.
        setAllowedRoles(['EMPLOYEE']);
        onSetRole('EMPLOYEE');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  if (!authed) {
    return (
      <div className="appShell">
        <aside className="sidebar">
          <div className="sbLogo">PS</div>
          <button className="sbBtn active" title="Home" type="button">
            <Icon name="home" />
          </button>
        </aside>
        <div className="main">
          <div className="topbar">
            <div className="title">Purchase & Store</div>
            <div className="topRight muted small">Indent workflow (RBAC + routing)</div>
          </div>
          <div className="content">
            <div className="pageHead">
              <div>
                <div className="breadcrumb">Home &nbsp;›&nbsp; Sign in</div>
              </div>
            </div>
            <div className="authCenter">
              <div className="authPanel">
                <Login onLoggedIn={() => setAuthed(true)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GlobalRoutes
      actingRole={actingRole}
      allowedRoles={allowedRoles}
      onSetRole={onSetRole}
      onLogout={() => {
        clearTokens();
        setAuthed(false);
      }}
    />
  );
}

export default App;
