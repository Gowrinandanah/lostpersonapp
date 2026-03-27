import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from "react-native";
import { router, Stack } from "expo-router";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  useGoogleSignIn,
  handleGoogleSignInResponse,
} from "../../src/services/googleAuthService";

const G = {
  primary: "#2ECC71",
  dark: "#27AE60",
  white: "#FFFFFF",
  text: "#1A1A1A",
  sub: "#666666",
  muted: "#AAAAAA",
  error: "#E74C3C",
  border: "#E0E0E0",
  bg: "#F7F8FA",
  google: "#DB4437",
  googleDark: "#B3321F",
};

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Google Sign-In hook — identical to login, Google handles new vs existing
  const { request, response, promptAsync } = useGoogleSignIn();

  // Handle Google Sign-In response
  useEffect(() => {
    if (response) {
      setGoogleLoading(true);
      handleGoogleSignInResponse(
        response,
        () => {
          setGoogleLoading(false);
          router.replace("/");
        },
        (errorMessage) => {
          setGoogleLoading(false);
          Alert.alert("Google Sign-In Failed", errorMessage);
        }
      );
    }
  }, [response]);

  const handleRegister = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert("Missing field", "Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Missing field", "Please enter your email.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // Create the Firebase auth account
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Save display name to Firebase Auth profile
      await updateProfile(user, { displayName: name.trim() });

      // Save user to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: name.trim(),
        email: user.email || "",
        photoURL: "",
        phone: "",
        provider: "email",
        role: "user",
        emailVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });

      // Send verification email
      await sendEmailVerification(user);

      // Sign out immediately — force them to verify before accessing the app
      await auth.signOut();

      Alert.alert(
        "Verify your email",
        `A verification link has been sent to ${email.trim()}. Please check your inbox and verify before signing in.`,
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    } catch (e: any) {
      const msg =
        e.code === "auth/email-already-in-use"
          ? "An account with this email already exists."
          : e.code === "auth/invalid-email"
          ? "Invalid email address."
          : e.code === "auth/weak-password"
          ? "Password is too weak. Use at least 6 characters."
          : "Registration failed. Please try again.";
      Alert.alert("Registration Failed", msg);
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
      Alert.alert(
        "Google Sign-In Error",
        error.message || "Failed to start Google Sign-In"
      );
    }
  };

  return (
    <>
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
              <Text style={S.title}>Create account</Text>
              <Text style={S.subtitle}>Sign up to get started</Text>

              {/* Google Sign-In Button */}
              <TouchableOpacity
                style={[
                  S.googleBtn,
                  (googleLoading || !request) && { opacity: 0.6 },
                ]}
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

              {/* Divider */}
              <View style={S.divider}>
                <View style={S.dividerLine} />
                <Text style={S.dividerText}>or</Text>
                <View style={S.dividerLine} />
              </View>

              {/* Full Name */}
              <View style={S.fieldWrap}>
                <Text style={S.label}>Full Name</Text>
                <TextInput
                  style={S.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={G.muted}
                  autoCapitalize="words"
                  autoComplete="name"
                  editable={!loading && !googleLoading}
                />
              </View>

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
                  editable={!loading && !googleLoading}
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
                    placeholder="At least 6 characters"
                    placeholderTextColor={G.muted}
                    secureTextEntry={!showPassword}
                    editable={!loading && !googleLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    style={S.eyeBtn}
                    disabled={loading || googleLoading}
                  >
                    <Text style={{ fontSize: 18 }}>
                      {showPassword ? "🙈" : "👁"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={S.fieldWrap}>
                <Text style={S.label}>Confirm Password</Text>
                <View style={S.passwordWrap}>
                  <TextInput
                    style={S.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter your password"
                    placeholderTextColor={G.muted}
                    secureTextEntry={!showConfirm}
                    editable={!loading && !googleLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirm((v) => !v)}
                    style={S.eyeBtn}
                    disabled={loading || googleLoading}
                  >
                    <Text style={{ fontSize: 18 }}>
                      {showConfirm ? "🙈" : "👁"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Register button */}
              <TouchableOpacity
                style={[
                  S.registerBtn,
                  (loading || googleLoading) && { opacity: 0.6 },
                ]}
                onPress={handleRegister}
                disabled={loading || googleLoading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={S.registerBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Login link */}
              <View style={S.loginRow}>
                <Text style={S.loginText}>Already have an account? </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/login")}
                  disabled={loading || googleLoading}
                >
                  <Text style={S.loginLink}>Sign in</Text>
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
  root: { flex: 1, backgroundColor: G.bg },
  scroll: { flexGrow: 1 },

  header: { paddingTop: 60, paddingBottom: 40, alignItems: "center" },
  appIcon: { fontSize: 52, marginBottom: 8 },
  appName: { fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  appTagline: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 6 },

  form: {
    backgroundColor: G.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    padding: 28,
    flex: 1,
    minHeight: 460,
  },
  title: { fontSize: 24, fontWeight: "900", color: G.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: G.sub, marginBottom: 28 },

  // Google Button
  googleBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: G.google,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: G.googleDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 20,
  },
  googleIcon: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 32,
    height: 32,
    textAlign: "center",
    lineHeight: 32,
    borderRadius: 16,
  },
  googleBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Divider
  divider: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: G.border },
  dividerText: {
    marginHorizontal: 10,
    color: G.sub,
    fontSize: 14,
    fontWeight: "500",
  },

  fieldWrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: "700", color: G.text, marginBottom: 6 },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: G.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: G.text,
    backgroundColor: G.white,
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: G.border,
    borderRadius: 12,
    backgroundColor: G.white,
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 14,
    fontSize: 15,
    color: G.text,
  },
  eyeBtn: { padding: 12 },

  registerBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: G.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: G.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 20,
    marginTop: 4,
  },
  registerBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: { fontSize: 14, color: G.sub },
  loginLink: { fontSize: 14, color: G.dark, fontWeight: "700" },
});