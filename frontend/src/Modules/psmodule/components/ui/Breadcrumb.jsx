export default function Breadcrumb({ items }) {
  return (
    <nav className="dashboardBreadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item}> 
          <span className="breadcrumbSegment">{item}</span>
          {index < items.length - 1 ? <span className="breadcrumbDivider">›</span> : null}
        </span>
      ))}
    </nav>
  );
}
