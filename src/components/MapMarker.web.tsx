import React from 'react';
import { MapMarkerData } from '../types/map';

interface MapMarkerProps {
  data: MapMarkerData;
  onPress?: (id: string) => void;
}

// This is a placeholder for web compatibility
// The actual map functionality is only in the native version
export default function MapMarker(_props: MapMarkerProps) {
  // Return null since web uses list view instead of map
  return null;
}