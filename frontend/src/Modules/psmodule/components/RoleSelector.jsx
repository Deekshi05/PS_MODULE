const LABELS = {
  EMPLOYEE: 'EMPLOYEE',
  DEPADMIN: 'DEPADMIN',
  PS_ADMIN: 'PS ADMIN',
  HOD: 'DEPADMIN / HOD',
  REGISTRAR: 'REGISTRAR',
  DIRECTOR: 'DIRECTOR',
};

export default function RoleSelector({ role, setRole, allowedRoles }) {
  const roles = (allowedRoles && allowedRoles.length ? allowedRoles : ['EMPLOYEE']).filter(Boolean);
  return (
    <div className="row">
      <div className="pill">
        <span className="muted">Acting role</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {LABELS[r] || r}
            </option>
          ))}
        </select>
      </div>
      <div className="muted small">
        Sent as <code>X-Acting-Role</code> header (RBAC enforced server-side).
      </div>
    </div>
  );
}

