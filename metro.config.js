// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// On web, replace react-native-maps with an empty stub
// so it never tries to bundle native-only internals
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    (moduleName === "react-native-maps" ||
      moduleName.startsWith("react-native-maps/"))
  ) {
    // Return an empty module — web screens don't use the map
    return {
      filePath: require.resolve("./src/stubs/react-native-maps.js"),
      type: "sourceFile",
    };
  }
  // Default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;