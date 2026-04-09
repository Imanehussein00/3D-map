import { useState } from 'react'
import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'
import ZoomControls from './components/ZoomControls'
import MapArea from './components/MapArea'

function App() {
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState(null)
  
  // Use a map instance ref to zoom/pan programmatically later if needed
  const [mapInstance, setMapInstance] = useState(null)

  const handlePropertySelect = (property) => {
    setSelectedProperty(property)
    setRightOpen(true)
  }

  const handleMapClick = () => {
    // Deselect if clicked on empty map space
    setRightOpen(false)
    setSelectedProperty(null)
  }

  const zoomIn = () => mapInstance && mapInstance.setZoom(mapInstance.getZoom() + 0.5, { animate: true })
  const zoomOut = () => mapInstance && mapInstance.setZoom(mapInstance.getZoom() - 0.5, { animate: true })
  const fitMap = () => {
    if (mapInstance) {
      // 8192 x 4096 is our max bounds
      mapInstance.fitBounds([[0, 0], [4096, 8192]])
    }
  }

  return (
    <>
      <div className="brand-logo">
        <img src="/src/assets/logo.png" alt="Amarnex Logo" />
      </div>

      <MapArea 
        setMapInstance={setMapInstance}
        onMapClick={handleMapClick}
        onPropertySelect={handlePropertySelect}
        selectedPropertyId={selectedProperty?.id}
      />

      <LeftPanel 
        isOpen={leftOpen} 
        onClose={() => setLeftOpen(false)} 
      />

      <RightPanel 
        isOpen={rightOpen} 
        onClose={() => setRightOpen(false)} 
        property={selectedProperty}
      />

      <ZoomControls 
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitMap={fitMap}
        onFilterToggle={() => setLeftOpen(!leftOpen)}
      />
    </>
  )
}

export default App
