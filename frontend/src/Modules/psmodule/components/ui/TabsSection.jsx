import Icon from './Icon';

export default function TabsSection({ tabs, activeTab, onChange }) {
  const currentIndex = tabs.findIndex((tab) => tab.key === activeTab);
  const prevIndex = Math.max(0, currentIndex - 1);
  const nextIndex = Math.min(tabs.length - 1, currentIndex + 1);

  return (
    <div className="dashboardTabsRow">
      <button type="button" className="tabArrow" onClick={() => onChange?.(tabs[prevIndex]?.key)} aria-label="Previous">
        <Icon name="chevron-left" />
      </button>
      <div className="dashboardTabs">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const isDisabled = tab.disabled === true;
          return (
            <button
              key={tab.key}
              type="button"
              className={`dashboardTab${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`}
              onClick={() => {
                if (!isDisabled) onChange?.(tab.key);
              }}
              disabled={isDisabled}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <button type="button" className="tabArrow" onClick={() => onChange?.(tabs[nextIndex]?.key)} aria-label="Next">
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}
