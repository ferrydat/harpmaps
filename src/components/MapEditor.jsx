import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Component to dynamically fit bounds when zone changes
function BoundsUpdater({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { animate: false });
    }
  }, [bounds, map]);
  return null;
}

// Reports the real visible bounds back to the parent on every zoom/pan
function BoundsReporter({ onBoundsChange }) {
  const map = useMap();
  useEffect(() => {
    if (!onBoundsChange) return;
    // Report initial bounds once the map is ready
    const reportBounds = () => onBoundsChange(map.getBounds());
    map.whenReady(reportBounds);
    map.on('moveend', reportBounds);
    return () => {
      map.off('moveend', reportBounds);
    };
  }, [map, onBoundsChange]);
  return null;
}

export default function MapEditor({ bounds, mapRef, activeStyle, onBoundsChange }) {

  // We apply the CSS filter on the tile-layer container div,
  // NOT on the MapContainer. This way the filter is "inside" the
  // captured DOM tree and html-to-image can inline it.
  return (
    <div 
      className="w-full h-full relative" 
      style={{ backgroundColor: activeStyle.bg }}
      ref={mapRef}
    >
      <MapContainer 
        zoomControl={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Wrap TileLayer in a div that carries the filter */}
        <TileLayerFiltered activeStyle={activeStyle} />
        {bounds && <BoundsUpdater bounds={bounds} />}
        <BoundsReporter onBoundsChange={onBoundsChange} />
      </MapContainer>
    </div>
  );
}

// This component accesses the Leaflet map instance and applies
// the CSS filter directly to Leaflet's internal tile pane element.
// This ensures the filter is baked into the DOM tree that
// html-to-image will serialize.
function TileLayerFiltered({ activeStyle }) {
  const map = useMap();

  useEffect(() => {
    // Get the Leaflet tile pane and apply CSS filter directly to it
    const tilePane = map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = activeStyle.filter !== 'none' ? activeStyle.filter : '';
    }
  }, [activeStyle, map]);

  return (
    <TileLayer
      key={activeStyle.id}
      url={activeStyle.url}
      maxZoom={19}
      crossOrigin="anonymous"
    />
  );
}
