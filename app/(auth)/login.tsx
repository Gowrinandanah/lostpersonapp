import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from "react-native";
import { router, Stack } from "expo-router";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { auth } from "../../src/firebase/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  useGoogleSignIn,
  handleGoogleSignInResponse,
} from "../../src/services/googleAuthService";


const ADMIN_EMAILS = ["admin@gmail.com"];

const G = {
  primary: "#2ECC71", dark: "#27AE60", white: "#FFFFFF",
  text: "#1A1A1A", sub: "#666666", muted: "#AAAAAA",
  error: "#E74C3C", border: "#E0E0E0", bg: "#F7F8FA",
  google: "#DB4437", googleDark: "#B3321F",
};

export default function LoginScreen() {
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);

  const { request, response, promptAsync } = useGoogleSignIn();

  useEffect(() => {
    if (response) {
      setGoogleLoading(true);
      handleGoogleSignInResponse(
        response,
        () => { setGoogleLoading(false); router.replace("/alerts"); },
        (errorMessage) => { setGoogleLoading(false); Alert.alert("Google Sign-In Failed", errorMessage); }
      );
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);

      // Admin accounts skip email verification check
      const isAdmin = ADMIN_EMAILS.includes((user.email ?? "").toLowerCase());

      if (!isAdmin && !user.emailVerified) {
        await auth.signOut();
        Alert.alert(
          "Email not verified",
          "Please verify your email before signing in. Check your inbox for the verification link.",
          [
            {
              text: "Resend email",
              onPress: async () => {
                try {
                  const { user: u } = await signInWithEmailAndPassword(auth, email.trim(), password);
                  await sendEmailVerification(u);
                  await auth.signOut();
                  Alert.alert("Sent", "Verification email resent. Check your inbox.");
                } catch {
                  Alert.alert("Error", "Could not resend verification email.");
                }
              },
            },
            { text: "OK" },
          ]
        );
        return;
      }

      // ── Redirect based on role ──────────────────────────────────────────
      if (isAdmin) {
  setTimeout(() => {
    router.replace("/admin/dashboard");
  }, 300); // small delay fixes mobile issue
} else {
  router.replace("/alerts");
}

    } catch (e: any) {
      const msg =
        e.code === "auth/invalid-credential"  ? "Incorrect email or password."         :
        e.code === "auth/user-not-found"       ? "No account found with this email."    :
        e.code === "auth/wrong-password"       ? "Incorrect password."                  :
        e.code === "auth/too-many-requests"    ? "Too many attempts. Try again later."  :
        e.code === "auth/invalid-email"        ? "Invalid email address."               :
        "Sign in failed. Check your connection.";
      Alert.alert("Sign In Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!request) {
      Alert.alert("Error", "Google Sign-In is not ready. Please try again.");
      return;
    }
    try {
      setGoogleLoading(true);
      await promptAsync();
    } catch (error: any) {
      setGoogleLoading(false);
      Alert.alert("Google Sign-In Error", error.message || "Failed to start Google Sign-In");
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={S.root}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            <LinearGradient colors={["#2ECC71", "#27AE60"]} style={S.header}>
              <Text style={S.appIcon}>🚨</Text>
              <Text style={S.appName}>Lost Person Alert</Text>
              <Text style={S.appTagline}>Help bring missing people home</Text>
            </LinearGradient>

            <View style={S.form}>
              <Text style={S.title}>Welcome back</Text>
              <Text style={S.subtitle}>Sign in to continue</Text>

              <TouchableOpacity
                style={[S.googleBtn, (googleLoading || !request) && { opacity: 0.6 }]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading || !request}
                activeOpacity={0.85}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={S.googleIcon}>G</Text>
                    <Text style={S.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={S.divider}>
                <View style={S.dividerLine} />
                <Text style={S.dividerText}>or</Text>
                <View style={S.dividerLine} />
              </View>

              <View style={S.fieldWrap}>
                <Text style={S.label}>Email</Text>
                <TextInput
                  style={S.input} value={email} onChangeText={setEmail}
                  placeholder="you@example.com" placeholderTextColor={G.muted}
                  keyboardType="email-address" autoCapitalize="none"
                  autoComplete="email" editable={!loading && !googleLoading}
                />
              </View>

              <View style={S.fieldWrap}>
                <Text style={S.label}>Password</Text>
                <View style={S.passwordWrap}>
                  <TextInput
                    style={S.passwordInput} value={password} onChangeText={setPassword}
                    placeholder="Enter your password" placeholderTextColor={G.muted}
                    secureTextEntry={!showPassword} autoComplete="password"
                    editable={!loading && !googleLoading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={S.eyeBtn} disabled={loading || googleLoading}>
                    <Text style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} style={S.forgotWrap} disabled={loading || googleLoading}>
                <Text style={S.forgotText}></Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[S.signInBtn, (loading || googleLoading) && { opacity: 0.6 }]}
                onPress={handleLogin} disabled={loading || googleLoading} activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.signInBtnText}>Sign In</Text>}
              </TouchableOpacity>

              <View style={S.registerRow}>
                <Text style={S.registerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/register")} disabled={loading || googleLoading}>
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

  form: { backgroundColor: G.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, padding: 28, flex: 1, minHeight: 460 },
  title:    { fontSize: 24, fontWeight: "900", color: G.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: G.sub, marginBottom: 28 },

  googleBtn:     { height: 54, borderRadius: 14, backgroundColor: G.google, flexDirection: "row", alignItems: "center", justifyContent: "center", shadowColor: G.googleDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4, marginBottom: 20 },
  googleIcon:    { color: "#fff", fontSize: 22, fontWeight: "900", marginRight: 10, backgroundColor: "rgba(255,255,255,0.2)", width: 32, height: 32, textAlign: "center", lineHeight: 32, borderRadius: 16 },
  googleBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  divider:     { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: G.border },
  dividerText: { marginHorizontal: 10, color: G.sub, fontSize: 14, fontWeight: "500" },

  fieldWrap: { marginBottom: 18 },
  label:     { fontSize: 13, fontWeight: "700", color: G.text, marginBottom: 6 },
  input:     { height: 52, borderWidth: 1.5, borderColor: G.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: G.text, backgroundColor: G.white },

  passwordWrap:  { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: G.border, borderRadius: 12, backgroundColor: G.white },
  passwordInput: { flex: 1, height: 52, paddingHorizontal: 14, fontSize: 15, color: G.text },
  eyeBtn:        { padding: 12 },

  forgotWrap: { alignItems: "flex-end", marginBottom: 24, marginTop: -6 },
  forgotText: { fontSize: 13, color: G.dark, fontWeight: "600" },

  signInBtn:     { height: 54, borderRadius: 14, backgroundColor: G.primary, alignItems: "center", justifyContent: "center", shadowColor: G.dark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4, marginBottom: 20 },
  signInBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  registerRow:  { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  registerText: { fontSize: 14, color: G.sub },
  registerLink: { fontSize: 14, color: G.dark, fontWeight: "700" },
});