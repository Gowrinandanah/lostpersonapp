// app/admin/_layout.tsx
// ─── Centralised admin auth guard ─────────────────────────────────────────
// Every screen nested under /admin is protected here.
// Individual screens no longer need their own auth checks.

import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { Stack, router } from "expo-router";
import { auth } from "../../src/firebase/firebaseConfig";
import { checkIsAdmin } from "../../src/constants/adminConfig";

export default function AdminLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      const admin = await checkIsAdmin(user.uid, user.email);
      if (!admin) {
        Alert.alert("Access Denied", "You do not have admin privileges.");
        router.replace("/alerts");
        return;
      }

      setReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Splash while we verify — screens never flash to unauthorised users
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F8FA" }}>
        <ActivityIndicator size="large" color="#2ECC71" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="users" />
      <Stack.Screen name="verify-case" />
    </Stack>
  );
}