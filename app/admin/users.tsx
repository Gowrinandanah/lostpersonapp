import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { DocumentData } from "firebase/firestore";
import {
  getAllUsers, banUser, unbanUser, promoteToAdmin, demoteFromAdmin,
} from "../../src/firebase/firestoreService";
import { auth } from "../../src/firebase/firebaseConfig";

const ADMIN_EMAILS = ["your@email.com"]; // ← replace with your actual email

const G = {
  primary: "#2ECC71", dark: "#27AE60", light: "#EAFAF1", border: "#D5F5E3",
  white: "#FFFFFF", bg: "#F7F8FA", text: "#1A1A1A", sub: "#666666",
  muted: "#AAAAAA", urgent: "#E74C3C", orange: "#E67E22",
};

export default function AdminUsers() {
  const [users,   setUsers]   = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [acting,  setActing]  = useState<string | null>(null);
  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
      Alert.alert("Access Denied", "You are not an admin.");
      router.replace("/alerts");
      return;
    }
    const unsub = getAllUsers((data) => {
      setUsers(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const handleBan = (uid: string, name: string, banned: boolean) => {
    if (uid === currentUid) { Alert.alert("Error", "You cannot ban yourself."); return; }
    Alert.alert(
      banned ? "Unban User" : "Ban User",
      `${banned ? "Unban" : "Ban"} "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: banned ? "Unban" : "Ban",
          style: banned ? "default" : "destructive",
          onPress: async () => { setActing(uid); banned ? await unbanUser(uid) : await banUser(uid); setActing(null); },
        },
      ]
    );
  };

  const handleRole = (uid: string, name: string, isAdmin: boolean) => {
    if (uid === currentUid) { Alert.alert("Error", "You cannot change your own role."); return; }
    Alert.alert(
      isAdmin ? "Remove Admin" : "Make Admin",
      `${isAdmin ? "Remove admin from" : "Promote"} "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isAdmin ? "Remove" : "Promote",
          onPress: async () => { setActing(uid); isAdmin ? await demoteFromAdmin(uid) : await promoteToAdmin(uid); setActing(null); },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={S.root}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
          <Text style={{ color: G.white, fontSize: 16, fontWeight: "700" }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Manage Users</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={S.searchWrap}>
        <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={S.searchInput} value={search} onChangeText={setSearch}
          placeholder="Search by name or email..." placeholderTextColor={G.muted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={{ color: G.muted, fontSize: 15 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={S.countText}>{filtered.length} user{filtered.length !== 1 ? "s" : ""}</Text>

      {loading ? (
        <View style={S.center}><ActivityIndicator size="large" color={G.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={S.center}>
          <Text style={{ fontSize: 36, marginBottom: 10 }}>👥</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: G.text }}>No users found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const isAdmin  = item.role === "admin";
            const isBanned = item.banned === true;
            const isYou    = item.id === currentUid;
            return (
              <View style={[S.card, isBanned && S.cardBanned]}>
                <View style={S.cardTop}>
                  <View style={S.avatar}>
                    <Text style={S.avatarText}>
                      {(item.name || item.email || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={S.userName} numberOfLines={1}>
                        {item.name || "No name"}{isYou ? " (You)" : ""}
                      </Text>
                      {isBanned && (
                        <View style={S.bannedBadge}>
                          <Text style={S.bannedText}>BANNED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={S.userEmail} numberOfLines={1}>{item.email || "No email"}</Text>
                    <View style={[S.roleBadge, isAdmin && S.roleBadgeAdmin]}>
                      <Text style={[S.roleText, isAdmin && S.roleTextAdmin]}>
                        {isAdmin ? "👑 Admin" : "User"}
                      </Text>
                    </View>
                  </View>
                </View>

                {!isYou && (
                  acting === item.id ? (
                    <ActivityIndicator color={G.primary} style={{ marginTop: 10 }} />
                  ) : (
                    <View style={S.actions}>
                      <TouchableOpacity
                        style={[S.actionBtn, isBanned ? { backgroundColor: G.primary } : { backgroundColor: G.urgent }]}
                        onPress={() => handleBan(item.id, item.name || "User", isBanned)}
                      >
                        <Text style={S.actionBtnText}>{isBanned ? "✓ Unban" : "🚫 Ban"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[S.actionBtn, isAdmin ? { backgroundColor: G.orange } : { backgroundColor: G.dark }]}
                        onPress={() => handleRole(item.id, item.name || "User", isAdmin)}
                      >
                        <Text style={S.actionBtnText}>{isAdmin ? "↓ Remove Admin" : "👑 Make Admin"}</Text>
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root:        { flex: 1, backgroundColor: G.bg },
  center:      { flex: 1, alignItems: "center", justifyContent: "center" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: G.dark, paddingHorizontal: 16, paddingVertical: 14 },
  backBtn:     { paddingHorizontal: 4, paddingVertical: 4 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: G.white },

  searchWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: G.white, margin: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#EEEEEE", elevation: 1 },
  searchInput: { flex: 1, fontSize: 14, color: G.text },
  countText:   { fontSize: 12, color: G.sub, fontWeight: "600", paddingHorizontal: 16, marginBottom: 4 },

  card:       { backgroundColor: G.white, borderRadius: 14, padding: 14, elevation: 2, borderWidth: 1, borderColor: "#F0F0F0" },
  cardBanned: { opacity: 0.7, borderColor: G.urgent },
  cardTop:    { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },

  avatar:     { width: 46, height: 46, borderRadius: 23, backgroundColor: G.light, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: G.border },
  avatarText: { fontSize: 18, fontWeight: "800", color: G.dark },

  userName:      { fontSize: 14, fontWeight: "700", color: G.text },
  userEmail:     { fontSize: 12, color: G.sub, marginBottom: 4 },
  roleBadge:     { alignSelf: "flex-start", backgroundColor: "#F0F0F0", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeAdmin:{ backgroundColor: "#FFF8E1" },
  roleText:      { fontSize: 11, fontWeight: "600", color: G.sub },
  roleTextAdmin: { color: G.orange },
  bannedBadge:   { backgroundColor: "#FDECEA", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  bannedText:    { fontSize: 9, fontWeight: "800", color: G.urgent },

  actions:      { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn:    { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  actionBtnText:{ color: G.white, fontSize: 12, fontWeight: "700" },
});