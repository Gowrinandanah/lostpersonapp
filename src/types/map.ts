// src/types/map.ts

export interface MapMarkerData {
  id: string;
  name: string;
  age: number;
  gender: string;
  lastSeenLocation: string;
  latitude: number;
  longitude: number;
  isUrgent: boolean;
  status: string;
}

/** A sighting pin shown on the map */
export interface SightingMarker {
  id: string;
  caseId: string;
  caseName: string;          // denormalised for callout display
  sightingLocation: string;
  latitude: number;
  longitude: number;
  description: string;
  sightingDate: string;
  confidence: "low" | "medium" | "high";
  reportedByName?: string;
}