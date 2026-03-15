import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { router, Stack } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../src/firebase/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const G = {
  primary: "#2ECC71", dark: "#27AE60", light: "#EAFAF1",
  white: "#FFFFFF", text: "#1A1A1A", sub: "#666666",
  muted: "#AAAAAA", border: "#E0E0E0", bg: "#F7F8FA",
};

export default function ForgotPasswordScreen() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert("Enter email", "Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (e: any) {
      const msg =
        e.code === "auth/user-not-found"  ? "No account found with this email." :
        e.code === "auth/invalid-email"   ? "Invalid email address." :
        "Failed to send reset email. Try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={S.root}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">

            <LinearGradient colors={["#2ECC71", "#27AE60"]} style={S.header}>
              <Text style={S.icon}>🔑</Text>
              <Text style={S.title}>Forgot Password?</Text>
              <Text style={S.subtitle}>We'll send a reset link to your email</Text>
            </LinearGradient>

            <View style={S.form}>
              {!sent ? (
                <>
                  <Text style={S.desc}>
                    Enter the email address you used to register. We'll send you a link to reset your password.
                  </Text>

                  <Text style={S.label}>Email Address</Text>
                  <TextInput
                    style={S.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={G.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />

                  <TouchableOpacity
                    style={[S.btn, loading && { opacity: 0.6 }]}
                    onPress={handleReset}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={S.btnText}>Send Reset Link</Text>
                    }
                  </TouchableOpacity>
                </>
              ) : (
                /* Success state */
                <View style={S.successWrap}>
                  <Text style={S.successIcon}>📧</Text>
                  <Text style={S.successTitle}>Email Sent!</Text>
                  <Text style={S.successDesc}>
                    A password reset link has been sent to{"\n"}
                    <Text style={{ fontWeight: "700", color: G.text }}>{email}</Text>
                    {"\n\n"}Check your inbox and follow the link to reset your password.
                  </Text>
                  <TouchableOpacity style={S.btn} onPress={() => router.replace("/(auth)/login")} activeOpacity={0.85}>
                    <Text style={S.btnText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
                <Text style={S.backText}>← Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: G.bg },
  scroll: { flexGrow: 1 },

  header:   { paddingTop: 60, paddingBottom: 36, alignItems: "center" },
  icon:     { fontSize: 48, marginBottom: 10 },
  title:    { fontSize: 22, fontWeight: "900", color: "#fff" },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 },

  form:  { backgroundColor: G.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, padding: 28, flex: 1, minHeight: 400 },
  desc:  { fontSize: 14, color: G.sub, lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "700", color: G.text, marginBottom: 8 },
  input: { height: 52, borderWidth: 1.5, borderColor: G.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: G.text, backgroundColor: G.white, marginBottom: 20 },

  btn:     { height: 54, borderRadius: 14, backgroundColor: G.primary, alignItems: "center", justifyContent: "center", shadowColor: G.dark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4, marginBottom: 12 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  backBtn:  { alignItems: "center", paddingVertical: 10 },
  backText: { fontSize: 14, color: G.sub, fontWeight: "600" },

  successWrap:  { alignItems: "center", paddingVertical: 16 },
  successIcon:  { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: "900", color: G.text, marginBottom: 12 },
  successDesc:  { fontSize: 14, color: G.sub, textAlign: "center", lineHeight: 22, marginBottom: 28 },
});