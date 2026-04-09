import { createTileLayerComponent } from '@react-leaflet/core'
import L from 'leaflet'

const CustomTileLayerClass = L.TileLayer.extend({
  getTileUrl(coords) {
    console.log('Tile request:', coords);
    const x = coords.x;
    const y = coords.y;

    if (x < 0 || x >= 32 || y < 0 || y >= 32) {
      return '';
    }

    const idx = y * 32 + x;
    return `/tiles/z5/${idx}.jpg`;
  }
});

export const CustomTileLayer = createTileLayerComponent(
  (props, context) => {
    console.log('CustomTileLayer initializing with props:', props);
    return {
      instance: new CustomTileLayerClass(props.url || '', {
        ...props,
        errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      }),
      context
    };
  },
  (instance, props, prevProps) => {
    console.log('CustomTileLayer updating props');
    if (prevProps.url !== props.url) {
      instance.setUrl(props.url);
    }
  }
);
