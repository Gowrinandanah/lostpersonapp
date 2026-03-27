// src/components/DateTimePicker.tsx
//
// Pure JavaScript date + time picker — no native modules, no rebuild needed.
// Uses only React Native core components (Modal, ScrollView, TouchableOpacity).

import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Platform,
} from "react-native";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1);   // 1–12
const MINUTES = Array.from({ length: 60 }, (_, i) => i);        // 0–59
const PERIODS = ["AM", "PM"];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function currentYear(): number {
  return new Date().getFullYear();
}

export function formatDateTime(date: Date): string {
  const day   = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year  = date.getFullYear();
  const h     = date.getHours();
  const m     = date.getMinutes();
  const hour  = h % 12 === 0 ? 12 : h % 12;
  const min   = m.toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  return `${day} ${month} ${year}, ${hour}:${min} ${period}`;
}

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  const h      = date.getHours();
  const m      = date.getMinutes();
  const hour   = h % 12 === 0 ? 12 : h % 12;
  const min    = m.toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  return `${hour}:${min} ${period}`;
}

// ── Scroll Drum ───────────────────────────────────────────────────────────────
// A single scrollable column of values

const ITEM_H = 44;
const VISIBLE = 5; // odd number so center item is obvious

const Drum = ({
  items,
  selectedIndex,
  onSelect,
  format,
  width,
}: {
  items: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  format?: (v: string | number) => string;
  width: number;
}) => {
  const scrollRef = useRef<ScrollView>(null);

  const scrollTo = (index: number) => {
    scrollRef.current?.scrollTo({ y: index * ITEM_H, animated: true });
  };

  return (
    <View style={[drumS.wrap, { width }]}>
      {/* Selection highlight */}
      <View style={drumS.highlight} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const clamped = Math.max(0, Math.min(index, items.length - 1));
          onSelect(clamped);
        }}
        onLayout={() => {
          // Scroll to initial position after layout
          setTimeout(() => scrollTo(selectedIndex), 50);
        }}
      >
        {items.map((item, i) => {
          const active = i === selectedIndex;
          return (
            <TouchableOpacity
              key={i}
              style={[drumS.item, { height: ITEM_H }]}
              onPress={() => { onSelect(i); scrollTo(i); }}
              activeOpacity={0.7}
            >
              <Text style={[drumS.itemText, active && drumS.itemTextActive]}>
                {format ? format(item) : String(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const drumS = StyleSheet.create({
  wrap: {
    height: ITEM_H * VISIBLE,
    overflow: "hidden",
  },
  highlight: {
    position: "absolute",
    top: ITEM_H * Math.floor(VISIBLE / 2),
    left: 0, right: 0,
    height: ITEM_H,
    backgroundColor: "rgba(46,204,113,0.12)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(46,204,113,0.4)",
    borderRadius: 8,
    zIndex: 1,
  },
  item:          { alignItems: "center", justifyContent: "center" },
  itemText:      { fontSize: 16, color: "#AAAAAA", fontWeight: "500" },
  itemTextActive:{ fontSize: 18, color: "#1A1A1A", fontWeight: "800" },
});

// ── Props ─────────────────────────────────────────────────────────────────────

interface DateTimePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  primaryColor?: string;
  borderColor?: string;
  textColor?: string;
  backgroundColor?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DateTimePicker({
  value,
  onChange,
  placeholder     = "Select date and time",
  primaryColor    = "#2ECC71",
  borderColor     = "#E0E0E0",
  textColor       = "#1A1A1A",
  backgroundColor = "#FFFFFF",
}: DateTimePickerProps) {
  const now = new Date();

  // Internal picker state
  const [show,       setShow]       = useState(false);
  const [pickerTab,  setPickerTab]  = useState<"date" | "time">("date");

  // Date drums
  const [dayIdx,   setDayIdx]   = useState((value?.getDate()  ?? now.getDate())  - 1);
  const [monthIdx, setMonthIdx] = useState(value?.getMonth()  ?? now.getMonth());
  const [yearIdx,  setYearIdx]  = useState(0); // index into years array

  // Time drums
  const [hourIdx,   setHourIdx]   = useState(0);
  const [minuteIdx, setMinuteIdx] = useState(0);
  const [periodIdx, setPeriodIdx] = useState(0);

  // Build years array (current year down to current year - 10, plus future not allowed)
  const years = Array.from({ length: 11 }, (_, i) => currentYear() - i);

  const openPicker = () => {
    const d = value ?? now;
    // Sync drums to current value
    setDayIdx(d.getDate() - 1);
    setMonthIdx(d.getMonth());
    setYearIdx(years.indexOf(d.getFullYear()) === -1 ? 0 : years.indexOf(d.getFullYear()));

    const h      = d.getHours();
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    setHourIdx(HOURS.indexOf(hour12));
    setMinuteIdx(d.getMinutes());
    setPeriodIdx(h >= 12 ? 1 : 0);

    setPickerTab("date");
    setShow(true);
  };

  const handleConfirm = () => {
    const year   = years[yearIdx];
    const month  = monthIdx;
    const maxDay = daysInMonth(month, year);
    const day    = Math.min(dayIdx + 1, maxDay);

    const hour12 = HOURS[hourIdx];
    const minute = minuteIdx;
    const isPM   = periodIdx === 1;
    let hour24   = hour12 % 12;
    if (isPM) hour24 += 12;

    const result = new Date(year, month, day, hour24, minute, 0, 0);
    onChange(result);
    setShow(false);
  };

  const days = Array.from(
    { length: daysInMonth(monthIdx, years[yearIdx] ?? currentYear()) },
    (_, i) => i + 1
  );

  return (
    <View>
      {/* ── Trigger button ── */}
      <TouchableOpacity
        style={[S.trigger, { backgroundColor, borderColor }]}
        onPress={openPicker}
        activeOpacity={0.85}
      >
        <Text style={S.triggerIcon}>📅</Text>
        <View style={{ flex: 1 }}>
          {value ? (
            <>
              <Text style={[S.triggerDate, { color: textColor }]}>{formatDate(value)}</Text>
              <Text style={[S.triggerTime, { color: primaryColor }]}>{formatTime(value)}</Text>
            </>
          ) : (
            <Text style={[S.triggerPlaceholder]}>
              {placeholder}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 16, color: "#AAAAAA" }}>›</Text>
      </TouchableOpacity>

      {/* ── Picker modal ── */}
      <Modal
        visible={show}
        transparent
        animationType="slide"
        onRequestClose={() => setShow(false)}
      >
        <View style={S.overlay}>
          <View style={[S.sheet, { backgroundColor }]}>

            {/* Header */}
            <View style={S.sheetHeader}>
              <TouchableOpacity onPress={() => setShow(false)} style={S.cancelBtn}>
                <Text style={S.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[S.sheetTitle, { color: textColor }]}>Select Date & Time</Text>
              <TouchableOpacity onPress={handleConfirm} style={S.doneBtn}>
                <Text style={[S.doneText, { color: primaryColor }]}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={S.tabs}>
              {(["date", "time"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[S.tab, pickerTab === tab && { borderBottomColor: primaryColor }]}
                  onPress={() => setPickerTab(tab)}
                >
                  <Text style={[S.tabText, pickerTab === tab && { color: primaryColor }]}>
                    {tab === "date" ? "📅 Date" : "🕐 Time"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date drums */}
            {pickerTab === "date" && (
              <View style={S.drumRow}>
                <Drum
                  items={days}
                  selectedIndex={Math.min(dayIdx, days.length - 1)}
                  onSelect={setDayIdx}
                  width={54}
                />
                <Drum
                  items={MONTHS}
                  selectedIndex={monthIdx}
                  onSelect={setMonthIdx}
                  width={130}
                />
                <Drum
                  items={years}
                  selectedIndex={yearIdx}
                  onSelect={setYearIdx}
                  width={76}
                />
              </View>
            )}

            {/* Time drums */}
            {pickerTab === "time" && (
              <View style={S.drumRow}>
                <Drum
                  items={HOURS}
                  selectedIndex={hourIdx}
                  onSelect={setHourIdx}
                  width={64}
                />
                <Text style={S.colon}>:</Text>
                <Drum
                  items={MINUTES}
                  selectedIndex={minuteIdx}
                  onSelect={setMinuteIdx}
                  format={(v) => String(v).padStart(2, "0")}
                  width={64}
                />
                <Drum
                  items={PERIODS}
                  selectedIndex={periodIdx}
                  onSelect={setPeriodIdx}
                  width={64}
                />
              </View>
            )}

            {/* Preview */}
            <View style={[S.preview, { borderColor: primaryColor + "40" }]}>
              <Text style={[S.previewText, { color: primaryColor }]}>
                {(() => {
                  const year   = years[yearIdx] ?? currentYear();
                  const month  = monthIdx;
                  const maxDay = daysInMonth(month, year);
                  const day    = Math.min(dayIdx + 1, maxDay);
                  const hour12 = HOURS[hourIdx];
                  const minute = minuteIdx;
                  const period = PERIODS[periodIdx];
                  return `${day} ${MONTHS[month]} ${year}  ·  ${hour12}:${String(minute).padStart(2, "0")} ${period}`;
                })()}
              </Text>
            </View>

          </View>
        </View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  trigger:            { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  triggerIcon:        { fontSize: 20 },
  triggerDate:        { fontSize: 14, fontWeight: "700", marginBottom: 1 },
  triggerTime:        { fontSize: 13, fontWeight: "600" },
  triggerPlaceholder: { fontSize: 15, color: "#AAAAAA" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 },

  sheetHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#EEEEEE" },
  sheetTitle: { fontSize: 15, fontWeight: "800" },
  cancelBtn:  { paddingHorizontal: 4, paddingVertical: 4, minWidth: 56 },
  cancelText: { fontSize: 15, color: "#888888" },
  doneBtn:    { paddingHorizontal: 4, paddingVertical: 4, minWidth: 56, alignItems: "flex-end" },
  doneText:   { fontSize: 15, fontWeight: "800" },

  tabs:    { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EEEEEE" },
  tab:     { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "700", color: "#AAAAAA" },

  drumRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, paddingHorizontal: 12, gap: 4 },
  colon:   { fontSize: 22, fontWeight: "900", color: "#1A1A1A", marginBottom: 2, paddingHorizontal: 2 },

  preview:     { marginHorizontal: 20, marginTop: 8, marginBottom: 4, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: "center" },
  previewText: { fontSize: 14, fontWeight: "700" },
});