import { Stack, router, useSegments } from 'expo-router';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/colors';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../src/firebase/firebaseConfig';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Redirect based on auth state whenever user or route changes
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not logged in and not on an auth screen → send to login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Logged in but still on an auth screen → send to main app
      router.replace('/alerts');
    }
  }, [user, loading, segments]);

  // Show a splash/loading screen while checking auth state
  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.primary,
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: theme.background,
          },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            title: 'Home'
          }}
        />
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
            animation: 'fade'
          }}
        />
        <Stack.Screen
          name="alerts"
          options={{
            title: 'Active Alerts',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="map"
          options={{
            title: 'Map View',
            headerTransparent: true,
            headerBlurEffect: 'regular'
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            title: 'Profile',
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="report-missing"
          options={{
            title: 'Report Missing Person',
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="report-sighting"
          options={{
            title: 'Report Sighting',
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="case-details"
          options={{
            title: 'Case Details'
          }}
        />
        <Stack.Screen
          name="admin"
          options={{
            headerShown: false
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}