import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { router, usePathname } from "expo-router";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  icon: string;
  label: string;
  route: string;
  center?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: "🏠", label: "Home",    route: "/"                },
  { icon: "🔔", label: "Alerts",  route: "/alerts"          },
  { icon: "＋", label: "Report",  route: "/report-missing", center: true },
  { icon: "🗺️", label: "Map",     route: "/map"             },
  { icon: "👤", label: "Profile", route: "/profile"         },
];

const GREEN = "#2ECC71";

// ── Component ─────────────────────────────────────────────────────────────────

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.nav}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.route;

        if (item.center) {
          return (
            <TouchableOpacity
              key={item.route}
              style={styles.centerItem}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.85}
            >
              <View style={styles.centerBtn}>
                <Text style={styles.centerIcon}>{item.icon}</Text>
              </View>
              <Text style={[styles.label, { color: "#999" }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={item.route}
            style={styles.item}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.75}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={[styles.label, { color: active ? GREEN : "#999" }]}>
              {item.label}
            </Text>
            {active && <View style={styles.dot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingBottom: Platform.OS === "ios" ? 24 : 10,
    paddingTop: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
  item:  { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  icon:  { fontSize: 20, marginBottom: 3 },
  label: { fontSize: 10, fontWeight: "600" },
  dot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: GREEN, marginTop: 3 },

  centerItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerBtn:  {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  centerIcon: { fontSize: 24, color: "#fff", fontWeight: "700" },
});