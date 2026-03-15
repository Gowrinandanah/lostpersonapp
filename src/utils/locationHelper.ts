import { Platform, Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { Config } from '../constants/config';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface AddressInfo {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  formattedAddress: string;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAsk: boolean;
}

export const requestLocationPermission = async (): Promise<LocationPermissionStatus> => {
  try {
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    
    if (existingStatus === 'granted') {
      return { granted: true, canAsk: true };
    }
    
    if (existingStatus === 'denied' && Platform.OS === 'ios') {
      return { granted: false, canAsk: false };
    }
    
    const { status } = await Location.requestForegroundPermissionsAsync();
    return {
      granted: status === 'granted',
      canAsk: status !== 'denied',
    };
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return { granted: false, canAsk: false };
  }
};

export const getCurrentLocation = async (): Promise<LocationCoords | null> => {
  try {
    const { granted } = await requestLocationPermission();
    
    if (!granted) {
      Alert.alert(
        'Location Permission Required',
        'Please enable location access to use this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return null;
    }
    
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
};

export const watchLocation = (
  callback: (location: LocationCoords) => void,
  errorCallback?: (error: any) => void
): Promise<Location.LocationSubscription> | null => {
  try {
    return Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    );
  } catch (error) {
    console.error('Error watching location:', error);
    if (errorCallback) errorCallback(error);
    return null;
  }
};

export const getAddressFromCoords = async (
  coords: LocationCoords
): Promise<AddressInfo | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`
    );
    
    const data = await response.json();
    
    if (data && data.address) {
      return {
        street: [data.address.road, data.address.house_number].filter(Boolean).join(' '),
        city: data.address.city || data.address.town || data.address.village || '',
        state: data.address.state || '',
        country: data.address.country || '',
        postalCode: data.address.postcode || '',
        formattedAddress: data.display_name || '',
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting address from coordinates:', error);
    return null;
  }
};

export const getCoordsFromAddress = async (address: string): Promise<LocationCoords | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
    );
    
    const data = await response.json();
    
    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting coordinates from address:', error);
    return null;
  }
};

export const calculateDistance = (
  loc1: LocationCoords,
  loc2: LocationCoords,
  unit: 'km' | 'miles' = 'km'
): number => {
  const R = unit === 'km' ? 6371 : 3959; // Earth's radius in km or miles
  const dLat = deg2rad(loc2.latitude - loc1.latitude);
  const dLon = deg2rad(loc2.longitude - loc1.longitude);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(loc1.latitude)) *
      Math.cos(deg2rad(loc2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

export const getBearing = (start: LocationCoords, end: LocationCoords): number => {
  const startLat = deg2rad(start.latitude);
  const startLon = deg2rad(start.longitude);
  const endLat = deg2rad(end.latitude);
  const endLon = deg2rad(end.longitude);
  
  const dLon = endLon - startLon;
  
  const y = Math.sin(dLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x);
  bearing = (bearing * 180) / Math.PI;
  bearing = (bearing + 360) % 360;
  
  return bearing;
};

export const getLocationString = (addressInfo: AddressInfo | null): string => {
  if (!addressInfo) return 'Unknown location';
  
  const parts = [];
  if (addressInfo.street) parts.push(addressInfo.street);
  if (addressInfo.city) parts.push(addressInfo.city);
  if (addressInfo.state) parts.push(addressInfo.state);
  if (addressInfo.country) parts.push(addressInfo.country);
  
  return parts.join(', ');
};

export const formatDistance = (distance: number, unit: 'km' | 'miles' = 'km'): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance} ${unit}`;
};