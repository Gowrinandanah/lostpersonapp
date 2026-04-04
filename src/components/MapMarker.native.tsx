import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { PointAnnotation, Callout } from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import type { MapMarkerData } from "../types/map";
import Svg, { Path, Text as SvgText } from "react-native-svg";
interface MapMarkerProps {
  data: MapMarkerData;
  onPress?: (id: string) => void;
}

const C = {
  urgent: "#7B1FA2",  // 🟣 purple  — urgent cases
  active: "#E53935",  // 🔴 red     — all other active cases
  white:  "#FFFFFF",
  text:   "#1A1A1A",
  sub:    "#555555",
  muted:  "#888888",
};

// ── Teardrop pin ──────────────────────────────────────────────────────────────
const TearDrop = ({ color }: { color: string }) => {
  return (
    <Svg width={24} height={36} viewBox="0 0 24 36">
      <Path
        d="M12 0C7 0 4 5 4 10c0 6 8 16 8 16s8-10 8-16C20 5 17 0 12 0z"
        fill={color}
        stroke="#fff"
        strokeWidth={1.5}
      />
    </Svg>
  );
};

// ── Urgent pulse ring ─────────────────────────────────────────────────────────
const UrgentRing = ({ size = 36 }: { size?: number }) => (
  <View
    style={{
      position: "absolute",
      top: -(size * 0.3),
      left: -(size * 0.3),
      width: size * 1.6,
      height: size * 1.6,
      borderRadius: size * 0.8,
      borderWidth: 2,
      borderColor: C.urgent,
      opacity: 0.4,
    }}
  />
);

// ── Main component ────────────────────────────────────────────────────────────
export default function MapMarker({ data, onPress }: MapMarkerProps) {
  // 🟣 purple if urgent, 🔴 red otherwise
  const pinColor = data.isUrgent ? C.urgent : C.active;

  const handlePress = () => {
    if (onPress) {
      onPress(data.id);
    } else {
      router.push({ pathname: "/case-details", params: { id: data.id } });
    }
  };

  return (
    <PointAnnotation
  id={`marker-${data.id}`}
  coordinate={[data.longitude, data.latitude]}
  anchor={{ x: 0.5, y: 1 }}
  onSelected={handlePress}
>
  <View style={{ alignItems: "center" }}>
    {/* Optional urgent pulse ring */}
    {data.isUrgent && <UrgentRing size={30} />}

    {/* Teardrop SVG */}
    <Svg width={24} height={36} viewBox="0 0 24 36">
      <Path
        d="M12 0C7 0 4 5 4 10c0 6 8 16 8 16s8-10 8-16C20 5 17 0 12 0z"
        fill={data.isUrgent ? C.urgent : C.active}
        stroke="#fff"
        strokeWidth={1.5}
      />
    </Svg>

    {/* Name BELOW the drop */}
    <View
      style={[
        styles.nameTag,
        {
          borderColor: data.isUrgent ? C.urgent : C.active,
          marginTop: 4,
        },
      ]}
    >
      <Text
        style={[
          styles.nameText,
          { color: data.isUrgent ? C.urgent : C.active },
        ]}
        numberOfLines={1}
      >
        {data.name}
      </Text>
    </View>
  </View>

  {/* Callout */}
  <Callout>
    <View style={styles.callout}>
      <View style={[styles.strip, { backgroundColor: data.isUrgent ? C.urgent : C.active }]}>
        <Text style={styles.stripText}>
          {data.isUrgent ? "⚠ URGENT · MISSING PERSON" : "MISSING PERSON"}
        </Text>
      </View>

      <View style={styles.calloutBody}>
        <Text style={styles.calloutName}>{data.name}</Text>
        <Text style={styles.calloutMeta}>
          {data.age} yrs · {data.gender}
        </Text>

        <View style={styles.locRow}>
          <Text style={styles.locPin}>📍</Text>
          <Text style={styles.locText} numberOfLines={2}>
            {data.lastSeenLocation}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.detailsBtn, { backgroundColor: data.isUrgent ? C.urgent : C.active }]}
          onPress={handlePress}
          activeOpacity={0.82}
        >
          <Text style={styles.detailsBtnText}>View Full Details →</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Callout>
</PointAnnotation>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },

  nameTag: {
    marginTop: 2,
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 90,
  },
  nameText: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },

  callout: {
    width: 220,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: C.white,
  },
  strip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  stripText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  calloutBody: {
    padding: 12,
  },
  calloutName: {
    fontSize: 15,
    fontWeight: "800",
    color: C.text,
    marginBottom: 3,
  },
  calloutMeta: {
    fontSize: 12,
    color: C.sub,
    marginBottom: 6,
  },
  locRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 10,
  },
  locPin: {
    fontSize: 12,
    marginTop: 1,
  },
  locText: {
    fontSize: 12,
    color: C.muted,
    flex: 1,
    lineHeight: 17,
  },
  detailsBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  detailsBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
});