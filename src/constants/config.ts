export const Config = {
  firebase: {
    apiKey: "AIzaSyC9t3moE4fuPyag8RJdXzMMzk87Xg1tip4",
    authDomain: "lost-person-alert.firebaseapp.com",
    projectId: "lost-person-alert",
    storageBucket: "lost-person-alert.firebasestorage.app",
    messagingSenderId: "389857812215",
    appId: "1:389857812215:web:d727a48a200220b1afbdf2",
    measurementId: "G-4BZ6JK17LV",
  },
  cloudinary: {
    cloudName: "dmbddu6fk",
    uploadPreset: "missing_app_upload",
    folder: "missing_people",
  },
  // Default map region — centre of India (Kerala bias).
  // Change latitude/longitude to your target city if needed.
  map: {
    defaultRegion: {
      latitude:      10.8505,   // Kerala, India
      longitude:     76.2711,
      latitudeDelta:  5,
      longitudeDelta: 5,
    },
    // OSM tile URL — no API key required
    osmTileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    minZoom: 5,
  },
  app: {
    name: "Lost Person Alert",
    version: "1.0.0",
    supportEmail: "support@lostpersonalert.com",
  },
  pagination: {
    casesPerPage: 10,
    alertsPerPage: 20,
  },
  timeouts: {
    location: 10000, // 10 seconds
    api: 30000,      // 30 seconds
  },
} as const;