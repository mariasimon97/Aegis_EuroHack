import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface HeatmapLayerProps {
  points: [number, number, number][]; // [lat, lng, intensity]
}

export default function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    // Type assertion to bypass TypeScript error for leaflet.heat plugin
    const heatLayer = (L as any).heatLayer(points, {
      radius: 35,
      blur: 25,
      maxZoom: 15,
      gradient: {
        0.2: '#3b82f6', // blue
        0.4: '#06b6d4', // cyan
        0.6: '#10b981', // emerald
        0.8: '#f59e0b', // amber
        1.0: '#ef4444'  // red
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}
