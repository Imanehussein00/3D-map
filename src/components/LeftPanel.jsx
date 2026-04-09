export default function LeftPanel({ isOpen, onClose }) {
  return (
    <div className={`panel left-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <h2>Map Filters</h2>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
      <div className="panel-body">
        <div className="filter-group">
          <label>District Regions</label>
          <div className="filters-wrapper">
            <div className="filter-chip active">All Regions</div>
            <div className="filter-chip">Waterfront</div>
            <div className="filter-chip">Downtown</div>
            <div className="filter-chip">Suburban</div>
          </div>
        </div>
        <div className="filter-group">
          <label>Property Types</label>
          <div className="filters-wrapper">
            <div className="filter-chip active">Any</div>
            <div className="filter-chip">Villas</div>
            <div className="filter-chip">Apartments</div>
            <div className="filter-chip">Commercial</div>
          </div>
        </div>
        <div className="filter-group">
          <label>Availability</label>
          <div className="filters-wrapper">
            <div className="filter-chip active">Available now</div>
            <div className="filter-chip">Sold</div>
            <div className="filter-chip">Off-Plan</div>
          </div>
        </div>
      </div>
    </div>
  )
}
