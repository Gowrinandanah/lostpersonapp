import * as Notifications from "expo-notifications";
import { collection, addDoc, Timestamp, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound?: "default";
  channelId?: string;
  data?: Record<string, any>;
  badge?: number;
}

/**
 * Send push notifications to a list of Expo push tokens
 */
export async function sendPushNotifications(
  messages: PushMessage[],
  recipientIds: string[],
  type: "alert" | "sighting" | "urgent" | "general",
  caseId?: string
): Promise<void> {
  if (messages.length === 0) return;

  try {
    const chunks = chunkArray(messages, 100);
    
    for (const chunk of chunks) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      
      const data = await response.json();
      
      if (data.errors) {
        console.error("Push notification errors:", data.errors);
        
        // Handle invalid tokens
        for (const error of data.errors) {
          if (error.details?.error === "DeviceNotRegistered") {
            await removeInvalidToken(error.details?.expoPushToken);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error sending push notifications:", error);
  }
}

/**
 * Send notification to all users (fallback when no geofence users found)
 */
export async function notifyAllUsers(
  title: string,
  body: string,
  type: "alert" | "sighting" | "urgent" | "general",
  caseId?: string
): Promise<void> {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const tokens: string[] = [];
    const recipientIds: string[] = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.pushToken && !userData.banned) {
        tokens.push(userData.pushToken);
        recipientIds.push(doc.id);
      }
    });
    
    const messages: PushMessage[] = tokens.map(token => ({
      to: token,
      title,
      body,
      sound: "default",
      channelId: type === "urgent" ? "urgent_alerts" : "default",
      data: caseId ? { caseId, screen: "case-details" } : undefined,
      badge: 1,
    }));
    
    await sendPushNotifications(messages, recipientIds, type, caseId);
    
    // Also save to Firestore notifications collection
    const batch = writeBatch(db);
    recipientIds.forEach(uid => {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        recipientId: uid,
        title,
        body,
        type,
        caseId: caseId || null,
        read: false,
        createdAt: Timestamp.now(),
      });
    });
    await batch.commit();
    
    console.log(`Sent notifications to ${recipientIds.length} users`);
  } catch (error) {
    console.error("Error notifying all users:", error);
  }
}

/**
 * Remove invalid push token from user document
 */
async function removeInvalidToken(token: string): Promise<void> {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("pushToken", "==", token));
  const snapshot = await getDocs(q);
  
  for (const userDoc of snapshot.docs) {
    await updateDoc(doc(db, "users", userDoc.id), {
      pushToken: null,
    });
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Need to import these at top - adding here for completeness
import { getDocs, query, where, writeBatch } from "firebase/firestore";