import { getNearbyUserTokens, ALERT_RADIUS_KM } from "./alertsService";
import { sendPushNotifications, notifyAllUsers, PushMessage } from "../../services/notificationService";
import { GeofencingService } from "../../services/geofencingService";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export interface CasePayload {
  id: string;
  name: string;
  age: number;
  gender: string;
  lastSeenLocation: string;
  lastSeenLat: number | null;
  lastSeenLng: number | null;
  isUrgentFlag?: boolean;
  isVulnerable?: boolean;
}

export async function verifyAndNotify(caseData: CasePayload): Promise<void> {
  const ref = doc(db, "missingPersons", caseData.id);
  const snap = await getDoc(ref);
  
  if (!snap.exists()) {
    console.error(`verifyAndNotify: document ${caseData.id} not found`);
    throw new Error(`Case ${caseData.id} does not exist`);
  }

  await updateDoc(ref, {
    status: "active",
    verified: true,
    updatedAt: serverTimestamp(),
  });

  const isUrgent = caseData.isUrgentFlag || caseData.isVulnerable;
  const title = isUrgent ? "🚨 URGENT — Missing Person Alert" : "🔔 Missing Person Alert";
  const body = `${caseData.name}, ${caseData.age} yrs (${caseData.gender}) was last seen near ${caseData.lastSeenLocation}.`;
  const type = (isUrgent ? "urgent" : "alert") as "urgent" | "alert";

  const hasCoords = caseData.lastSeenLat !== null && 
                    caseData.lastSeenLng !== null && 
                    caseData.lastSeenLat !== 0 && 
                    caseData.lastSeenLng !== 0;

  if (!hasCoords) {
    console.log("No coordinates - sending to all users");
    await notifyAllUsers(title, body, type, caseData.id);
    return;
  }

  // NEW: Set up geofence for this case
  console.log(`Setting up geofence for case ${caseData.id} at (${caseData.lastSeenLat}, ${caseData.lastSeenLng})`);
  await GeofencingService.setupGeofenceForCase(
    caseData.id,
    caseData.lastSeenLat!,
    caseData.lastSeenLng!,
    ALERT_RADIUS_KM
  );

  // Note: GeofencingService.setupGeofenceForCase already sends notifications to users in the geofence
  // The code below is kept as a fallback for immediate notifications
  const nearbyUsers = await getNearbyUserTokens(caseData.lastSeenLat!, caseData.lastSeenLng!);
  
  if (nearbyUsers.length === 0) {
    console.log("No nearby users found - geofence is active for future entries");
    return;
  }

  // Send immediate push notifications to users currently in geofence
  const recipientIds = nearbyUsers.map(u => u.uid).filter(Boolean);
  const messages: PushMessage[] = nearbyUsers.map(({ pushToken }) => ({
    to: pushToken,
    title,
    body,
    sound: "default",
    channelId: "default",
    data: { caseId: caseData.id, screen: "case-details" },
    badge: 1,
  }));

  await sendPushNotifications(messages, recipientIds, type, caseData.id);
  console.log(`Sent immediate notifications to ${messages.length} nearby users within ${ALERT_RADIUS_KM}km`);
}