// src/stubs/react-native-maps.js
// This file is used on WEB only (via metro.config.js resolver).
// It exports empty components so the web bundler never touches
// the real react-native-maps which uses native-only internals.

const React = require("react");
const { View, Text } = require("react-native");

const Stub = () => null;

module.exports = {
  default:          Stub,
  MapView:          Stub,
  Marker:           Stub,
  UrlTile:          Stub,
  Callout:          Stub,
  Polyline:         Stub,
  Polygon:          Stub,
  Circle:           Stub,
  MapPressEvent:    {},
  PROVIDER_GOOGLE:  "google",
  PROVIDER_DEFAULT: null,
};