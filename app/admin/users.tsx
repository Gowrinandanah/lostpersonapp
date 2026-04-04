// app/admin/users.tsx

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  collection, onSnapshot, doc, updateDoc,
} from "firebase/firestore";
import { db, auth } from "../../src/firebase/firebaseConfig";

export default function UsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleBan = async (user: any) => {
    if (user.id === currentUid) {
      return Alert.alert("Error", "You cannot ban yourself");
    }

    Alert.alert(
      user.banned ? "Unban User" : "Ban User",
      `${user.banned ? "Unban" : "Ban"} ${user.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            setActing(user.id);
            await updateDoc(doc(db, "users", user.id), {
              banned: !user.banned,
            });
            setActing(null);
          },
        },
      ]
    );
  };

  const openUser = (uid: string) => {
    router.push({
      pathname: "/admin/user-detail",
      params: { uid },
    });
  };

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={S.root}>
      <Text style={S.title}>User Management</Text>

      <TextInput
        placeholder="Search by email..."
        style={S.search}
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={({ item }) => {
            const isYou = item.id === currentUid;

            return (
              <View style={S.card}>
                <TouchableOpacity onPress={() => openUser(item.id)}>
                  <Text style={S.email}>
                    {item.email} {isYou && "(You)"}
                  </Text>

                  <Text style={S.name}>
                    {item.displayName || "No Name"}
                  </Text>

                  <Text>🚩 Flags: {item.flaggedCount || 0}</Text>
                  <Text>
                    {item.banned ? "🚫 Banned" : "✅ Active"}
                  </Text>
                </TouchableOpacity>

                {!isYou && (
                  acting === item.id ? (
                    <ActivityIndicator />
                  ) : (
                    <TouchableOpacity
                      style={S.banBtn}
                      onPress={() => handleBan(item)}
                    >
                      <Text style={S.btnText}>
                        {item.banned ? "Unban" : "Ban"}
                      </Text>
                    </TouchableOpacity>
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
  root: { flex: 1, padding: 16, backgroundColor: "#F3F4F6" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  search: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  email: { fontWeight: "bold" },
  name: { color: "#6B7280" },
  banBtn: {
    marginTop: 10,
    backgroundColor: "red",
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  btnText: { color: "#fff" },
});