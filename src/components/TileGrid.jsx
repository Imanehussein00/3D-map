import { memo, useState, useEffect, useCallback } from 'react'
import { LayerGroup, ImageOverlay, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const TileGrid = memo(() => {
  const [visibleTiles, setVisibleTiles] = useState([]);
  const map = useMapEvents({
    moveend: () => updateVisibleTiles(),
    zoomend: () => updateVisibleTiles(),
  });

  const updateVisibleTiles = useCallback(() => {
    const bounds = map.getBounds();
    const t = [];
    const COLS = 32;
    const ROWS = 32;
    const TILE_W = 256;
    const TILE_H = 128;
    const bleed = 1.0;

    // Buffer visible area slightly
    const buffer = 256;
    const visMinLat = bounds.getSouth() - buffer;
    const visMaxLat = bounds.getNorth() + buffer;
    const visMinLng = bounds.getWest() - buffer;
    const visMaxLng = bounds.getEast() + buffer;

    for (let r = 0; r < ROWS; r++) {
      const lat1 = -(r + 1) * TILE_H;
      const lat2 = -r * TILE_H;
      
      // Check if row is vertically visible
      if (lat2 < visMinLat || lat1 > visMaxLat) continue;

      for (let c = 0; c < COLS; c++) {
        const lng1 = c * TILE_W;
        const lng2 = (c + 1) * TILE_W;

        // Check if tile is horizontally visible
        if (lng2 < visMinLng || lng1 > visMaxLng) continue;

        const idx = r * COLS + c;
        t.push({
          idx,
          bounds: [[lat1 - bleed, lng1 - bleed], [lat2 + bleed, lng2 + bleed]],
          url: `/tiles/z5/${idx}.jpg`
        });
      }
    }
    setVisibleTiles(t);
  }, [map]);

  // Initial load
  useEffect(() => {
    updateVisibleTiles();
  }, [updateVisibleTiles]);

  return (
    <LayerGroup>
      {visibleTiles.map(tile => (
        <ImageOverlay
          key={tile.idx}
          url={tile.url}
          bounds={tile.bounds}
          opacity={1}
          interactive={false}
          zIndex={1}
        />
      ))}
    </LayerGroup>
  );
});

export default TileGrid;
