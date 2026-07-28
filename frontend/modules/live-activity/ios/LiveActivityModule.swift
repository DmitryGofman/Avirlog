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
public struct BreathActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var endsAt: Date
    public var logged: Bool

    public init(endsAt: Date, logged: Bool) {
      self.endsAt = endsAt
      self.logged = logged
    }
  }
  public var title: String

  public init(title: String) {
    self.title = title
  }
}

// Public control surface for the logging window.
//
// This is public for one specific reason: the Live Activity's buttons run a
// `LiveActivityIntent`, which iOS performs in the *app* process, and that intent
// is compiled into the app target (see native/BreathLiveIntents.swift). Only code
// that holds the SAME `BreathActivityAttributes` type used by `Activity.request`
// can look the running activity back up — a second copy of the struct declared in
// the app target would be a different Swift type and find nothing. So the intent
// calls in here instead of talking to ActivityKit itself.
//
// Live Activities are gated to iOS 17 across the app: the buttons are the whole
// point of the window, and interactive buttons need 17. On iOS 16 the classic
// chained notification is the fallback.
public enum BreathLiveActivityControl {
  /// Whether the device/user allows Live Activities right now.
  public static var isSupported: Bool {
    if #available(iOS 17.0, *) {
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }
    return false
  }

  /// Open a logging window that counts down for `seconds`, replacing any window
  /// already open. Goes stale on its own when the countdown runs out.
  @available(iOS 17.0, *)
  public static func startWindow(seconds: Double) {
    for activity in Activity<BreathActivityAttributes>.activities {
      Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }
    let ends = Date().addingTimeInterval(max(30, seconds))
    let state = BreathActivityAttributes.ContentState(endsAt: ends, logged: false)
    _ = try? Activity.request(
      attributes: BreathActivityAttributes(title: "Breath check"),
      content: ActivityContent(state: state, staleDate: ends),
      pushType: nil
    )
  }

  /// Close any open window immediately.
  @available(iOS 17.0, *)
  public static func endAll() async {
    for activity in Activity<BreathActivityAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  /// Flip the window to "LOGGED" so the tap visibly registers, hold it briefly,
  /// then dismiss. Without the pause the window just vanished with no
  /// confirmation that anything had been recorded.
  @available(iOS 17.0, *)
  public static func confirmThenEndAll() async {
    let activities = Activity<BreathActivityAttributes>.activities
    guard !activities.isEmpty else { return }
    for activity in activities {
      let done = BreathActivityAttributes.ContentState(endsAt: Date(), logged: true)
      await activity.update(ActivityContent(state: done, staleDate: nil))
    }
    try? await Task.sleep(nanoseconds: 900_000_000)
    await endAll()
  }
}

public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    Function("isSupported") { () -> Bool in
      return BreathLiveActivityControl.isSupported
    }

    Function("startWindow") { (windowSeconds: Double) in
      if #available(iOS 17.0, *) {
        BreathLiveActivityControl.startWindow(seconds: windowSeconds)
      }
    }

    Function("endAll") {
      if #available(iOS 17.0, *) {
        Task { await BreathLiveActivityControl.endAll() }
      }
    }
  }
}
