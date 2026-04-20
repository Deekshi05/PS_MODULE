import RoleSelector from '../RoleSelector';
import Icon from './Icon';

export default function Navbar({ title, actingRole, allowedRoles, onSetRole, onLogout }) {
  return (
    <header className="dashboardNavbar">
      <div className="navbarBrand">{title}</div>
      <div className="navbarActions">
        <div className="navbarRole">
          <RoleSelector role={actingRole} setRole={onSetRole} allowedRoles={allowedRoles} />
        </div>
        <button type="button" className="iconButton" aria-label="Notifications">
          <Icon name="bell" />
          <span className="notificationDot" />
        </button>
        <div className="avatarWrapper">
          <button type="button" className="avatarButton" aria-label="Profile">
            <Icon name="user" />
          </button>
          <div className="avatarName">Profile</div>
        </div>
        <button type="button" className="logoutButton" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
