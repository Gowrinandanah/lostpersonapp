// src/features/alerts/alertsService.ts
//
// Responsible for:
//   1. Fetching all users who have a push token saved in Firestore
//   2. Filtering to only those within ALERT_RADIUS_KM of the case location

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

/** Radius in kilometres — users within this distance get notified */
export const ALERT_RADIUS_KM = 50;

export interface NearbyToken {
  uid: string;
  pushToken: string;
}

/**
 * Returns Expo push tokens for all users within ALERT_RADIUS_KM of
 * the given coordinates.
 *
 * Firestore has no geo-query support out of the box, so we:
 *   1. Fetch all users that have a pushToken stored
 *   2. Filter client-side by haversine distance
 *
 * This is fine for apps with < ~10k users. For larger scale, swap in
 * GeoFirestore or a server-side Cloud Function.
 */
export async function getNearbyUserTokens(
  caseLat: number,
  caseLng: number
): Promise<NearbyToken[]> {
  try {
    // Only fetch users who have a push token — avoids pulling the whole collection
    const q = query(
      collection(db, "users"),
      where("pushToken", "!=", null)
    );
    const snap = await getDocs(q);

    const nearby: NearbyToken[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();

      // Skip users without a valid Expo token
      if (!data.pushToken || !isValidExpoPushToken(data.pushToken)) return;

      // Skip users who haven't shared their location
      if (
        typeof data.lastLatitude  !== "number" ||
        typeof data.lastLongitude !== "number"
      ) {
        // Include them anyway with a fallback — they still want alerts
        // even if we can't check their distance. Remove this block if you
        // only want location-confirmed nearby users.
        nearby.push({ uid: docSnap.id, pushToken: data.pushToken });
        return;
      }

      const distKm = haversineKm(
        caseLat,
        caseLng,
        data.lastLatitude,
        data.lastLongitude
      );

      if (distKm <= ALERT_RADIUS_KM) {
        nearby.push({ uid: docSnap.id, pushToken: data.pushToken });
      }
    });

    return nearby;
  } catch (err) {
    console.error("getNearbyUserTokens error:", err);
    return [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Haversine formula — returns distance in km between two lat/lng points */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Basic check that the token looks like an Expo push token */
function isValidExpoPushToken(token: string): boolean {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
  );
}