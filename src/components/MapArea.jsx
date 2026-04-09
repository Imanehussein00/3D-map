import { useEffect } from 'react'
import { MapContainer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import TileGrid from './TileGrid'
import MasterPlanSVG from './MasterPlanSVG'

// Bounds: min bounds must be smaller than max bounds for Leaflet!
// [[minLat, minLng], [maxLat, maxLng]]
// [[-4096, 0], [0, 8192]] translates perfectly in CRS.Simple
const mapBounds = [[-4096, 0], [0, 8192]]

function MapInstanceAcquirer({ setMapInstance }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      setMapInstance(map);
    }
  }, [map, setMapInstance]);
  return null;
}

function MapEvents({ onClick }) {
  useMapEvents({
    click: () => {
      if (onClick) onClick();
    }
  });
  return null;
}

export default function MapArea({ setMapInstance, onMapClick, onPropertySelect, selectedPropertyId }) {
  return (
    <MapContainer 
      crs={L.CRS.Simple}
      bounds={mapBounds}
      maxBounds={mapBounds}
      center={[-2048, 4096]}
      zoom={-2.1}
      maxZoom={4}
      minZoom={-2.1}
      zoomSnap={0}
      zoomDelta={0.2}
      wheelDelta={0.15}
      wheelPxPerZoomLevel={60}
      style={{ width: '100vw', height: '100vh', background: '#0b0f19' }}
      zoomControl={false} // We have custom zoom controls
      attributionControl={false}
    >
      <MapInstanceAcquirer setMapInstance={setMapInstance} />
      <MapEvents onClick={onMapClick} />
      
      <TileGrid />

      <MasterPlanSVG 
        onPropertySelect={onPropertySelect}
        selectedPropertyId={selectedPropertyId}
      />
    </MapContainer>
  )
}
