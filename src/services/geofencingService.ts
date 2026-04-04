import { db } from "../firebase/firebaseConfig";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  Timestamp,
  GeoPoint,
  writeBatch,
  limit,
} from "firebase/firestore";
import { sendPushNotifications, PushMessage } from "./notificationService";
import { calculateDistance } from "../utils/locationHelper";

export const GEOFENCE_RADIUS_KM = 50;

export interface Geofence {
  caseId: string;
  center: {
    latitude: number;
    longitude: number;
  };
  radiusKm: number;
  isActive: boolean;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface NearbyAlert {
  caseId: string;
  caseName: string;
  age: number;
  gender: string;
  lastSeenLocation: string;
  photoUrl?: string;
  distance: number;
  isUrgent: boolean;
  isVulnerable: boolean;
}

export class GeofencingService {
  
  /**
   * Create geofence when admin verifies a case
   */
  static async setupGeofenceForCase(
    caseId: string,
    centerLat: number,
    centerLng: number,
    radiusKm: number = GEOFENCE_RADIUS_KM
  ): Promise<void> {
    try {
      // 1. Save geofence to Firestore
      const geofenceRef = doc(db, "geofences", caseId);
      await setDoc(geofenceRef, {
        caseId,
        center: new GeoPoint(centerLat, centerLng),
        radiusKm,
        isActive: true,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
      });

      // 2. Find and notify all eligible users
      await this.notifyUsersInGeofence(caseId, centerLat, centerLng, radiusKm);

      console.log(`Geofence setup for case ${caseId} with radius ${radiusKm}km`);
    } catch (error) {
      console.error("Error setting up geofence:", error);
      throw error;
    }
  }

  /**
   * Get nearby alerts for a specific user (for Notifications Page)
   * This checks all active geofences and returns cases within radius
   */
  static async getNearbyAlertsForUser(
    userId: string,
    userLat: number,
    userLng: number
  ): Promise<NearbyAlert[]> {
    try {
      // Get user's location
      const userDoc = await getDoc(doc(db, "users", userId));
      if (!userDoc.exists()) {
        console.log(`User ${userId} not found`);
        return [];
      }

      // Get all active geofences
      const geofencesRef = collection(db, "geofences");
      const activeGeofencesQuery = query(
        geofencesRef,
        where("isActive", "==", true)
      );
      
      const geofencesSnapshot = await getDocs(activeGeofencesQuery);
      const nearbyAlerts: NearbyAlert[] = [];
      
      for (const geofenceDoc of geofencesSnapshot.docs) {
        const geofence = geofenceDoc.data();
        const center = geofence.center;
        
        // Calculate distance from user to geofence center
        const distance = calculateDistance(
          { latitude: userLat, longitude: userLng },
          { latitude: center.latitude, longitude: center.longitude },
          'km'
        );
        
        // If user is within geofence radius
        if (distance <= geofence.radiusKm) {
          // Get case details
          const caseDoc = await getDoc(doc(db, "missingPersons", geofence.caseId));
          if (caseDoc.exists()) {
            const caseData = caseDoc.data();
            nearbyAlerts.push({
              caseId: geofence.caseId,
              caseName: caseData.name,
              age: caseData.age,
              gender: caseData.gender,
              lastSeenLocation: caseData.lastSeenLocation,
              photoUrl: caseData.photoUrl,
              distance: Math.round(distance * 10) / 10,
              isUrgent: caseData.isUrgentFlag || false,
              isVulnerable: caseData.isVulnerable || false,
            });
          }
        }
      }
      
      // Sort by distance (closest first)
      nearbyAlerts.sort((a, b) => a.distance - b.distance);
      
      console.log(`Found ${nearbyAlerts.length} nearby alerts for user ${userId}`);
      return nearbyAlerts;
    } catch (error) {
      console.error("Error getting nearby alerts:", error);
      return [];
    }
  }

