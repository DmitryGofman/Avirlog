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

    // Whether a logging window is open right now. The app checks this on
    // foreground so it can reopen one that failed to start in the background.
    Function("isRunning") { () -> Bool in
      if #available(iOS 16.2, *) {
        return !Activity<BreathActivityAttributes>.activities.isEmpty
      }
      return false
    }

    // Open a logging window that counts down for `windowSeconds`. Ends any
    // window already open first. Returns whether one is now running.
    //
    // The failure that matters: ActivityKit only allows Activity.request() while
    // the app is in the FOREGROUND, and throws .visibility otherwise. This used
    // to be `try?`, which discarded the error — so a window that never opened
    // was indistinguishable from one that did. Now the reason is logged and the
    // result is returned, and the caller retries on next foreground.
    Function("startWindow") { (windowSeconds: Double) -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        NSLog("[LiveActivity] not started — Live Activities are off for this app in iOS Settings")
        return false
      }
      for activity in Activity<BreathActivityAttributes>.activities {
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
      }
      let ends = Date().addingTimeInterval(max(30, windowSeconds))
      let state = BreathActivityAttributes.ContentState(endsAt: ends, logged: false)
      let content = ActivityContent(state: state, staleDate: ends)
      do {
        _ = try Activity.request(
          attributes: BreathActivityAttributes(title: "Breath check"),
          content: content,
          pushType: nil
        )
        return true
      } catch {
        NSLog("[LiveActivity] start failed: \(error.localizedDescription)")
        return false
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
