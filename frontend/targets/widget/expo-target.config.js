/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "AvirLogWidget",
  // Shared container with the main app so the widget can read the reminder
  // state and write logs the app imports.
  entitlements: {
    "com.apple.security.application-groups": ["group.com.avirlog.app"],
  },
  // Frameworks the Swift target links against.
  frameworks: ["WidgetKit", "SwiftUI", "AppIntents", "UserNotifications"],
};