  /**
   * Get all users within geofence radius
   * This includes:
   * 1. Logged-in users with live location (location field)
   * 2. Offline users with last known location (lastLatitude/lastLongitude)
   */
  static async getUsersInGeofence(
    centerLat: number,
    centerLng: number,
    radiusKm: number
  ): Promise<UserLocation[]> {
    try {
      // Get all users from Firestore
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      
      const usersInGeofence: UserLocation[] = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const uid = userDoc.id;
        
        // Skip banned users
        if (userData.banned) continue;
        
        // Get user's location (prioritize live location, fallback to last seen)
        let userLat: number | null = null;
        let userLng: number | null = null;
        
        // Check for live location (from useLocation hook)
        if (userData.location && typeof userData.location === 'object') {
          userLat = userData.location.lat;
          userLng = userData.location.lng;
        }
        // Fallback to last seen location (from useNotifications hook)
        else if (userData.lastLatitude && userData.lastLongitude) {
          userLat = userData.lastLatitude;
          userLng = userData.lastLongitude;
        }
        
        if (userLat && userLng) {
          const distance = calculateDistance(
            { latitude: centerLat, longitude: centerLng },
            { latitude: userLat, longitude: userLng },
            'km'
          );
          
          if (distance <= radiusKm) {
            usersInGeofence.push({
              uid,
              location: { lat: userLat, lng: userLng },
              lastSeenAt: userData.locationUpdatedAt || userData.lastLocationUpdate,
              pushToken: userData.pushToken,
            });
          }
        }
      }
      
      return usersInGeofence;
    } catch (error) {
      console.error("Error getting users in geofence:", error);
      return [];
    }
  }

  /**
   * Notify all users currently in geofence (both logged in and offline)
   */
  static async notifyUsersInGeofence(
    caseId: string,
    centerLat: number,
    centerLng: number,
    radiusKm: number
  ): Promise<void> {
    try {
      // Get case details for notification content
      const caseDoc = await getDoc(doc(db, "missingPersons", caseId));
      if (!caseDoc.exists()) {
        console.error(`Case ${caseId} not found`);
        return;
      }
      
      const caseData = caseDoc.data();
      const isUrgent = caseData.isUrgentFlag || caseData.isVulnerable;
      const title = isUrgent ? "🚨 URGENT — Missing Person Alert" : "🔔 Missing Person Alert";
      const body = `${caseData.name}, ${caseData.age} yrs was last seen near ${caseData.lastSeenLocation}. Please be on the lookout!`;

      // Get users in geofence
      const usersInGeofence = await this.getUsersInGeofence(centerLat, centerLng, radiusKm);
      
      if (usersInGeofence.length === 0) {
        console.log(`No users found within ${radiusKm}km of case ${caseId}`);
        return;
      }

      // Send push notifications
      const messages: PushMessage[] = usersInGeofence
        .filter(user => user.pushToken)
        .map(user => ({
          to: user.pushToken!,
          title,
          body,
          sound: "default",
          channelId: "geofence_alerts",
          data: { 
            caseId, 
            screen: "case-details",
            type: "geofence_entry"
          },
          badge: 1,
        }));

      const recipientIds = usersInGeofence.map(u => u.uid);
      
      if (messages.length > 0) {
        await sendPushNotifications(messages, recipientIds, isUrgent ? "urgent" : "alert", caseId);
        console.log(`Sent geofence notifications to ${messages.length} users`);
      }

      // Create notification records in Firestore for each user
      const batch = writeBatch(db);
      usersInGeofence.forEach(user => {
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          recipientId: user.uid,
          title,
          body,
          type: isUrgent ? "urgent" : "alert",
          caseId,
          read: false,
          createdAt: Timestamp.now(),
        });
      });
      
