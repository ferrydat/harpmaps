// Haversine formula to calculate distance between two lat/lon points in Nautical Miles
export function calculateDistanceNM(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Radius of the Earth in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculates pixels per nautical mile given visual bounds and pixel width
export function calculateScale(bounds, pixelWidth) {
  if (!bounds) return 0;
  
  // Bounds format is generally [[southLat, westLon], [northLat, eastLon]] or Leaflet LatLngBounds
  // Leaflet returns bounds with getWest() and getEast()
  const west = bounds.getWest();
  const east = bounds.getEast();
  
  // To avoid distortion, we'll calculate the distance across the middle of the map
  const midLat = (bounds.getNorth() + bounds.getSouth()) / 2;
  
  const widthInNM = calculateDistanceNM(midLat, west, midLat, east);
  
  if (widthInNM === 0) return 0;
  return pixelWidth / widthInNM;
}
