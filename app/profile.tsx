// app/profile.tsx
//
// My Profile screen — redesigned with:
//   • Approved / Unapproved / All toggle for reported cases
//   • Premium editorial UI with refined card design
//   • Glass-morphism stat cards, animated gradient hero
//   • MyCaseDetailModal: 📋 Sightings | 🗺 Map tabs (unchanged logic)

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Alert,
  RefreshControl, useColorScheme, Modal, TextInput,
} from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import {
  collection, query, where, getDocs, orderBy,
  doc, getDoc, addDoc, Timestamp, serverTimestamp, setDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../src/firebase/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, ColorScheme } from "../src/constants/colors";

import {
  MapView,
  Camera,
  PointAnnotation,
  Callout,
} from "@maplibre/maplibre-react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Map style
// ─────────────────────────────────────────────────────────────────────────────

const OSM_MAP_STYLE = {
  version: 8 as const,
  sources: {
    "carto-voyager": {
      type: "raster" as const,
      tiles: ["https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "carto-voyager-layer", type: "raster" as const, source: "carto-voyager" },
  ],
};

const PIN = {
  case: "#E53935",
  sighting: "#1565C0",
  white: "#FFFFFF",
};

// ─────────────────────────────────────────────────────────────────────────────
// Teardrop Pin
// ─────────────────────────────────────────────────────────────────────────────

const TearDrop = ({ color, size = 22 }: { color: string; size?: number }) => (
  <View style={{ alignItems: "center", padding: 4 }}>
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, borderWidth: 2, borderColor: PIN.white,
      alignItems: "center", justifyContent: "center",
    }}>
      <View style={{
        width: size * 0.3, height: size * 0.3,
        borderRadius: size * 0.15, backgroundColor: "rgba(255,255,255,0.5)",
      }} />
    </View>
    <View style={{
      width: 0, height: 0,
      borderLeftWidth: size * 0.22, borderRightWidth: size * 0.22,
      borderTopWidth: size * 0.38,
      borderLeftColor: "transparent", borderRightColor: "transparent",
      borderTopColor: color, marginTop: -1,
    }} />
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MissingCase {
  id: string;
  name: string;
  age: number;
  gender: string;
  photoUrl?: string | null;
  lastSeenLocation: string;
  lastSeenDate: string;
  status: string;
  sightings: number;
  createdAt: Timestamp | null;
  isUrgentFlag?: boolean;
  isVulnerable?: boolean;
  approved?: boolean;   // legacy field (kept for compat)
  verified?: boolean;   // actual Firestore approval field
  coordinates?: { latitude: number; longitude: number } | null;
  lastSeenLat?: number | null;
  lastSeenLng?: number | null;
}

interface Sighting {
  id: string;
  caseId: string;
  sightingLocation: string;
  sightingDate: string;
  description: string;
  confidence: "low" | "medium" | "high";
  contactPhone?: string;
  photoUrl?: string | null;
  reportedByName: string;
  reportedBy: string;
  verified: boolean;
  createdAt: Timestamp | null;
  flagged?: boolean;
  faceMatchScore?: number;
  faceMatchLabel?: "high" | "medium" | "low";
  faceMatchColor?: string;
  isSamePerson?: boolean;
  faceMatchAttempted?: boolean;
  faceMatchError?: string | null;
  coordinates?: { latitude: number; longitude: number } | null;
  lat?: number | null;
  lng?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "Unknown";
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(ts: Timestamp | null): string {
  if (!ts) return "Unknown";
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function caseLatLng(c: MissingCase): { lat: number; lng: number } | null {
  const lat = c.coordinates?.latitude ?? c.lastSeenLat;
  const lng = c.coordinates?.longitude ?? c.lastSeenLng;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function sightingLatLng(s: Sighting): { lat: number; lng: number } | null {
  const lat = s.coordinates?.latitude ?? s.lat;
  const lng = s.coordinates?.longitude ?? s.lng;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

const CONFIDENCE_LABEL: Record<string, { label: string; color: string; icon: string }> = {
  low:    { label: "Not Sure",    color: "#F39C12", icon: "🤔" },
  medium: { label: "Fairly Sure", color: "#3498DB", icon: "👍" },
  high:   { label: "Very Sure",   color: "#27AE60", icon: "✅" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Face Match Badge
// ─────────────────────────────────────────────────────────────────────────────

const FaceMatchBadge = ({ sighting }: { sighting: Sighting }) => {
  if (!sighting.faceMatchAttempted) return null;
  if (sighting.faceMatchError || !sighting.faceMatchScore) {
    return (
      <View style={[fmbS.badge, { backgroundColor: "#F5F5F5", borderColor: "#DDD" }]}>
        <Text style={fmbS.icon}>📷</Text>
        <Text style={[fmbS.text, { color: "#888" }]}>No face data</Text>
      </View>
    );
  }
  const score = sighting.faceMatchScore;
  const color = sighting.faceMatchColor || "#888";
  const label =
    sighting.faceMatchLabel === "high"   ? "High match" :
    sighting.faceMatchLabel === "medium" ? "Possible match" : "Low match";
  return (
    <View style={[fmbS.badge, { backgroundColor: color + "18", borderColor: color }]}>
      <Text style={[fmbS.score, { color }]}>{score.toFixed(0)}%</Text>
      <Text style={[fmbS.text, { color }]}>{label}</Text>
      {sighting.isSamePerson && (
        <View style={[fmbS.matchDot, { backgroundColor: color }]} />
      )}
    </View>
  );
};
const fmbS = StyleSheet.create({
  badge:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1.5 },
  icon:     { fontSize: 12 },
  score:    { fontSize: 13, fontWeight: "900" },
  text:     { fontSize: 11, fontWeight: "700" },
  matchDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sighting Detail Modal
// ─────────────────────────────────────────────────────────────────────────────

const SightingDetailModal = ({
  visible, sighting, theme, onClose,
}: {
  visible: boolean; sighting: Sighting | null;
  theme: ColorScheme; onClose: () => void;
}) => {
  if (!sighting) return null;
  const conf = CONFIDENCE_LABEL[sighting.confidence] ?? CONFIDENCE_LABEL.medium;
  const score = sighting.faceMatchScore ?? 0;
  const color = sighting.faceMatchColor ?? "#888";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[sdS.root, { backgroundColor: theme.background }]}>
        <View style={[sdS.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={sdS.closeBtn}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.textSecondary }}>✕</Text>
          </TouchableOpacity>
          <Text style={[sdS.headerTitle, { color: theme.text }]}>Sighting Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={[sdS.faceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[sdS.sectionLabel, { color: theme.textSecondary }]}>🔍 FACE COMPARISON RESULT</Text>
            {sighting.faceMatchAttempted && !sighting.faceMatchError && score > 0 ? (
              <>
                <View style={[sdS.scoreCircle, { borderColor: color }]}>
                  <Text style={[sdS.scoreNumber, { color }]}>{score.toFixed(0)}%</Text>
                  <Text style={[sdS.scoreWord, { color }]}>match</Text>
                </View>
                <View style={[sdS.scoreLabelBadge, { backgroundColor: color + "18", borderColor: color }]}>
                  <Text style={[sdS.scoreLabelText, { color }]}>
                    {sighting.faceMatchLabel === "high" ? "High Match" :
                     sighting.faceMatchLabel === "medium" ? "Possible Match" : "Low Match"}
                  </Text>
                </View>
                <Text style={[sdS.scoreInterpret, { color: theme.textSecondary }]}>
                  {sighting.isSamePerson
                    ? "⚠️ High probability this is the missing person."
                    : score >= 60
                    ? "🔍 Moderate similarity detected. Worth investigating."
                    : "ℹ️ Low facial similarity. May not be the same person."}
                </Text>
              </>
            ) : (
              <View style={sdS.noFaceWrap}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>📷</Text>
                <Text style={[sdS.noFaceText, { color: theme.textSecondary }]}>
                  {sighting.faceMatchError ?? "No photo attached — face comparison skipped."}
                </Text>
              </View>
            )}
          </View>
          {sighting.photoUrl ? (
            <View style={[sdS.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[sdS.sectionLabel, { color: theme.textSecondary }]}>📷 SIGHTING PHOTO</Text>
              <Image source={{ uri: sighting.photoUrl }} style={sdS.photo} resizeMode="cover" />
            </View>
          ) : null}
          <View style={[sdS.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[sdS.sectionLabel, { color: theme.textSecondary }]}>📍 LOCATION & TIME</Text>
            <View style={sdS.detailRow}>
              <Text style={sdS.detailIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={[sdS.detailLabel, { color: theme.textSecondary }]}>Where</Text>
                <Text style={[sdS.detailValue, { color: theme.text }]}>{sighting.sightingLocation}</Text>
              </View>
            </View>
            <View style={sdS.detailRow}>
              <Text style={sdS.detailIcon}>🕐</Text>
              <View style={{ flex: 1 }}>
                <Text style={[sdS.detailLabel, { color: theme.textSecondary }]}>When</Text>
                <Text style={[sdS.detailValue, { color: theme.text }]}>{sighting.sightingDate}</Text>
              </View>
            </View>
            {sighting.coordinates && (
              <View style={sdS.detailRow}>
                <Text style={sdS.detailIcon}>🛰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[sdS.detailLabel, { color: theme.textSecondary }]}>GPS</Text>
                  <Text style={[sdS.detailValue, { color: theme.text }]}>
                    {sighting.coordinates.latitude.toFixed(5)}, {sighting.coordinates.longitude.toFixed(5)}
                  </Text>
                </View>
              </View>
            )}
          </View>
          <View style={[sdS.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[sdS.sectionLabel, { color: theme.textSecondary }]}>📝 DESCRIPTION</Text>
            <Text style={[sdS.description, { color: theme.text }]}>{sighting.description}</Text>
          </View>
          <View style={[sdS.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[sdS.sectionLabel, { color: theme.textSecondary }]}>👤 REPORTER</Text>
            <View style={sdS.detailRow}>
              <Text style={sdS.detailIcon}>👤</Text>
              <View style={{ flex: 1 }}>
                <Text style={[sdS.detailLabel, { color: theme.textSecondary }]}>Reported By</Text>
                <Text style={[sdS.detailValue, { color: theme.text }]}>{sighting.reportedByName || "Anonymous"}</Text>
              </View>
            </View>
            <View style={sdS.detailRow}>
              <Text style={sdS.detailIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={[sdS.detailLabel, { color: theme.textSecondary }]}>Submitted</Text>
                <Text style={[sdS.detailValue, { color: theme.text }]}>{formatDate(sighting.createdAt)}</Text>
              </View>
            </View>
            {sighting.contactPhone ? (
              <View style={sdS.detailRow}>
                <Text style={sdS.detailIcon}>📞</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[sdS.detailLabel, { color: theme.textSecondary }]}>Contact</Text>
                  <Text style={[sdS.detailValue, { color: theme.text }]}>{sighting.contactPhone}</Text>
                </View>
              </View>
            ) : null}
            <View style={[sdS.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={sdS.detailIcon}>{conf.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[sdS.detailLabel, { color: theme.textSecondary }]}>Confidence</Text>
                <Text style={[sdS.detailValue, { color: conf.color }]}>{conf.label}</Text>
              </View>
            </View>
          </View>
          <View style={[sdS.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[sdS.sectionLabel, { color: theme.textSecondary }]}>🔖 STATUS</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {sighting.verified && (
                <View style={[sdS.statusPill, { backgroundColor: "#EAFAF1", borderColor: "#27AE60" }]}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#27AE60" }}>✓ Verified</Text>
                </View>
              )}
              {sighting.flagged && (
                <View style={[sdS.statusPill, { backgroundColor: "#FFF3CD", borderColor: "#F39C12" }]}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#F39C12" }}>⚑ Flagged</Text>
                </View>
              )}
              {!sighting.verified && !sighting.flagged && (
                <View style={[sdS.statusPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: theme.textSecondary }}>⏳ Pending</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const sdS = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "800", textAlign: "center" },
  card: { borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1 },
  faceCard: { borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, alignItems: "center" },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 14, alignSelf: "flex-start" },
  scoreCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 5, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  scoreNumber: { fontSize: 32, fontWeight: "900" },
  scoreWord: { fontSize: 12, fontWeight: "600" },
  scoreLabelBadge: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, marginBottom: 12 },
  scoreLabelText: { fontSize: 14, fontWeight: "700" },
  scoreInterpret: { fontSize: 13, textAlign: "center", lineHeight: 19, paddingHorizontal: 8 },
  noFaceWrap: { alignItems: "center", paddingVertical: 8 },
  noFaceText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  photo: { width: "100%", height: 200, borderRadius: 10 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  detailIcon: { fontSize: 18, width: 26, marginTop: 1 },
  detailLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  description: { fontSize: 14, lineHeight: 21 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sighting Card
// ─────────────────────────────────────────────────────────────────────────────

const SightingCard = ({
  item, theme, onPress, onReport,
}: {
  item: Sighting; theme: ColorScheme;
  onPress: () => void; onReport: (s: Sighting) => void;
}) => {
  const conf = CONFIDENCE_LABEL[item.confidence] ?? CONFIDENCE_LABEL.medium;
  return (
    <TouchableOpacity
      style={[sightS.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={sightS.header}>
        <View style={[sightS.avatarCircle, { backgroundColor: theme.border }]}>
          <Text style={{ fontSize: 18 }}>👤</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[sightS.reporter, { color: theme.text }]}>{item.reportedByName || "Anonymous"}</Text>
          <Text style={[sightS.time, { color: theme.textSecondary }]}>{timeAgo(item.createdAt)}</Text>
        </View>
        <View style={[sightS.confBadge, { backgroundColor: `${conf.color}22`, borderColor: conf.color }]}>
          <Text style={{ fontSize: 12 }}>{conf.icon}</Text>
          <Text style={[sightS.confText, { color: conf.color }]}>{conf.label}</Text>
        </View>
      </View>
      {item.faceMatchAttempted && (
        <View style={sightS.faceMatchRow}>
          <FaceMatchBadge sighting={item} />
          {item.isSamePerson && (
            <View style={sightS.alertBadge}>
              <Text style={sightS.alertBadgeText}>⚠️ Likely Match!</Text>
            </View>
          )}
          <Text style={[sightS.tapHint, { color: theme.textSecondary }]}>Tap for details →</Text>
        </View>
      )}
      <View style={sightS.metaRow}>
        <Text style={[sightS.metaItem, { color: theme.textSecondary }]} numberOfLines={1}>📍 {item.sightingLocation}</Text>
        <Text style={[sightS.metaItem, { color: theme.textSecondary }]}>🕐 {item.sightingDate}</Text>
      </View>
      <Text style={[sightS.desc, { color: theme.text }]} numberOfLines={2}>{item.description}</Text>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={sightS.photo} resizeMode="cover" />
      ) : null}
      <View style={sightS.footer}>
        {item.verified && (
          <View style={sightS.verifiedBadge}>
            <Text style={sightS.verifiedText}>✓ Verified</Text>
          </View>
        )}
        {item.flagged && (
          <View style={sightS.flaggedBadge}>
            <Text style={sightS.flaggedText}>⚑ Reported</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {!item.flagged && (
          <TouchableOpacity
            style={[sightS.reportBtn, { borderColor: theme.error ?? "#E74C3C" }]}
            onPress={() => onReport(item)}
            activeOpacity={0.8}
          >
            <Text style={[sightS.reportBtnText, { color: theme.error ?? "#E74C3C" }]}>⚑ Report</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const sightS = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  reporter: { fontSize: 13, fontWeight: "700" },
  time: { fontSize: 11, marginTop: 1 },
  confBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  confText: { fontSize: 11, fontWeight: "700" },
  faceMatchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  alertBadge: { backgroundColor: "#FDECEA", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#E74C3C" },
  alertBadgeText: { fontSize: 11, fontWeight: "800", color: "#E74C3C" },
  tapHint: { fontSize: 11, marginLeft: "auto" as any },
  metaRow: { gap: 4, marginBottom: 8 },
  metaItem: { fontSize: 12 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  photo: { width: "100%", height: 120, borderRadius: 10, marginBottom: 10 },
  footer: { flexDirection: "row", alignItems: "center", gap: 8 },
  verifiedBadge: { backgroundColor: "#EAFAF1", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#27AE60" },
  verifiedText: { fontSize: 11, fontWeight: "700", color: "#27AE60" },
  flaggedBadge: { backgroundColor: "#FFF3CD", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#F39C12" },
  flaggedText: { fontSize: 11, fontWeight: "700", color: "#F39C12" },
  reportBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5 },
  reportBtnText: { fontSize: 12, fontWeight: "700" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Case Card — redesigned, premium look
// ─────────────────────────────────────────────────────────────────────────────

const CaseCard = ({
  item, theme, onPress,
}: {
  item: MissingCase; theme: ColorScheme; onPress: () => void;
}) => {
  const days = item.createdAt
    ? Math.floor((Date.now() - (item.createdAt instanceof Timestamp ? item.createdAt.toDate() : new Date(item.createdAt as any)).getTime()) / 86400000)
    : 0;
  const urgent = item.isUrgentFlag || item.isVulnerable || item.age < 18 || item.age > 65;
  const resolved = item.status === "found" || item.status === "resolved";
  const approved = item.verified === true || item.approved === true;

  return (
    <TouchableOpacity
      style={[
        caseS.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        urgent && !resolved && { borderLeftColor: "#E74C3C", borderLeftWidth: 4 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Left: Photo */}
      <View style={caseS.photoWrap}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={caseS.photo} />
        ) : (
          <View style={[caseS.photoPlaceholder, { backgroundColor: theme.surface }]}>
            <Text style={{ fontSize: 26 }}>👤</Text>
          </View>
        )}
        {/* Approval badge on photo */}
        <View style={[
          caseS.approvalMicroBadge,
          { backgroundColor: approved ? "#27AE60" : "#F39C12" },
        ]}>
          <Text style={{ fontSize: 8, color: "#fff", fontWeight: "900" }}>
            {approved ? "✓" : "⏳"}
          </Text>
        </View>
      </View>

      {/* Right: Info */}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={caseS.nameRow}>
          <Text style={[caseS.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
          {urgent && !resolved && <View style={caseS.urgentDot} />}
        </View>
        <Text style={[caseS.meta, { color: theme.textSecondary }]}>
          {item.age} yrs · {item.gender}
        </Text>
        <Text style={[caseS.location, { color: theme.textSecondary }]} numberOfLines={1}>
          📍 {item.lastSeenLocation}
        </Text>
        <View style={caseS.pillsRow}>
          {/* Status pill */}
          <View style={[caseS.pill, { backgroundColor: resolved ? "#EAFAF1" : "#FFF5E6", borderColor: resolved ? "#27AE60" : "#E67E22" }]}>
            <Text style={[caseS.pillText, { color: resolved ? "#27AE60" : "#E67E22" }]}>
              {resolved ? "✅ Found" : `⏳ ${days}d`}
            </Text>
          </View>
          {/* Sightings pill */}
          {item.sightings > 0 && (
            <View style={[caseS.pill, { backgroundColor: "#EBF5FB", borderColor: "#2980B9" }]}>
              <Text style={[caseS.pillText, { color: "#2980B9" }]}>👁 {item.sightings}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={{ color: theme.textSecondary, fontSize: 18, alignSelf: "center" }}>›</Text>
    </TouchableOpacity>
  );
};

const caseS = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, padding: 12, marginBottom: 10,
    borderWidth: 1, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  photoWrap: { position: "relative" },
  photo: { width: 58, height: 70, borderRadius: 12 },
  photoPlaceholder: { width: 58, height: 70, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  approvalMicroBadge: {
    position: "absolute", bottom: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 14, fontWeight: "800", flex: 1 },
  urgentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E74C3C" },
  meta: { fontSize: 11 },
  location: { fontSize: 11 },
  pillsRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: "700" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Report Malicious Sighting Modal
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_REASONS = [
  "This location is completely wrong",
  "Description doesn't match at all",
  "This appears to be spam",
  "Reporter is spreading false information",
  "This sighting is fabricated",
  "Other malicious intent",
];

const ReportModal = ({
  visible, sighting, theme, onClose, onSubmit,
}: {
  visible: boolean; sighting: Sighting | null;
  theme: ColorScheme; onClose: () => void;
  onSubmit: (reason: string) => void;
}) => {
  const [selected, setSelected] = useState("");
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={rmodalS.overlay}>
        <View style={[rmodalS.sheet, { backgroundColor: theme.card }]}>
          <Text style={[rmodalS.title, { color: theme.text }]}>Report Misleading Sighting</Text>
          <Text style={[rmodalS.sub, { color: theme.textSecondary }]}>
            Select the reason this sighting is false or malicious:
          </Text>
          {REPORT_REASONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[rmodalS.reasonRow, { borderColor: selected === r ? "#E74C3C" : theme.border }, selected === r && { backgroundColor: "#FDECEA" }]}
              onPress={() => setSelected(r)}
              activeOpacity={0.8}
            >
              <View style={[rmodalS.radio, { borderColor: selected === r ? "#E74C3C" : theme.border }]}>
                {selected === r && <View style={rmodalS.radioFill} />}
              </View>
              <Text style={[rmodalS.reasonText, { color: theme.text }]}>{r}</Text>
            </TouchableOpacity>
          ))}
          <View style={rmodalS.btnRow}>
            <TouchableOpacity style={[rmodalS.cancelBtn, { borderColor: theme.border }]} onPress={onClose}>
              <Text style={[rmodalS.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rmodalS.submitBtn, !selected && { opacity: 0.4 }]}
              onPress={() => { if (selected) { onSubmit(selected); setSelected(""); } }}
              disabled={!selected}
            >
              <Text style={rmodalS.submitText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const rmodalS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  sub: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioFill: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#E74C3C" },
  reasonText: { fontSize: 14, flex: 1 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  cancelText: { fontWeight: "700" },
  submitBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#E74C3C", alignItems: "center", justifyContent: "center" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Case Sightings Map
// ─────────────────────────────────────────────────────────────────────────────

const CaseSightingsMap = ({
  caseItem, sightings,
}: {
  caseItem: MissingCase; sightings: Sighting[];
}) => {
  const casePt = caseLatLng(caseItem);
  const sightPts = sightings.map(sightingLatLng).filter(Boolean) as { lat: number; lng: number }[];
  const centre: [number, number] = casePt
    ? [casePt.lng, casePt.lat]
    : sightPts.length > 0 ? [sightPts[0].lng, sightPts[0].lat]
    : [76.2711, 10.8505];
  const hasAnyPin = casePt != null || sightPts.length > 0;

  return (
    <View style={mapS.root}>
      <View style={mapS.legend}>
        <View style={[mapS.legendDot, { backgroundColor: PIN.case }]} />
        <Text style={mapS.legendText}>Last seen</Text>
        <View style={[mapS.legendDot, { backgroundColor: PIN.sighting, marginLeft: 12 }]} />
        <Text style={mapS.legendText}>Sighting</Text>
      </View>
      {!hasAnyPin ? (
        <View style={mapS.noLocation}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🗺</Text>
          <Text style={mapS.noLocationText}>No GPS coordinates available.</Text>
        </View>
      ) : (
        <MapView style={{ flex: 1 }} mapStyle={OSM_MAP_STYLE} logoEnabled={false} attributionEnabled={false} compassEnabled={false}>
          <Camera centerCoordinate={centre} zoomLevel={10} animationMode="moveTo" />
          {casePt && (
            <PointAnnotation id={`profile-case-${caseItem.id}`} coordinate={[casePt.lng, casePt.lat]}>
              <TearDrop color={PIN.case} size={24} />
              <Callout>
                <View style={mapS.callout}>
                  <View style={[mapS.calloutStrip, { backgroundColor: PIN.case }]}>
                    <Text style={mapS.calloutStripText}>LAST SEEN</Text>
                  </View>
                  <View style={mapS.calloutBody}>
                    <Text style={mapS.calloutName}>{caseItem.name}</Text>
                    <Text style={mapS.calloutMeta} numberOfLines={2}>📍 {caseItem.lastSeenLocation}</Text>
                    <Text style={mapS.calloutMeta}>🕐 {caseItem.lastSeenDate}</Text>
                  </View>
                </View>
              </Callout>
            </PointAnnotation>
          )}
          {sightings.map((s) => {
            const pt = sightingLatLng(s);
            if (!pt) return null;
            const conf = CONFIDENCE_LABEL[s.confidence] ?? CONFIDENCE_LABEL.medium;
            return (
              <PointAnnotation key={`profile-sighting-${s.id}`} id={`profile-sighting-${s.id}`} coordinate={[pt.lng, pt.lat]}>
                <TearDrop color={PIN.sighting} size={20} />
                <Callout>
                  <View style={mapS.callout}>
                    <View style={[mapS.calloutStrip, { backgroundColor: PIN.sighting }]}>
                      <Text style={mapS.calloutStripText}>SIGHTING</Text>
                    </View>
                    <View style={mapS.calloutBody}>
                      <Text style={mapS.calloutName} numberOfLines={1}>📍 {s.sightingLocation || "Unknown"}</Text>
                      <Text style={mapS.calloutMeta}>🕐 {s.sightingDate}</Text>
                      <Text style={mapS.calloutMeta} numberOfLines={2}>{s.description}</Text>
                      <Text style={[mapS.calloutConf, { color: conf.color }]}>{conf.icon} {conf.label}</Text>
                    </View>
                  </View>
                </Callout>
              </PointAnnotation>
            );
          })}
        </MapView>
      )}
      {sightPts.length > 0 && (
        <View style={mapS.countBadge}>
          <Text style={mapS.countText}>👁 {sightPts.length}/{sightings.length} mapped</Text>
        </View>
      )}
    </View>
  );
};

const mapS = StyleSheet.create({
  root: { flex: 1 },
  legend: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F8F8F8", borderBottomWidth: 1, borderBottomColor: "#EEEEEE", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#555", fontWeight: "600" },
  noLocation: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  noLocationText: { fontSize: 13, color: "#777", textAlign: "center", lineHeight: 19 },
  callout: { width: 210, borderRadius: 10, overflow: "hidden", backgroundColor: "#fff" },
  calloutStrip: { paddingHorizontal: 12, paddingVertical: 5, alignItems: "center" },
  calloutStripText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  calloutBody: { padding: 10 },
  calloutName: { fontSize: 13, fontWeight: "800", color: "#1A1A1A", marginBottom: 3 },
  calloutMeta: { fontSize: 11, color: "#666", marginBottom: 2, lineHeight: 15 },
  calloutConf: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  countBadge: { position: "absolute", bottom: 10, left: 10, backgroundColor: "rgba(255,255,255,0.93)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#DDD", elevation: 2 },
  countText: { fontSize: 11, fontWeight: "700", color: "#1565C0" },
});

// ─────────────────────────────────────────────────────────────────────────────
// My Case Detail Modal
// ─────────────────────────────────────────────────────────────────────────────

type DetailTab = "list" | "map";

const MyCaseDetailModal = ({
  visible, caseItem, theme, onClose,
}: {
  visible: boolean; caseItem: MissingCase | null;
  theme: ColorScheme; onClose: () => void;
}) => {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loadingSightings, setLoadingSightings] = useState(false);
  const [reportTarget, setReportTarget] = useState<Sighting | null>(null);
  const [reportModal, setReportModal] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [selectedSighting, setSelectedSighting] = useState<Sighting | null>(null);
  const [sightingDetail, setSightingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("list");

  useEffect(() => {
    if (!caseItem) return;
    setActiveTab("list");
    setLoadingSightings(true);
    (async () => {
      try {
        const q = query(
          collection(db, "sightings"),
          where("caseId", "==", caseItem.id),
          orderBy("createdAt", "desc"),
        );
        const snap = await getDocs(q);
        setSightings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sighting)));
      } catch (e) { console.error(e); }
      finally { setLoadingSightings(false); }
    })();
  }, [caseItem?.id]);

  const handleReportSighting = async (reason: string) => {
    if (!reportTarget || !caseItem) return;
    setSubmittingReport(true);
    try {
      await addDoc(collection(db, "sightingReports"), {
        sightingId: reportTarget.id, caseId: caseItem.id,
        reportedBy: auth.currentUser?.uid,
        reportedByName: auth.currentUser?.displayName || "Anonymous",
        accusedUserId: reportTarget.reportedBy,
        accusedUserName: reportTarget.reportedByName,
        reason, createdAt: serverTimestamp(), status: "pending",
      });
      setSightings((prev) => prev.map((s) => s.id === reportTarget.id ? { ...s, flagged: true } : s));
      setReportModal(false);
      setReportTarget(null);
      Alert.alert("Report Submitted", "This sighting has been flagged for admin review.", [{ text: "OK" }]);
    } catch {
      Alert.alert("Error", "Failed to submit report. Try again.");
    } finally { setSubmittingReport(false); }
  };

  const resolved = caseItem?.status === "found" || caseItem?.status === "resolved";
  const sortedSightings = [...sightings].sort((a, b) => (b.faceMatchScore ?? 0) - (a.faceMatchScore ?? 0));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[detailS.root, { backgroundColor: theme.background }]}>

        {/* Header */}
        <View style={[detailS.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={detailS.closeBtn}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: theme.textSecondary }}>✕</Text>
          </TouchableOpacity>
          <Text style={[detailS.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {caseItem?.name ?? "Case Details"}
          </Text>
          <TouchableOpacity
            onPress={() => { onClose(); router.push({ pathname: "/case-details", params: { id: caseItem?.id } }); }}
            style={detailS.viewFullBtn}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: theme.primary }}>Full View</Text>
          </TouchableOpacity>
        </View>

        {/* Case banner */}
        {caseItem && (
          <View style={[detailS.banner, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {caseItem.photoUrl ? (
              <Image source={{ uri: caseItem.photoUrl }} style={detailS.bannerPhoto} />
            ) : (
              <View style={[detailS.bannerPhotoPlaceholder, { backgroundColor: theme.border }]}>
                <Text style={{ fontSize: 28 }}>👤</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[detailS.bannerName, { color: theme.text }]}>{caseItem.name}</Text>
              <Text style={[detailS.bannerMeta, { color: theme.textSecondary }]}>{caseItem.age} yrs · {caseItem.gender}</Text>
              <Text style={[detailS.bannerLocation, { color: theme.textSecondary }]} numberOfLines={1}>
                📍 {caseItem.lastSeenLocation}
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <View style={[detailS.statusPill, { backgroundColor: resolved ? "#EAFAF1" : "#FFF3CD" }]}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: resolved ? "#27AE60" : "#856404" }}>
                    {resolved ? "✅ Found" : "⏳ Active"}
                  </Text>
                </View>
                <View style={[detailS.statusPill, { backgroundColor: "#EBF5FB" }]}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#2980B9" }}>
                    👁 {caseItem.sightings} sighting{caseItem.sightings !== 1 ? "s" : ""}
                  </Text>
                </View>
                {/* Approval badge in detail modal */}
                <View style={[detailS.statusPill, {
                  backgroundColor: (caseItem.verified || caseItem.approved) ? "#EAFAF1" : "#FFF8E7",
                }]}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: (caseItem.verified || caseItem.approved) ? "#27AE60" : "#E67E22" }}>
                    {(caseItem.verified || caseItem.approved) ? "✅ Approved" : "⏳ Under Review"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Tab bar */}
        <View style={[detailS.tabBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[detailS.tab, activeTab === "list" && detailS.tabActive]}
            onPress={() => setActiveTab("list")}
            activeOpacity={0.8}
          >
            <Text style={[detailS.tabText, activeTab === "list" && { color: theme.primary }]}>
              📋  Sightings
            </Text>
            {sightings.length > 0 && (
              <View style={[detailS.tabBadge, { backgroundColor: theme.primary }]}>
                <Text style={detailS.tabBadgeText}>{sightings.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[detailS.tab, activeTab === "map" && detailS.tabActive]}
            onPress={() => setActiveTab("map")}
            activeOpacity={0.8}
          >
            <Text style={[detailS.tabText, activeTab === "map" && { color: theme.primary }]}>
              🗺  Map
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab content */}
        {activeTab === "list" ? (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={detailS.sectionHeader}>
              <Text style={[detailS.sectionTitle, { color: theme.text }]}>👁 Sighting Reports</Text>
              {sightings.length > 0 && (
                <Text style={[detailS.sectionCount, { color: theme.textSecondary }]}>
                  {sightings.length} total · sorted by match score
                </Text>
              )}
            </View>
            {loadingSightings ? (
              <View style={{ alignItems: "center", padding: 32 }}>
                <ActivityIndicator color={theme.primary} />
                <Text style={{ color: theme.textSecondary, marginTop: 8 }}>Loading sightings…</Text>
              </View>
            ) : sortedSightings.length === 0 ? (
              <View style={[detailS.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🔍</Text>
                <Text style={[detailS.emptyTitle, { color: theme.text }]}>No sightings yet</Text>
                <Text style={[detailS.emptySub, { color: theme.textSecondary }]}>
                  Sighting reports from the public will appear here
                </Text>
              </View>
            ) : (
              sortedSightings.map((s) => (
                <SightingCard
                  key={s.id} item={s} theme={theme}
                  onPress={() => { setSelectedSighting(s); setSightingDetail(true); }}
                  onReport={(sighting) => { setReportTarget(sighting); setReportModal(true); }}
                />
              ))
            )}
          </ScrollView>
        ) : (
          loadingSightings ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={theme.primary} />
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>Loading map data…</Text>
            </View>
          ) : caseItem ? (
            <CaseSightingsMap caseItem={caseItem} sightings={sightings} />
          ) : null
        )}

        <SightingDetailModal
          visible={sightingDetail} sighting={selectedSighting} theme={theme}
          onClose={() => { setSightingDetail(false); setSelectedSighting(null); }}
        />
        <ReportModal
          visible={reportModal} sighting={reportTarget} theme={theme}
          onClose={() => { setReportModal(false); setReportTarget(null); }}
          onSubmit={handleReportSighting}
        />
      </View>
    </Modal>
  );
};

const detailS = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "800", textAlign: "center", marginHorizontal: 8 },
  viewFullBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  banner: { flexDirection: "row", padding: 12, borderBottomWidth: 1, gap: 12 },
  bannerPhoto: { width: 64, height: 78, borderRadius: 10 },
  bannerPhotoPlaceholder: { width: 64, height: 78, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bannerName: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  bannerMeta: { fontSize: 12, marginBottom: 2 },
  bannerLocation: { fontSize: 12 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 6 },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: "#27AE60" },
  tabText: { fontSize: 14, fontWeight: "700", color: "#888" },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: "center" },
  tabBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  sectionCount: { fontSize: 11 },
  emptyCard: { borderRadius: 14, padding: 32, alignItems: "center", borderWidth: 1 },
  emptyTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Case Filter Tabs — Approved / Unapproved / All
// ─────────────────────────────────────────────────────────────────────────────

type CaseFilter = "all" | "approved" | "pending";

const CaseFilterBar = ({
  activeFilter, onSelect, theme,
  counts,
}: {
  activeFilter: CaseFilter;
  onSelect: (f: CaseFilter) => void;
  theme: ColorScheme;
  counts: { all: number; approved: number; pending: number };
}) => {
  const tabs: { key: CaseFilter; label: string; icon: string; color: string }[] = [
    { key: "all",      label: "All",        icon: "📋", color: theme.primary },
    { key: "approved", label: "Approved",   icon: "✅", color: "#27AE60" },
    { key: "pending",  label: "Under Review", icon: "⏳", color: "#E67E22" },
  ];

  return (
    <View style={filterS.container}>
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.key;
        const count = counts[tab.key];
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              filterS.tab,
              { borderColor: isActive ? tab.color : theme.border },
              isActive && { backgroundColor: tab.color + "12" },
            ]}
            onPress={() => onSelect(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13 }}>{tab.icon}</Text>
            <Text style={[filterS.tabLabel, { color: isActive ? tab.color : theme.textSecondary }]}>
              {tab.label}
            </Text>
            {count > 0 && (
              <View style={[filterS.badge, { backgroundColor: isActive ? tab.color : theme.border }]}>
                <Text style={[filterS.badgeText, { color: isActive ? "#fff" : theme.textSecondary }]}>
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const filterS = StyleSheet.create({
  container: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 9, paddingHorizontal: 6,
    borderRadius: 12, borderWidth: 1.5,
  },
  tabLabel: { fontSize: 11, fontWeight: "800" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: "900" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Activity Row — compact recent activity indicator
// ─────────────────────────────────────────────────────────────────────────────

const ActivityPulse = ({ color }: { color: string }) => (
  <View style={[actS.dot, { backgroundColor: color }]} />
);
const actS = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Profile Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme: ColorScheme = isDark ? Colors.dark : Colors.light;

  const user = auth.currentUser;

  const [cases,        setCases]        = useState<MissingCase[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [selectedCase, setSelectedCase] = useState<MissingCase | null>(null);
  const [caseModal,    setCaseModal]    = useState(false);
  const [caseFilter,   setCaseFilter]   = useState<CaseFilter>("all");

  // ── Phone edit state ──
  const [phone,        setPhone]        = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput,   setPhoneInput]   = useState("");
  const [savingPhone,  setSavingPhone]  = useState(false);

  // ── Fetch user doc from Firestore (for phone) ──
  const loadUserProfile = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) setPhone(snap.data()?.phone ?? "");
    } catch (e) { console.error(e); }
  }, [user?.uid]);

  const loadCases = useCallback(async () => {
    if (!user) return;
    try {
      const q    = query(
        collection(db, "missingPersons"),
        where("reportedBy", "==", user.uid),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      setCases(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MissingCase)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.uid]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadCases();
    loadUserProfile();
  }, [loadCases, loadUserProfile]));

  const handleRefresh = () => { setRefreshing(true); loadCases(); loadUserProfile(); };

  const handleSavePhone = async () => {
    if (!user) return;
    setSavingPhone(true);
    try {
      await setDoc(doc(db, "users", user.uid), { phone: phoneInput }, { merge: true });
      setPhone(phoneInput);
      setEditingPhone(false);
      Alert.alert("Saved", "Phone number updated.");
    } catch {
      Alert.alert("Error", "Could not save phone number.");
    } finally { setSavingPhone(false); }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => { await signOut(auth); router.replace("/(auth)/login"); },
      },
    ]);
  };

  // ── Derived counts ──
  const activeCases    = cases.filter((c) => c.status === "active");
  const resolvedCases  = cases.filter((c) => c.status === "found" || c.status === "resolved");
  const approvedCases  = cases.filter((c) => c.verified === true || c.approved === true);
  const pendingCases   = cases.filter((c) => !c.verified && !c.approved);
  const totalSightings = cases.reduce((sum, c) => sum + (c.sightings || 0), 0);

  const filterCounts = { all: cases.length, approved: approvedCases.length, pending: pendingCases.length };

  const displayedCases =
    caseFilter === "approved" ? approvedCases :
    caseFilter === "pending"  ? pendingCases  :
    cases;

  if (!user) {
    return (
      <SafeAreaView style={[S.root, { backgroundColor: theme.background }]}>
        <View style={S.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🔒</Text>
          <Text style={[S.emptyTitle, { color: theme.text }]}>Not signed in</Text>
          <TouchableOpacity style={[S.signInBtn, { backgroundColor: theme.primary }]} onPress={() => router.push("/(auth)/login")}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Provider label
  const provider = user.providerData[0]?.providerId === "google.com" ? "Google" : "Email";
  const joinDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "—";

  return (
    <SafeAreaView style={[S.root, { backgroundColor: theme.background }]} edges={["top", "left", "right"]}>
      <Stack.Screen options={{
        headerShown: false,
      }} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 52 }}
      >
        {/* ══════════════════════════════════════════
            HERO — compact, left-aligned, clean
        ══════════════════════════════════════════ */}
        <LinearGradient
          colors={isDark ? ["#0C180C", "#162016"] : ["#1B5E35", "#27AE60"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={S.hero}
        >
          {/* subtle decorative arc */}
          <View style={S.heroArc} />

          {/* Top bar */}
          <View style={S.heroTopBar}>
            <Text style={S.heroTopTitle}>My Profile</Text>
            <TouchableOpacity onPress={handleSignOut} style={S.heroSignOutBtn} activeOpacity={0.7}>
              <Text style={S.heroSignOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar + name row */}
          <View style={S.heroRow}>
            <View style={S.avatarWrap}>
              {user.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={S.avatar} />
              ) : (
                <View style={[S.avatarFallback, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <Text style={S.avatarInitial}>
                    {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.heroName} numberOfLines={1}>{user.displayName || "User"}</Text>
              <Text style={S.heroEmail} numberOfLines={1}>{user.email}</Text>
              <View style={S.heroPillRow}>
                <View style={S.heroPill}>
                  <Text style={S.heroPillText}>{provider}</Text>
                </View>
                <View style={S.heroPill}>
                  <Text style={S.heroPillText}>Since {joinDate}</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ══════════════════════════════════════════
            STATS — single horizontal row, airy
        ══════════════════════════════════════════ */}
        <View style={[S.statsRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { label: "Cases",    value: cases.length,          color: theme.primary },
            { label: "Active",   value: activeCases.length,    color: "#E67E22" },
            { label: "Found",    value: resolvedCases.length,  color: "#27AE60" },
            { label: "Sightings",value: totalSightings,        color: "#2980B9" },
          ].map(({ label, value, color }, i, arr) => (
            <View
              key={label}
              style={[S.statCell, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: theme.border }]}
            >
              <Text style={[S.statValue, { color }]}>{value}</Text>
              <Text style={[S.statLabel, { color: theme.textSecondary }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ══════════════════════════════════════════
            CONTACT DETAILS CARD  (phone editable)
        ══════════════════════════════════════════ */}
        <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[S.cardHeading, { color: theme.textSecondary }]}>CONTACT</Text>

          {/* Email row — read-only */}
          <View style={[S.contactRow, { borderBottomColor: theme.border }]}>
            <Text style={S.contactIcon}>✉️</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.contactLabel, { color: theme.textSecondary }]}>Email</Text>
              <Text style={[S.contactValue, { color: theme.text }]}>{user.email}</Text>
            </View>
          </View>

          {/* Phone row — editable */}
          <View style={[S.contactRow, { borderBottomWidth: 0 }]}>
            <Text style={S.contactIcon}>📞</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.contactLabel, { color: theme.textSecondary }]}>Phone</Text>
              {editingPhone ? (
                <View style={S.phoneEditRow}>
                  <TextInput
                    style={[S.phoneInput, { color: theme.text, borderColor: theme.primary }]}
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    keyboardType="phone-pad"
                    placeholder="+91 XXXXX XXXXX"
                    placeholderTextColor={theme.textSecondary}
                    autoFocus
                    maxLength={15}
                  />
                  <TouchableOpacity
                    style={[S.phoneSaveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleSavePhone}
                    disabled={savingPhone}
                    activeOpacity={0.8}
                  >
                    {savingPhone
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={S.phoneSaveBtnText}>Save</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.phoneCancelBtn, { borderColor: theme.border }]}
                    onPress={() => { setEditingPhone(false); setPhoneInput(phone); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.phoneCancelBtnText, { color: theme.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={S.phoneReadRow}>
                  <Text style={[S.contactValue, { color: phone ? theme.text : theme.textSecondary }]}>
                    {phone || "Not added"}
                  </Text>
                  <TouchableOpacity
                    style={[S.phoneEditTap, { borderColor: theme.border }]}
                    onPress={() => { setPhoneInput(phone); setEditingPhone(true); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[S.phoneEditTapText, { color: theme.primary }]}>
                      {phone ? "Edit" : "+ Add"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════
            MY REPORTED CASES
        ══════════════════════════════════════════ */}
        <View style={S.section}>

          {/* Section header */}
          <View style={S.sectionHeader}>
            <View>
              <Text style={[S.sectionTitle, { color: theme.text }]}>My Cases</Text>
              {!loading && cases.length > 0 && (
                <Text style={[S.sectionSub, { color: theme.textSecondary }]}>
                  {cases.length} submitted
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[S.newCaseBtn, { backgroundColor: theme.primary }]}
              onPress={() => router.push("/report-missing")}
              activeOpacity={0.85}
            >
              <Text style={S.newCaseBtnText}>＋ Report</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={S.loadingWrap}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[S.loadingText, { color: theme.textSecondary }]}>Loading…</Text>
            </View>
          ) : cases.length === 0 ? (
            <View style={[S.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={{ fontSize: 38, marginBottom: 8 }}>📭</Text>
              <Text style={[S.emptyTitle, { color: theme.text }]}>No cases yet</Text>
              <Text style={[S.emptySub, { color: theme.textSecondary }]}>
                Cases you report will appear here
              </Text>
              <TouchableOpacity
                style={[S.reportFirstBtn, { backgroundColor: theme.primary }]}
                onPress={() => router.push("/report-missing")}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Report a Missing Person</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Approval filter pills */}
              <CaseFilterBar
                activeFilter={caseFilter}
                onSelect={setCaseFilter}
                theme={theme}
                counts={filterCounts}
              />

              {displayedCases.length === 0 ? (
                <View style={[S.filterEmpty, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={{ fontSize: 26, marginBottom: 6 }}>
                    {caseFilter === "approved" ? "🏅" : "⏳"}
                  </Text>
                  <Text style={[S.emptyTitle, { color: theme.text }]}>
                    {caseFilter === "approved" ? "No approved cases" : "No pending cases"}
                  </Text>
                  <Text style={[S.emptySub, { color: theme.textSecondary }]}>
                    {caseFilter === "approved"
                      ? "Admin-approved cases will appear here."
                      : "All cases have been approved — great!"}
                  </Text>
                </View>
              ) : (
                displayedCases.map((c) => (
                  <CaseCard
                    key={c.id} item={c} theme={theme}
                    onPress={() => { setSelectedCase(c); setCaseModal(true); }}
                  />
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      <MyCaseDetailModal
        visible={caseModal}
        caseItem={selectedCase}
        theme={theme}
        onClose={() => { setCaseModal(false); setSelectedCase(null); }}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },

  // ── Hero ──
  hero: {
    paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20,
    overflow: "hidden",
  },
  heroArc: {
    position: "absolute", width: 300, height: 300, borderRadius: 150,
    backgroundColor: "rgba(255,255,255,0.04)",
    top: -120, right: -80,
  },
  heroTopBar: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  heroTopTitle:    { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.5)", letterSpacing: 1.2, textTransform: "uppercase" },
  heroSignOutBtn:  { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  heroSignOutText: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600" },

  heroRow:  { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap: {},
  avatar:   { width: 68, height: 68, borderRadius: 34, borderWidth: 2.5, borderColor: "rgba(255,255,255,0.6)" },
  avatarFallback: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.5)",
  },
  avatarInitial: { fontSize: 28, fontWeight: "900", color: "#fff" },

  heroName:    { fontSize: 18, fontWeight: "900", color: "#fff", marginBottom: 3, letterSpacing: 0.1 },
  heroEmail:   { fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 8 },
  heroPillRow: { flexDirection: "row", gap: 6 },
  heroPill:    { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  heroPillText:{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.85)" },

  // ── Stats strip ──
  statsRow: {
    flexDirection: "row", marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, borderWidth: 1, overflow: "hidden",
  },
  statCell:  { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue: { fontSize: 20, fontWeight: "900", marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: "600" },

  // ── Cards ──
  card: {
    marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, borderWidth: 1, overflow: "hidden",
  },
  cardHeading: {
    fontSize: 10, fontWeight: "800", letterSpacing: 1.2,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    textTransform: "uppercase",
  },

  // ── Contact rows ──
  contactRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, gap: 12,
  },
  contactIcon:  { fontSize: 17, marginTop: 1, width: 24 },
  contactLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3, marginBottom: 3, textTransform: "uppercase" },
  contactValue: { fontSize: 14, fontWeight: "500" },

  // Phone editing
  phoneReadRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  phoneEditTap: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  phoneEditTapText: { fontSize: 12, fontWeight: "700" },

  phoneEditRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  phoneInput: {
    flex: 1, height: 38, borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 10, fontSize: 14, fontWeight: "500",
  },
  phoneSaveBtn: {
    height: 38, paddingHorizontal: 14, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  phoneSaveBtnText:   { color: "#fff", fontWeight: "800", fontSize: 13 },
  phoneCancelBtn: {
    height: 38, width: 38, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  phoneCancelBtnText: { fontSize: 14, fontWeight: "700" },

  // ── Cases section ──
  section:       { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle:  { fontSize: 16, fontWeight: "900", letterSpacing: 0.2 },
  sectionSub:    { fontSize: 11, marginTop: 2 },
  newCaseBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  newCaseBtnText:{ color: "#fff", fontWeight: "800", fontSize: 13 },

  loadingWrap: { alignItems: "center", paddingVertical: 36, gap: 8 },
  loadingText: { fontSize: 13, fontWeight: "500" },

  emptyCard:    { borderRadius: 16, padding: 32, alignItems: "center", borderWidth: 1, marginBottom: 8 },
  filterEmpty:  { borderRadius: 14, padding: 22, alignItems: "center", borderWidth: 1, marginBottom: 8 },
  emptyTitle:   { fontSize: 15, fontWeight: "800", marginBottom: 5 },
  emptySub:     { fontSize: 12, textAlign: "center", lineHeight: 18, marginBottom: 14 },
  reportFirstBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 4 },

  signInBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
});