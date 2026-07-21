import ExpoModulesCore
import ActivityKit

// Starts / ends the breath-logging Live Activity from the JS app. Starting an
// activity must happen in the app process (not the widget extension), which is
// why this lives here; the widget extension only *renders* it.
//
// IMPORTANT: BreathActivityAttributes must be the SAME type ActivityKit sees on
// the widget side. Keep this struct byte-for-byte identical to the one in
// targets/widget/index.swift, and see LIVEACTIVITY.md for how the two targets
// share it. If the Live Activity starts but never shows your widget UI, this
// mismatch is the first thing to check.
struct BreathActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var endsAt: Date
    var logged: Bool
  }
  var title: String
}

public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    // Whether the device/user allows Live Activities right now.
    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Open a logging window that counts down for `windowSeconds`, then goes
    // stale (system dismisses it) — after which the classic chained reminder
    // is the fallback. Ends any window already open first.
    Function("startWindow") { (windowSeconds: Double) in
      if #available(iOS 16.2, *) {
        for activity in Activity<BreathActivityAttributes>.activities {
          Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        let ends = Date().addingTimeInterval(max(30, windowSeconds))
        let state = BreathActivityAttributes.ContentState(endsAt: ends, logged: false)
        let content = ActivityContent(state: state, staleDate: ends)
        _ = try? Activity.request(
          attributes: BreathActivityAttributes(title: "Breath check"),
          content: content,
          pushType: nil
        )
      }
    }

    // Close any open window immediately (e.g. right after a log).
    Function("endAll") {
      if #available(iOS 16.2, *) {
        for activity in Activity<BreathActivityAttributes>.activities {
          Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
      }
    }
  }
}
