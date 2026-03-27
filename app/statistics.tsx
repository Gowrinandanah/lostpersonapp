import React, { useState } from 'react';
import { Stack } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';

const screenWidth: number = Dimensions.get('window').width;

export default function Statistics() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const years: string[] = ['2021', '2022', '2023', '2024', '2025'];

  const total: number[] = [10500, 9800, 11200, 11000, 11800];
  const solved: number[] = [7800, 8500, 9000, 8800, 9400];

  let unsolved: number[] = total.map((t, i) => t - solved[i]);

  unsolved[2] = 2200;
  unsolved[3] = 2300;
  solved[2] = total[2] - unsolved[2];
  solved[3] = total[3] - unsolved[3];

  const solveTime: number[] = [35, 48, 29, 50, 38];

  const totalCases: number = total.reduce((a, b) => a + b, 0);
  const totalSolved: number = solved.reduce((a, b) => a + b, 0);

  const peakCases: number[] = total.map((t, i) =>
    Math.floor(t * (0.65 + (i % 2) * 0.1))
  );

  const peakValue: number = peakCases.reduce((a, b) => a + b, 0);

  const genderDataYearwise = [
    { male: 4200, female: 3800, children: 1100, adults60plus: 1400 },
    { male: 4000, female: 4100, children: 1100, adults60plus: 600 },
    { male: 4500, female: 4200, children: 1200, adults60plus: 1300 },
    { male: 4300, female: 4000, children: 1200, adults60plus: 1500 },
    { male: 4600, female: 4200, children: 1200, adults60plus: 1800 },
  ];

  const pieData: any[] =
    selectedYear !== null
      ? [
          {
            name: 'Male',
            population: genderDataYearwise[selectedYear].male,
            color: 'rgba(46,204,113,1)',
            legendFontColor: '#000',
            legendFontSize: 12
          },
          {
            name: 'Female',
            population: genderDataYearwise[selectedYear].female,
            color: 'rgba(52,152,219,1)',
            legendFontColor: '#000',
            legendFontSize: 12
          },
          {
            name: 'Children',
            population: genderDataYearwise[selectedYear].children,
            color: 'rgba(241,196,15,1)',
            legendFontColor: '#000',
            legendFontSize: 12
          },
          {
            name: 'Adults 60+',
            population: genderDataYearwise[selectedYear].adults60plus,
            color: 'rgba(231,76,60,1)',
            legendFontColor: '#000',
            legendFontSize: 12
          }
        ]
      : [];

  return (
    <LinearGradient colors={['#27AE60', '#2ECC71']} style={{ flex: 1 }}>
    <Stack.Screen options={{
      title: "Home",
      headerStyle: { backgroundColor: "#27AE60" },
      headerTintColor: "#fff",
      headerTitleStyle: { fontWeight: "800" },
    }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>📊 Statistics Dashboard</Text>

        {/* ── Summary Cards ── */}
        <View style={styles.summary}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total</Text>
            <Text style={styles.cardValue}>{totalCases.toLocaleString()}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Solved</Text>
            <Text style={styles.cardValue}>{totalSolved.toLocaleString()}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Peak</Text>
            <Text style={styles.cardValue}>{peakValue.toLocaleString()}</Text>
          </View>
        </View>

        {/* ── Year Dropdown ── */}
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text style={styles.dropdownText}>
            {selectedYear !== null ? `📅 ${years[selectedYear]}` : 'Select Year ▾'}
          </Text>
        </TouchableOpacity>

        {showDropdown && (
          <View style={styles.dropdown}>
            {years.map((year, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setSelectedYear(index);
                  setShowDropdown(false);
                }}
                style={styles.dropdownItem}
              >
                <Text style={styles.dropdownItemText}>{year}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Year Details ── */}
        {selectedYear !== null && (
          <View style={styles.detailsBox}>
            <Text style={styles.detailsTitle}>{years[selectedYear]} Details</Text>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsKey}>Total Cases</Text>
              <Text style={styles.detailsVal}>{total[selectedYear].toLocaleString()}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsKey}>Solved</Text>
              <Text style={[styles.detailsVal, { color: '#27AE60' }]}>{solved[selectedYear].toLocaleString()}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsKey}>Unsolved</Text>
              <Text style={[styles.detailsVal, { color: '#E74C3C' }]}>{unsolved[selectedYear].toLocaleString()}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsKey}>Avg Solve Time</Text>
              <Text style={styles.detailsVal}>{solveTime[selectedYear]} days</Text>
            </View>
          </View>
        )}

        {/* ── Pie Chart ── */}
        {selectedYear !== null && (
          <View style={[styles.chartBox, { width: screenWidth - 30, alignSelf: 'center' }]}>
            <Text style={styles.chartTitle}>
              Gender & Age Distribution ({years[selectedYear]})
            </Text>
            <PieChart
              data={pieData}
              width={screenWidth - 30}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        )}

        {/* ── Total Cases Line Chart ── */}
        <View style={styles.chartBox}>
          <Text style={styles.chartTitle}>Total Cases per Year</Text>
          <LineChart
            data={{ labels: years, datasets: [{ data: total }] }}
            width={screenWidth - 60}
            height={220}
            chartConfig={chartConfig}
          />
        </View>

        {/* ── Solved Cases Bar Chart ── */}
        <View style={styles.chartBox}>
          <Text style={styles.chartTitle}>Solved Cases</Text>
          <BarChart
            data={{ labels: years, datasets: [{ data: solved }] }}
            width={screenWidth - 60}
            height={220}
            fromZero
            showValuesOnTopOfBars
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
          />
        </View>

        {/* ── Unsolved Cases Bar Chart ── */}
        <View style={styles.chartBox}>
          <Text style={styles.chartTitle}>Unsolved Cases</Text>
          <BarChart
            data={{ labels: years, datasets: [{ data: unsolved }] }}
            width={screenWidth - 60}
            height={220}
            fromZero
            showValuesOnTopOfBars
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={{
              ...chartConfig,
              color: (opacity: number = 1) => `rgba(231,76,60,${opacity})`
            }}
          />
        </View>

        {/* ── Peak Case Trend Bar Chart ── */}
        <View style={styles.chartBox}>
          <Text style={styles.chartTitle}>Peak Case Trend</Text>
          <BarChart
            data={{ labels: years, datasets: [{ data: peakCases }] }}
            width={screenWidth - 60}
            height={220}
            fromZero
            showValuesOnTopOfBars
            yAxisLabel=""
            yAxisSuffix=""
            chartConfig={chartConfig}
          />
        </View>

        {/* ── Time to Solve Line Chart ── */}
        <View style={styles.chartBox}>
          <Text style={styles.chartTitle}>Time to Solve (days)</Text>
          <LineChart
            data={{ labels: years, datasets: [{ data: solveTime }] }}
            width={screenWidth - 60}
            height={220}
            chartConfig={chartConfig}
          />
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity: number = 1) => `rgba(46,204,113,${opacity})`,
  labelColor: (opacity: number = 1) => `rgba(39,174,96,${opacity})`
};

