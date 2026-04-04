// app/_layout.tsx

import { Stack, router, useSegments } from 'expo-router';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/colors';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../src/firebase/firebaseConfig';
import { useLocation } from '../src/hooks/useLocation';
import { useNotifications } from '../src/hooks/useNotifications';
import { checkIsAdmin } from '../src/constants/adminConfig';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  useLocation();
  useNotifications();

  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const segments = useSegments();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const admin = await checkIsAdmin(firebaseUser.uid, firebaseUser.email);
        setIsAdmin(admin);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup  = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === 'admin';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      if (isAdmin) {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/');
      }
    } else if (user && isAdmin && !inAdminGroup) {
      router.replace('/admin/dashboard');
    }
  }, [user, isAdmin, loading, segments]);

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
          headerStyle:      { backgroundColor: theme.primary },
          headerTintColor:  '#FFFFFF',
          headerTitleStyle: { fontWeight: '600', fontSize: 18 },
          headerShadowVisible: false,
          contentStyle:     { backgroundColor: theme.background },
          animation:        'slide_from_right',
        }}
      >
        {/* ✅ headerShown: false — index has its own custom header */}
        <Stack.Screen name="index"           options={{ headerShown: false }} />
        <Stack.Screen name="(auth)"          options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="alerts"          options={{ headerShown: false }} />
        <Stack.Screen name="map"             options={{ title: 'Map View', headerTransparent: true, headerBlurEffect: 'regular' }} />
        <Stack.Screen name="profile"         options={{ title: 'Profile', presentation: 'modal' }} />
        <Stack.Screen name="report-missing"  options={{ title: 'Report Missing Person', presentation: 'modal' }} />
        <Stack.Screen name="report-sighting" options={{ title: 'Report Sighting', presentation: 'modal' }} />
        <Stack.Screen name="case-details"    options={{ title: 'Case Details' }} />
        <Stack.Screen name="admin"           options={{ headerShown: false }} />
        <Stack.Screen name="statistics"      options={{ headerShown: false }} />
        <Stack.Screen name="notifications"   options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}