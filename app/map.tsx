// This file is required by Expo Router as a fallback sibling for map.native.tsx.
// On Android/iOS, map.native.tsx is used instead of this file.
// On web, this renders a simple placeholder since the map is mobile-only.

import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.title}>Map View</Text>
      <Text style={styles.subtitle}>Available on the mobile app only.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
    gap: 12,
  },
  icon:     { fontSize: 48 },
  title:    { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  subtitle: { fontSize: 14, color: "#666666" },
});