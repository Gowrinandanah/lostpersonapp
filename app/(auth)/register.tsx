import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Animated,
} from "react-native";
import { router, Stack } from "expo-router";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  PhoneAuthProvider,
  signInWithCredential,
  linkWithCredential,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../src/firebase/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { initializeApp, getApp } from "firebase/app";

const G = {
  primary: "#2ECC71", dark: "#27AE60", light: "#EAFAF1",
  white: "#FFFFFF", text: "#1A1A1A", sub: "#666666",
  muted: "#AAAAAA", error: "#E74C3C", border: "#E0E0E0",
  bg: "#F7F8FA",
};

// ── Step indicator ────────────────────────────────────────────────────────────

const StepIndicator = ({ current }: { current: number }) => (
  <View style={stepS.wrap}>
    {[1, 2, 3].map((s) => (
      <React.Fragment key={s}>
        <View style={[stepS.circle, current >= s && stepS.circleActive]}>
          {current > s
            ? <Text style={stepS.check}>✓</Text>
            : <Text style={[stepS.num, current === s && stepS.numActive]}>{s}</Text>
          }
        </View>
        {s < 3 && <View style={[stepS.line, current > s && stepS.lineActive]} />}
      </React.Fragment>
    ))}
  </View>
);

const stepS = StyleSheet.create({
  wrap:        { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 28 },
  circle:      { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: G.border, backgroundColor: G.white, alignItems: "center", justifyContent: "center" },
  circleActive:{ borderColor: G.primary, backgroundColor: G.primary },
  num:         { fontSize: 13, fontWeight: "700", color: G.muted },
  numActive:   { color: G.white },
  check:       { fontSize: 14, fontWeight: "900", color: G.white },
  line:        { flex: 1, height: 2, backgroundColor: G.border, marginHorizontal: 6 },
  lineActive:  { backgroundColor: G.primary },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const recaptchaVerifier = useRef<any>(null);

  // Step 1 — Account details
  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [confirmPass,  setConfirmPass]  = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  // Step 2 — Phone number
  const [phone,        setPhone]        = useState("");
  const [sending,      setSending]      = useState(false);
  const [verificationId, setVerificationId] = useState("");

  // Step 3 — OTP
  const [otp,          setOtp]          = useState(["", "", "", "", "", ""]);
  const otpRefs        = useRef<Array<TextInput | null>>([]);
  const [verifying,    setVerifying]    = useState(false);
  const [resending,    setResending]    = useState(false);

  const [step,         setStep]         = useState(1);
  const [createdUid,   setCreatedUid]   = useState("");

  // ── Step 1: Validate and create account ───────────────────────────────────

  const handleStep1 = async () => {
    if (!name.trim())             { Alert.alert("Missing field", "Please enter your name."); return; }
    if (!email.trim())            { Alert.alert("Missing field", "Please enter your email."); return; }
    if (password.length < 6)      { Alert.alert("Weak password", "Password must be at least 6 characters."); return; }
    if (password !== confirmPass)  { Alert.alert("Password mismatch", "Passwords do not match."); return; }

    // Check if email is already registered before going to step 2
    setSending(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email.trim());
      if (methods.length > 0) {
        Alert.alert("Email already registered", "An account with this email already exists. Please sign in instead.");
        return;
      }
      setStep(2);
    } catch (e: any) {
      Alert.alert("Error", "Could not verify email. Check your connection.");
    } finally {
      setSending(false);
    }
  };

  // ── Step 2: Send OTP (with phone uniqueness check) ────────────────────────

  const sendOtp = async () => {
    const cleaned = phone.trim().replace(/\s/g, "");
    const normalized = cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;

    if (cleaned.length < 10) {
      Alert.alert("Invalid number", "Please enter a valid phone number with country code.\nExample: +91 9876543210");
      return;
    }

    setSending(true);
    try {
      // Check if phone number already exists in Firestore users collection
      const phoneQuery = query(
        collection(db, "users"),
        where("phone", "==", normalized)
      );
      const existing = await getDocs(phoneQuery);
      if (!existing.empty) {
        Alert.alert(
          "Phone already registered",
          "An account with this phone number already exists. Please sign in instead."
        );
        return;
      }

      // Phone is unique — send OTP
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(
        normalized,
        recaptchaVerifier.current
      );
      setVerificationId(id);
      setStep(3);
    } catch (e: any) {
      if (e.message?.includes("already registered")) {
        // already handled above
      } else {
        Alert.alert("Failed to send OTP", e.message || "Check the phone number and try again.");
      }
    } finally {
      setSending(false);
    }
  };

  // ── Step 3: Verify OTP + create full account ──────────────────────────────

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      Alert.alert("Incomplete OTP", "Please enter all 6 digits.");
      return;
    }

    setVerifying(true);
    try {
      // 1. Create email/password account
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user     = userCred.user;

      // 2. Update display name
      await updateProfile(user, { displayName: name.trim() });

      // 3. Verify phone OTP and link to the account
      const phoneCredential = PhoneAuthProvider.credential(verificationId, code);
      await linkWithCredential(user, phoneCredential);

      // 4. Save user to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid:         user.uid,
        displayName: name.trim(),
        email:       email.trim(),
        phone:       phone.trim(),
        photoURL:    "",
        provider:    "email",
        role:        "user",
        phoneVerified: true,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });

      // Success — _layout.tsx auth guard will redirect to /alerts
      Alert.alert(
        "✅ Account Created!",
        `Welcome, ${name.trim()}! Your account has been verified.`,
        [{ text: "Get Started", onPress: () => router.replace("/alerts") }]
      );
    } catch (e: any) {
      const msg =
        e.code === "auth/invalid-verification-code" ? "Incorrect OTP. Please try again." :
        e.code === "auth/code-expired"              ? "OTP expired. Please request a new one." :
        e.code === "auth/email-already-in-use"      ? "This email is already registered." :
        e.code === "auth/credential-already-in-use" ? "This phone number is already linked to another account." :
        e.message || "Verification failed. Try again.";
      Alert.alert("Verification Failed", msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setOtp(["", "", "", "", "", ""]);
    await sendOtp();
    setResending(false);
  };

  // ── OTP input handler ──────────────────────────────────────────────────────

  const handleOtpChange = (val: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = val.replace(/[^0-9]/g, "");
    setOtp(newOtp);
    if (val && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Firebase reCAPTCHA — required for phone auth */}
      {/* Invisible reCAPTCHA — required by Firebase, hidden from user */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={auth.app.options}
        attemptInvisibleVerification={true}
      />

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
            {/* Header */}
            <LinearGradient colors={["#2ECC71", "#27AE60"]} style={S.header}>
              <Text style={S.appIcon}>🚨</Text>
              <Text style={S.appName}>Create Account</Text>
              <Text style={S.appTagline}>
                {step === 1 ? "Step 1 — Account details" :
                 step === 2 ? "Step 2 — Phone verification" :
                              "Step 3 — Enter OTP"}
              </Text>
            </LinearGradient>

            <View style={S.form}>
              <StepIndicator current={step} />

              {/* ── Step 1: Account details ── */}
              {step === 1 && (
                <>
                  <Field label="Full Name">
                    <TextInput
                      style={S.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Your full name"
                      placeholderTextColor={G.muted}
                      autoCapitalize="words"
                    />
                  </Field>

                  <Field label="Email">
                    <TextInput
                      style={S.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      placeholderTextColor={G.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </Field>

                  <Field label="Password">
                    <View style={S.passwordWrap}>
                      <TextInput
                        style={S.passwordInput}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="At least 6 characters"
                        placeholderTextColor={G.muted}
                        secureTextEntry={!showPass}
                      />
                      <TouchableOpacity onPress={() => setShowPass(v => !v)} style={S.eyeBtn}>
                        <Text style={{ fontSize: 18 }}>{showPass ? "🙈" : "👁"}</Text>
                      </TouchableOpacity>
                    </View>
                  </Field>

                  <Field label="Confirm Password">
                    <View style={S.passwordWrap}>
                      <TextInput
                        style={S.passwordInput}
                        value={confirmPass}
                        onChangeText={setConfirmPass}
                        placeholder="Repeat your password"
                        placeholderTextColor={G.muted}
                        secureTextEntry={!showConfirm}
                      />
                      <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={S.eyeBtn}>
                        <Text style={{ fontSize: 18 }}>{showConfirm ? "🙈" : "👁"}</Text>
                      </TouchableOpacity>
                    </View>
                  </Field>

                  <TouchableOpacity style={S.primaryBtn} onPress={handleStep1} activeOpacity={0.85}>
                    <Text style={S.primaryBtnText}>Continue →</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Step 2: Phone number ── */}
              {step === 2 && (
                <>
                  <View style={S.stepInfo}>
                    <Text style={S.stepInfoIcon}>📱</Text>
                    <Text style={S.stepInfoText}>
                      We'll send a 6-digit OTP to verify your phone number
                    </Text>
                  </View>

                  <Field label="Phone Number">
                    <TextInput
                      style={S.input}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="+91 9876543210"
                      placeholderTextColor={G.muted}
                      keyboardType="phone-pad"
                    />
                  </Field>

                  <Text style={S.hint}>
                    Include country code. India: +91, US: +1
                  </Text>

                  <TouchableOpacity
                    style={[S.primaryBtn, sending && { opacity: 0.6 }]}
                    onPress={sendOtp}
                    disabled={sending}
                    activeOpacity={0.85}
                  >
                    {sending
                      ? <View style={S.btnRow}>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text style={S.primaryBtnText}>  Sending OTP…</Text>
                        </View>
                      : <Text style={S.primaryBtnText}>Send OTP</Text>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setStep(1)} style={S.backBtn}>
                    <Text style={S.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Step 3: OTP entry ── */}
              {step === 3 && (
                <>
                  <View style={S.stepInfo}>
                    <Text style={S.stepInfoIcon}>🔐</Text>
                    <Text style={S.stepInfoText}>
                      OTP sent to {phone}. Enter the 6-digit code below.
                    </Text>
                  </View>

                  {/* OTP boxes */}
                  <View style={S.otpRow}>
                    {otp.map((digit, i) => (
                      <TextInput
                        key={i}
                        ref={(r) => { otpRefs.current[i] = r; }}
                        style={[S.otpBox, digit && S.otpBoxFilled]}
                        value={digit}
                        onChangeText={(v) => handleOtpChange(v, i)}
                        onKeyPress={(e) => handleOtpKeyPress(e, i)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        textAlign="center"
                      />
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[S.primaryBtn, verifying && { opacity: 0.6 }]}
                    onPress={handleVerifyOtp}
                    disabled={verifying}
                    activeOpacity={0.85}
                  >
                    {verifying
                      ? <View style={S.btnRow}>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text style={S.primaryBtnText}>  Verifying…</Text>
                        </View>
                      : <Text style={S.primaryBtnText}>✓ Verify & Create Account</Text>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={resending}
                    style={S.resendBtn}
                  >
                    <Text style={S.resendText}>
                      {resending ? "Resending…" : "Didn't receive it? Resend OTP"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setStep(2)} style={S.backBtn}>
                    <Text style={S.backBtnText}>← Change number</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Login link */}
              <View style={S.loginRow}>
                <Text style={S.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                  <Text style={S.loginLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={S.fieldWrap}>
    <Text style={S.label}>{label}</Text>
    {children}
  </View>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: G.bg },
  scroll: { flexGrow: 1 },

  header:     { paddingTop: 54, paddingBottom: 32, alignItems: "center" },
  appIcon:    { fontSize: 44, marginBottom: 8 },
  appName:    { fontSize: 22, fontWeight: "900", color: "#fff" },
  appTagline: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 },

  form: {
    backgroundColor: G.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    padding: 24,
    flex: 1,
    minHeight: 500,
  },

  fieldWrap:    { marginBottom: 16 },
  label:        { fontSize: 13, fontWeight: "700", color: G.text, marginBottom: 6 },
  input:        { height: 52, borderWidth: 1.5, borderColor: G.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: G.text, backgroundColor: G.white },
  passwordWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: G.border, borderRadius: 12, backgroundColor: G.white },
  passwordInput:{ flex: 1, height: 52, paddingHorizontal: 14, fontSize: 15, color: G.text },
  eyeBtn:       { padding: 12 },

  hint: { fontSize: 11, color: G.muted, marginTop: -10, marginBottom: 16, marginLeft: 2 },

  stepInfo:     { flexDirection: "row", alignItems: "center", backgroundColor: G.light, borderRadius: 12, padding: 14, marginBottom: 20, gap: 10 },
  stepInfoIcon: { fontSize: 24 },
  stepInfoText: { flex: 1, fontSize: 13, color: G.dark, lineHeight: 18 },

  // OTP
  otpRow:     { flexDirection: "row", gap: 10, justifyContent: "center", marginBottom: 24 },
  otpBox:     { width: 46, height: 56, borderWidth: 2, borderColor: G.border, borderRadius: 12, fontSize: 22, fontWeight: "800", color: G.text, backgroundColor: G.white, textAlign: "center" },
  otpBoxFilled:{ borderColor: G.primary, backgroundColor: G.light },

  primaryBtn:     { height: 54, borderRadius: 14, backgroundColor: G.primary, alignItems: "center", justifyContent: "center", shadowColor: G.dark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4, marginBottom: 12 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  btnRow:         { flexDirection: "row", alignItems: "center" },

  backBtn:     { alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  backBtnText: { fontSize: 14, color: G.sub, fontWeight: "600" },

  resendBtn:  { alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  resendText: { fontSize: 13, color: G.dark, fontWeight: "600" },

  loginRow:  { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8 },
  loginText: { fontSize: 14, color: G.sub },
  loginLink: { fontSize: 14, color: G.dark, fontWeight: "700" },
});