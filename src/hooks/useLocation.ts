import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { getAuth } from "firebase/auth";
import { GeofencingService } from "../services/geofencingService";

export function useLocation() {
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const [lastLocation, setLastLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || !active) return;

      // Get initial location
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await handleLocationUpdate(initialLocation);

      // Watch for location changes
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 100, // Check every 100 meters
          timeInterval: 30000,   // Or every 30 seconds
        },
        async (location) => {
          await handleLocationUpdate(location);
        }
      );
    })();

    return () => {
      active = false;
      watchRef.current?.remove();
    };
  }, []);

  const handleLocationUpdate = async (location: Location.LocationObject) => {
    const user = getAuth().currentUser;
    if (!user) return;
    
    setLastLocation(location);
    
    const { latitude, longitude } = location.coords;
    
    // Save location to Firestore
    await updateDoc(doc(db, "users", user.uid), {
      location: {
        lat: latitude,
        lng: longitude,
        updatedAt: new Date(),
      },
      lastLatitude: latitude,
      lastLongitude: longitude,
      lastLocationUpdate: new Date(),
    });
    
    // Check if user entered any active geofence
    const enteredGeofences = await GeofencingService.checkUserInActiveGeofences(
      user.uid,
      latitude,
      longitude
    );
    
    // Send notifications for each geofence entered
    for (const geofence of enteredGeofences) {
      await GeofencingService.sendGeofenceEntryNotification(
        user.uid,
        geofence.caseId,
        geofence.distance
      );
    }
  };

  return { lastLocation };
}