      await batch.commit();

    } catch (error) {
      console.error("Error notifying users in geofence:", error);
      throw error;
    }
  }

  /**
   * Check if a specific user is within any active geofence
   * Called when user updates their location
   */
  static async checkUserInActiveGeofences(
    userId: string,
    userLat: number,
    userLng: number
  ): Promise<Array<{ caseId: string; distance: number }>> {
    try {
      // Get all active geofences
      const geofencesRef = collection(db, "geofences");
      const activeGeofencesQuery = query(
        geofencesRef,
        where("isActive", "==", true)
      );
      
      const geofencesSnapshot = await getDocs(activeGeofencesQuery);
      const enteredGeofences = [];
      
      for (const geofenceDoc of geofencesSnapshot.docs) {
        const geofence = geofenceDoc.data();
        const center = geofence.center;
        
        const distance = calculateDistance(
          { latitude: userLat, longitude: userLng },
          { latitude: center.latitude, longitude: center.longitude },
          'km'
        );
        
        if (distance <= geofence.radiusKm) {
          // Check if user has already been notified for this geofence in the last 24 hours
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);
          
          const notificationQuery = query(
            collection(db, "notifications"),
            where("recipientId", "==", userId),
            where("caseId", "==", geofence.caseId),
            where("type", "in", ["alert", "urgent", "geofence_entry"]),
            where("createdAt", ">=", Timestamp.fromDate(oneDayAgo))
          );
          
          const existingNotif = await getDocs(notificationQuery);
          
          // Only notify if not already notified in the last 24 hours
          if (existingNotif.empty) {
            enteredGeofences.push({
              caseId: geofence.caseId,
              distance: distance,
            });
          }
        }
      }
      
      return enteredGeofences;
    } catch (error) {
      console.error("Error checking user in geofences:", error);
      return [];
    }
  }

  /**
   * Send entry notification when user enters a geofence
   */
  static async sendGeofenceEntryNotification(
    userId: string,
    caseId: string,
    distance: number
  ): Promise<void> {
    try {
      // Get case details
      const caseDoc = await getDoc(doc(db, "missingPersons", caseId));
      if (!caseDoc.exists()) return;
      
      const caseData = caseDoc.data();
      const userDoc = await getDoc(doc(db, "users", userId));
      const userData = userDoc.data();
      
      const title = "📍 You've entered a search area";
      const body = `A missing person (${caseData.name}) was reported near you (${Math.round(distance)}km away). Please be alert and report any sightings.`;
      
      // Send push notification if user has token
      if (userData?.pushToken) {
        const message: PushMessage = {
          to: userData.pushToken,
          title,
          body,
          sound: "default",
          channelId: "geofence_alerts",
          data: { caseId, screen: "case-details", type: "geofence_entry" },
          badge: 1,
        };
        
        await sendPushNotifications([message], [userId], "alert", caseId);
      }
      
      // Save notification to Firestore
      await setDoc(doc(collection(db, "notifications")), {
        recipientId: userId,
        title,
        body,
        type: "general",
        caseId,
        read: false,
        createdAt: Timestamp.now(),
      });
      
      console.log(`Geofence entry notification sent to user ${userId} for case ${caseId}`);
    } catch (error) {
      console.error("Error sending geofence entry notification:", error);
    }
  }

  /**
   * Deactivate geofence when case is resolved
   */
  static async deactivateGeofence(caseId: string): Promise<void> {
    try {
      const geofenceRef = doc(db, "geofences", caseId);
      await updateDoc(geofenceRef, {
        isActive: false,
        deactivatedAt: Timestamp.now(),
      });
      console.log(`Geofence deactivated for case ${caseId}`);
    } catch (error) {
      console.error("Error deactivating geofence:", error);
    }
  }

  /**
   * Get all active geofences (for debugging/monitoring)
   */
  static async getActiveGeofences(): Promise<Geofence[]> {
    try {
      const geofencesRef = collection(db, "geofences");
      const q = query(geofencesRef, where("isActive", "==", true));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        caseId: doc.id,
        ...doc.data(),
        center: {
          latitude: doc.data().center.latitude,
          longitude: doc.data().center.longitude,
        },
      } as Geofence));
    } catch (error) {
      console.error("Error getting active geofences:", error);
      return [];
    }
  }
}

export interface UserLocation {
  uid: string;
  location: {
    lat: number;
    lng: number;
  };
  lastSeenAt: Timestamp;
  pushToken?: string;
}