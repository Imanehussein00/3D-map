export default function RightPanel({ isOpen, onClose, property }) {
  const getGradient = () => {
    // Randomize hue to match old vanilla behavior or use property id
    const hue = property ? (property.price % 360) : 0;
    return `linear-gradient(135deg,hsl(${hue},55%,28%),hsl(${(hue + 50) % 360},40%,18%))`;
  }

  return (
    <div className={`panel right-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <h2>Property Profile</h2>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
      <div className="panel-body">
        {property?.type === '360° Panorama' ? (
          <div className="detail-image" style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)' }}>
            🔭
          </div>
        ) : (
          <div className="detail-image" style={{ background: getGradient() }}></div>
        )}
        
        <h3 className="detail-title">{property?.name || 'Select a Area'}</h3>
        <p className="detail-desc">
          {property?.desc || 'Premium property within the master plan. Modern layouts, premium finishes, and world-class amenities.'}
        </p>

        <div className="detail-stat">
          <span style={{color:'#94a3b8'}}>Plot Area</span>
          <span style={{color:'#fff', fontWeight:500}}>{property?.area || '—'}</span>
        </div>
        <div className="detail-stat">
          <span style={{color:'#94a3b8'}}>Floor Type</span>
          <span style={{color:'#fff', fontWeight:500}}>{property?.type || '—'}</span>
        </div>
        <div className="detail-stat">
          <span style={{color:'#94a3b8'}}>Starting Price</span>
          <span style={{color:'#38bdf8', fontWeight:600, fontSize:'1.05rem'}}>
            {property?.price || '—'}
          </span>
        </div>
        <button className="btn-primary">Register Interest</button>
      </div>
    </div>
  )
}
