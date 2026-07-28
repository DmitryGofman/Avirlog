// Dynamic config layered on top of app.json.
//
// experiments.baseUrl (set in app.json to "/Avirlog") is required for the
// GitHub Pages web build, which is served from a subpath. But baseUrl applies
// to every platform, and on native it prepends "/Avirlog" to asset
// destination paths — which crashes the iOS/Android "Bundle React Native code
// and images" step (ENOTDIR while copying fonts into AvirLog.app/Avirlog/...).
//
// So: keep baseUrl for the web export only, gated on EXPO_WEB_BASE_URL (the
// deploy-web workflow sets it), and strip it everywhere else so native store
// builds copy assets to the app-bundle root.
module.exports = ({ config }) => {
  config.experiments = { ...(config.experiments || {}) };
  if (process.env.EXPO_WEB_BASE_URL) {
    config.experiments.baseUrl = process.env.EXPO_WEB_BASE_URL;
  } else {
    delete config.experiments.baseUrl;
  }

  // Widget target (native). @bacons/apple-targets compiles targets/widget/
  // into a WidgetKit extension; the App Group lets the app and widget share
  // the reminder state and the logs made on the widget.
  //
  // The plugin is a Mac-side toolchain dep (`npx expo install
  // @bacons/apple-targets`, per WIDGET.md), so it isn't in package.json. Only
  // register it when it actually resolves — that way the widget builds when the
  // toolchain is installed, while `expo config` / the web + plain-iOS builds
  // keep working without it instead of hard-failing to resolve the plugin.
  try {
    require.resolve("@bacons/apple-targets");
    config.plugins = [...(config.plugins || []), "@bacons/apple-targets"];
  } catch {
    console.warn(
      "[app.config] @bacons/apple-targets not installed — skipping the widget target. " +
        "Run `npx expo install @bacons/apple-targets` to include it (see WIDGET.md).",
    );
  }
  // Puts the Live Activity's button intents in the app target. They must run in
  // the app process to be able to confirm the log and close the window — see
  // plugins/withLiveActivityIntents.js for why the Expo module can't do it.
  config.plugins = [...(config.plugins || []), "./plugins/withLiveActivityIntents"];

  config.ios = config.ios || {};
  config.ios.entitlements = {
    ...(config.ios.entitlements || {}),
    "com.apple.security.application-groups": ["group.com.avirlog.app"],
  };
  // Required for the app to run Live Activities (the timed lock-screen
  // logging window). Without this key ActivityKit requests are rejected.
  config.ios.infoPlist = {
    ...(config.ios.infoPlist || {}),
    NSSupportsLiveActivities: true,
  };

  return config;
};
