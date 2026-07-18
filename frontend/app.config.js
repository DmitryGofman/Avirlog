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
  config.plugins = [...(config.plugins || []), "@bacons/apple-targets"];
  config.ios = config.ios || {};
  config.ios.entitlements = {
    ...(config.ios.entitlements || {}),
    "com.apple.security.application-groups": ["group.com.avirlog.app"],
  };

  return config;
};
