import React from 'react';
import { Marker, Callout } from 'react-native-maps';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MapMarkerData } from '../types/map';

interface MapMarkerProps {
  data: MapMarkerData;
  onPress?: (id: string) => void;
}

const G = {
  primary: "#2ECC71",
  urgent: "#E74C3C",
  white: "#FFFFFF",
  dark: "#27AE60",
  text: "#1A1A1A",
  sub: "#666666",
};

export default function MapMarker({ data, onPress }: MapMarkerProps) {
  const handlePress = () => {
    if (onPress) {
      onPress(data.id);
    } else {
      router.push({
        pathname: "/case-details",
        params: { id: data.id }
      });
    }
  };

  return (
    <Marker
      coordinate={{
        latitude: data.latitude,
        longitude: data.longitude,
      }}
      pinColor={data.isUrgent ? G.urgent : G.primary}
      onPress={handlePress}
    >
      <Callout>
        <View style={styles.callout}>
          <Text style={styles.calloutName}>{data.name}</Text>
          <Text style={styles.calloutDetails}>Age: {data.age} · {data.gender}</Text>
          <Text style={styles.calloutLocation}>{data.lastSeenLocation}</Text>
          {data.isUrgent && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>URGENT</Text>
            </View>
          )}
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  callout: {
    width: 180,
    padding: 8,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: "700",
    color: G.text,
    marginBottom: 2,
  },
  calloutDetails: {
    fontSize: 11,
    color: G.sub,
    marginBottom: 2,
  },
  calloutLocation: {
    fontSize: 11,
    color: G.sub,
    marginBottom: 4,
  },
  urgentBadge: {
    backgroundColor: G.urgent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  urgentText: {
    color: G.white,
    fontSize: 9,
    fontWeight: "700",
  },
});