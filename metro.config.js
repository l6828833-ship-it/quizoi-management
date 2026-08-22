const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const isProductionExport = process.env.NODE_ENV === "production";

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Development keeps a physical stylesheet for native styling. Production
  // exports use a virtual module so Metro does not need to hash a generated
  // cache file within node_modules during Docker builds.
  forceWriteFileSystem: !isProductionExport,
});
