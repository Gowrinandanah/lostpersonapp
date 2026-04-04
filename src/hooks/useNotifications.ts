// src/hooks/useNotifications.ts

import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Location from "expo-location";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { router } from "expo-router";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener     = useRef<Notifications.EventSubscription | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to be ready before registering
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        registerForPushNotifications().then((token) => {
          if (token) setPushToken(token);
        });
        saveUserLocation();
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          caseId?: string;
        };
        if (data?.caseId) {
          router.push({ pathname: "/case-details", params: { id: data.caseId } });
        }
      }
    );

    return () => {
      unsubscribeAuth();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { pushToken };
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2ECC71",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permission not granted");
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    console.log("Expo push token:", token);
    await saveToFirestore({
      pushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
    });
    return token;
  } catch (err) {
    console.error("Failed to get push token:", err);
    return null;
  }
}

async function saveUserLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("Location permission not granted — user won't receive geo-targeted alerts");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await saveToFirestore({
      lastLatitude: loc.coords.latitude,
      lastLongitude: loc.coords.longitude,
      locationUpdatedAt: new Date().toISOString(),
    });
    console.log("Location saved:", loc.coords.latitude, loc.coords.longitude);
  } catch (err) {
    console.warn("Could not save user location:", err);
  }
}

async function saveToFirestore(fields: Record<string, any>) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    // Use setDoc with merge so it works even if the user doc doesn't exist yet
    await setDoc(doc(db, "users", user.uid), fields, { merge: true });
  } catch (err) {
    console.error("saveToFirestore error:", err);
  }
}