const styles = StyleSheet.create({
  container: { padding: 15, paddingBottom: 40 },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#fff',
    marginBottom: 16,
    marginTop: 8,
  },

  summary:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  card:       { backgroundColor: '#fff', padding: 14, borderRadius: 14, width: '30%', alignItems: 'center', elevation: 4 },
  cardLabel:  { color: '#27AE60', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  cardValue:  { fontSize: 17, fontWeight: '900', color: '#1A1A1A' },

  dropdownBtn:      { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginVertical: 10, alignItems: 'center' },
  dropdownText:     { fontWeight: '700', color: '#27AE60', fontSize: 14 },
  dropdown:         { backgroundColor: '#fff', borderRadius: 10, elevation: 5, marginBottom: 8 },
  dropdownItem:     { padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#EEEEEE' },
  dropdownItemText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },

  detailsBox:   { backgroundColor: '#fff', padding: 16, borderRadius: 14, marginVertical: 10 },
  detailsTitle: { fontWeight: '800', fontSize: 15, marginBottom: 10, color: '#1A1A1A' },
  detailsRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  detailsKey:   { fontSize: 13, color: '#666' },
  detailsVal:   { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },

  chartBox:   { backgroundColor: '#fff', padding: 16, borderRadius: 20, marginVertical: 10 },
  chartTitle: { fontWeight: '700', fontSize: 14, marginBottom: 10, color: '#1A1A1A' },
});