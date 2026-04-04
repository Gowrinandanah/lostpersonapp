// app/notifications.tsx - Simplified with persistent notifications

import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Platform,
  Linking, Image, RefreshControl,
} from "react-native";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, Timestamp, limit } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../src/firebase/firebaseConfig";
import { router, Stack } from "expo-router";
import * as Location from 'expo-location';
import BottomNav from "../src/components/BottomNav";

const GREEN = "#2ECC71";
const LIGHT_GREEN = "#E8F5E9";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: "alert" | "sighting" | "urgent" | "general";
  caseId?: string;
  caseName?: string;
  casePhoto?: string;
  read: boolean;
  createdAt: Timestamp;
  distance?: number; // Optional - only for nearby alerts
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const uid = getAuth().currentUser?.uid;

  // Listen to ALL notifications from Firestore (persistent, never disappear)
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    // Real-time listener for user's notification history
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", uid),
      orderBy("createdAt", "desc") // Latest first
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Notification));
      setNotifications(notificationsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  // Get user location ONCE when component mounts (for distance calculation)
  useEffect(() => {
    if (uid) {
      getUserLocation();
    }
  }, [uid]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const userLat = location.coords.latitude;
        const userLng = location.coords.longitude;
        setUserLocation({ lat: userLat, lng: userLng });
        
        // Save to Firestore
        const userRef = doc(db, "users", uid!);
        await updateDoc(userRef, {
          lastLatitude: userLat,
          lastLongitude: userLng,
          lastLocationUpdate: new Date(),
        });
      }
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, "notifications", notificationId), { read: true });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    for (const notification of unreadNotifications) {
      await markAsRead(notification.id);
    }
  };

  const handleNotificationPress = (item: Notification) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    if (item.caseId) {
      router.push(`/case-details?id=${item.caseId}` as any);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Refresh location and update any distance calculations
    await getUserLocation();
    setRefreshing(false);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.heading}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.subHeading}>{unreadCount} unread</Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>
                When there are alerts near you, they'll appear here
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.notificationCard,
                !item.read && styles.unreadCard
              ]}
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.8}
            >
              {/* Left side - Icon */}
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>
                  {item.type === "urgent" ? "🚨" : 
                   item.type === "alert" ? "🔔" : 
                   item.type === "sighting" ? "👁️" : "📍"}
                </Text>
              </View>

              {/* Middle - Content */}
              <View style={styles.contentContainer}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, !item.read && styles.unreadTitle]}>
                    {item.title}
                  </Text>
                  {!item.read && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.body} numberOfLines={2}>
                  {item.body}
                </Text>
                
                <View style={styles.footer}>
                  <Text style={styles.time}>
                    {item.createdAt?.toDate?.()?.toLocaleString() || "Just now"}
                  </Text>
                  {item.distance && item.distance <= 50 && (
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>
                        📏 {item.distance} km away
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Right side - Unread indicator */}
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      </View>
      <BottomNav />
    </>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F5F5F5", 
    paddingTop: Platform.OS === "ios" ? 56 : 20 
  },
  center: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingHorizontal: 20, 
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5"
  },
  heading: { 
    fontSize: 24, 
    fontWeight: "700", 
    color: "#1A1A1A" 
  },
  subHeading: {
    fontSize: 12,
    color: GREEN,
    marginTop: 2,
    fontWeight: "500",
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 12,
    color: GREEN,
    fontWeight: "600",
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: "#F0FFF4",
    borderLeftWidth: 4,
    borderLeftColor: GREEN,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LIGHT_GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    flex: 1,
  },
  unreadTitle: {
    fontWeight: "800",
    color: "#000",
  },
  unreadBadge: {
    backgroundColor: GREEN,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  body: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  time: {
    fontSize: 11,
    color: "#999",
  },
  distanceBadge: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  distanceText: {
    fontSize: 10,
    color: "#2196F3",
    fontWeight: "500",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
    marginLeft: 8,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});