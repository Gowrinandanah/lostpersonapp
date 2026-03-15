import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from "react-native";
import { router, Stack } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../src/firebase/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const G = {
  primary: "#2ECC71", dark: "#27AE60",
  white: "#FFFFFF", text: "#1A1A1A", sub: "#666666",
  muted: "#AAAAAA", error: "#E74C3C", border: "#E0E0E0",
  bg: "#F7F8FA",
};

export default function LoginScreen() {
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/alerts");
    } catch (e: any) {
      const msg =
        e.code === "auth/invalid-credential"  ? "Incorrect email or password." :
        e.code === "auth/user-not-found"       ? "No account found with this email." :
        e.code === "auth/wrong-password"       ? "Incorrect password." :
        e.code === "auth/too-many-requests"    ? "Too many attempts. Try again later." :
        e.code === "auth/invalid-email"        ? "Invalid email address." :
        "Sign in failed. Check your connection.";
      Alert.alert("Sign In Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hide the navigation header completely */}
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={S.root}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={S.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Green header */}
            <LinearGradient colors={["#2ECC71", "#27AE60"]} style={S.header}>
              <Text style={S.appIcon}>🚨</Text>
              <Text style={S.appName}>Lost Person Alert</Text>
              <Text style={S.appTagline}>Help bring missing people home</Text>
            </LinearGradient>

            {/* Form card */}
            <View style={S.form}>
              <Text style={S.title}>Welcome back</Text>
              <Text style={S.subtitle}>Sign in to continue</Text>

              {/* Email */}
              <View style={S.fieldWrap}>
                <Text style={S.label}>Email</Text>
                <TextInput
                  style={S.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={G.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              {/* Password */}
              <View style={S.fieldWrap}>
                <Text style={S.label}>Password</Text>
                <View style={S.passwordWrap}>
                  <TextInput
                    style={S.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={G.muted}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    style={S.eyeBtn}
                  >
                    <Text style={{ fontSize: 18 }}>
                      {showPassword ? "🙈" : "👁"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot password */}
              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot-password")}
                style={S.forgotWrap}
              >
                <Text style={S.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Sign In button */}
              <TouchableOpacity
                style={[S.signInBtn, loading && { opacity: 0.6 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={S.signInBtnText}>Sign In</Text>
                }
              </TouchableOpacity>

              {/* Register link */}
              <View style={S.registerRow}>
                <Text style={S.registerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                  <Text style={S.registerLink}>Create one</Text>
                </TouchableOpacity>
              </View>
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

  header:     { paddingTop: 60, paddingBottom: 40, alignItems: "center" },
  appIcon:    { fontSize: 52, marginBottom: 8 },
  appName:    { fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  appTagline: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 6 },

  form:     {
    backgroundColor: G.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    padding: 28,
    flex: 1,
    minHeight: 460,
  },
  title:    { fontSize: 24, fontWeight: "900", color: G.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: G.sub, marginBottom: 28 },

  fieldWrap:    { marginBottom: 18 },
  label:        { fontSize: 13, fontWeight: "700", color: G.text, marginBottom: 6 },
  input:        {
    height: 52, borderWidth: 1.5, borderColor: G.border,
    borderRadius: 12, paddingHorizontal: 14,
    fontSize: 15, color: G.text, backgroundColor: G.white,
  },
  passwordWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: G.border,
    borderRadius: 12, backgroundColor: G.white,
  },
  passwordInput:{ flex: 1, height: 52, paddingHorizontal: 14, fontSize: 15, color: G.text },
  eyeBtn:       { padding: 12 },

  forgotWrap: { alignItems: "flex-end", marginBottom: 24, marginTop: -6 },
  forgotText: { fontSize: 13, color: G.dark, fontWeight: "600" },

  signInBtn: {
    height: 54, borderRadius: 14, backgroundColor: G.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: G.dark, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
    marginBottom: 20,
  },
  signInBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  registerRow:  { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  registerText: { fontSize: 14, color: G.sub },
  registerLink: { fontSize: 14, color: G.dark, fontWeight: "700" },
});