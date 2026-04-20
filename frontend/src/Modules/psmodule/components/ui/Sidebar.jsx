import Icon from './Icon';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'create', label: 'Create Indent', icon: 'plus' },
];

const footerItems = [
  { icon: 'grid', label: 'Overview' },
  { icon: 'calendar', label: 'Calendar' },
  { icon: 'chart', label: 'Reports' },
];

export default function Sidebar({ activeKey, onSelect }) {
  return (
    <aside className="dashboardSidebar">
      <div className="dashboardLogo" title="Fusion ERP">
        F
      </div>
      <div className="sidebarNav">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.key === activeKey ? 'sidebarButton active' : 'sidebarButton'}
            onClick={() => onSelect?.(item.key)}
            aria-label={item.label}
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
      <div className="sidebarFooter">
        {footerItems.map((item) => (
          <button key={item.label} type="button" className="sidebarButton" aria-label={item.label}>
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
    </aside>
  );
}
