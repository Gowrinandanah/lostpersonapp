import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

// Update the interface to match expo-location's types
interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number | null;  // Allow null
  altitude?: number | null;   // Allow null
  timestamp: number;
}

interface UseLocationReturn {
  location: LocationData | null;
  errorMsg: string | null;
  permissionGranted: boolean | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  getCurrentLocation: () => Promise<LocationData | null>;
  isTracking: boolean;
}

export const useLocation = (trackInterval: number = 10000): UseLocationReturn => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Update user location in Firestore
  const updateUserLocationInFirestore = async (locationData: Location.LocationObject) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        currentLocation: {
          lat: locationData.coords.latitude,
          lng: locationData.coords.longitude,
          accuracy: locationData.coords.accuracy ?? null, // Convert undefined to null
          altitude: locationData.coords.altitude ?? null, // Convert undefined to null
          timestamp: locationData.timestamp,
        },
        lastLocationUpdate: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating location in Firestore:", error);
    }
  };

  // Request permissions
  const requestPermissions = async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        setPermissionGranted(false);
        setErrorMsg('Permission to access location was denied');
        return false;
      }

      // Request background permissions for continuous tracking
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.log('Background location permission denied');
        }
      }

      setPermissionGranted(true);
      return true;
    } catch (error) {
      setErrorMsg('Error requesting location permissions');
      console.error(error);
      return false;
    }
  };

  // Start continuous tracking
  const startTracking = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      setIsTracking(true);
      
      // Configure location tracking
      await Location.enableNetworkProviderAsync();
      
      // Start watching position
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: trackInterval,
          distanceInterval: 10, // meters
        },
        (newLocation) => {
          // Update local state with proper null handling
          setLocation({
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            accuracy: newLocation.coords.accuracy ?? null,
            altitude: newLocation.coords.altitude ?? null,
            timestamp: newLocation.timestamp,
          });
          
          // Send location to Firestore
          updateUserLocationInFirestore(newLocation);
        }
      );
    } catch (error) {
      setErrorMsg('Error starting location tracking');
      console.error("Location tracking error:", error);
      setIsTracking(false);
    }
  };

  // Stop tracking
  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
  };

  // Get single current location
  const getCurrentLocation = async (): Promise<LocationData | null> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;

    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy ?? null,
        altitude: currentLocation.coords.altitude ?? null,
        timestamp: currentLocation.timestamp,
      };

      setLocation(locationData);
      
      // Send to Firestore
      await updateUserLocationInFirestore(currentLocation);
      
      return locationData;
    } catch (error) {
      setErrorMsg('Error getting current location');
      console.error(error);
      return null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return {
    location,
    errorMsg,
    permissionGranted,
    startTracking,
    stopTracking,
    getCurrentLocation,
    isTracking,
  };
};