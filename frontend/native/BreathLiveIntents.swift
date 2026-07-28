// Live Activity button intents — compiled into the APP target.
//
// This file is not part of the widget extension. It is copied into
// ios/<Project>/ and added to the app target's Sources by
// plugins/withLiveActivityIntents.js during prebuild.
//
// WHY IT HAS TO LIVE IN THE APP TARGET
//
// The Live Activity's buttons used to run `LogBreathIntent`, a plain `AppIntent`
// declared only in the widget extension. A plain AppIntent performs inside the
// extension's process, and `Activity<…>.activities` is *always empty there* — an
// extension cannot see the activities the app requested. So the code that
// flipped the window to "LOGGED" and then ended it silently iterated over
// nothing: the tap logged the breath, but the window showed no confirmation and
// stayed on the Lock Screen until its countdown expired.
//
// `LiveActivityIntent` is the fix: iOS performs it in the *app's* process, where
// the activities are visible. For that to happen the intent type has to be in
// the app's own bundle — which is what the config plugin arranges. The widget
// extension keeps a same-named copy so its SwiftUI can build the Button; when
// both exist, iOS runs the app's.
//
// Keep the type names, parameter names and titles in sync with the copies in
// targets/widget/index.swift, or iOS will treat them as different intents.

import AppIntents
import Foundation
import LiveActivity
import UserNotifications
import WidgetKit

private let APP_GROUP = "group.com.avirlog.app"

/// App-target view of the App Group queue the app drains on next launch.
/// Mirrors `SharedStore` in targets/widget/index.swift.
enum BreathIntentStore {
  static var defaults: UserDefaults? { UserDefaults(suiteName: APP_GROUP) }

  private static func appendPending(_ entry: [String: Any]) {
    guard let d = defaults else { return }
    var arr: [[String: Any]] = []
    if let raw = d.string(forKey: "pendingLogs"),
       let data = raw.data(using: .utf8),
       let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
      arr = parsed
    }
    arr.append(entry)
    if let out = try? JSONSerialization.data(withJSONObject: arr),
       let s = String(data: out, encoding: .utf8) {
      d.set(s, forKey: "pendingLogs")
    }
  }

  static func appendPendingLog(_ state: String) {
    appendPending(["state": state, "at": Date().timeIntervalSince1970])
  }

  static func appendPendingBlend(_ state: String, _ right: Int) {
    appendPending(["state": state, "blend": right, "at": Date().timeIntervalSince1970])
  }

  static func markLogged() {
    defaults?.set(Date().timeIntervalSince1970, forKey: "lastLogAt")
  }

  static func armNextDue() {
    let raw = defaults?.double(forKey: "intervalSeconds") ?? 0
    let interval = raw > 0 ? raw : 600
    defaults?.set(Date().timeIntervalSince1970 + interval, forKey: "nextDueAt")
  }
}

/// Everything a Live Activity tap does, apart from the log payload itself.
/// iOS 17+ because `confirmThenEndAll()` is — the app's deployment target is
/// lower, so this needs the annotation to compile.
@available(iOS 17.0, *)
private func finishLiveActivityTap() async {
  BreathIntentStore.markLogged()
  BreathIntentStore.armNextDue()
  // You logged on the Live Activity — clear the classic reminder that would
  // otherwise still be waiting.
  UNUserNotificationCenter.current().removeAllDeliveredNotifications()
  UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
  // Confirm on the window, then close it. Runs here in the app process, so the
  // activity is actually reachable.
  await BreathLiveActivityControl.confirmThenEndAll()
  WidgetCenter.shared.reloadAllTimelines()
}

@available(iOS 17.0, *)
struct LogBreathLiveIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Log breath"
  // Usable straight from the Lock Screen without unlocking: it writes one row to
  // our own App Group container and reveals nothing on screen.
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  // Never bounce into the app — the point is logging in place.
  static var openAppWhenRun: Bool = false

  @Parameter(title: "State")
  var state: String

  init() {}
  init(state: String) { self.state = state }

  func perform() async throws -> some IntentResult {
    BreathIntentStore.appendPendingLog(state)
    await finishLiveActivityTap()
    return .result()
  }
}

@available(iOS 17.0, *)
struct LogBlendLiveIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Log breath blend"
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Right percent")
  var right: Int

  init() {}
  init(right: Int) { self.right = right }

  func perform() async throws -> some IntentResult {
    // Same thresholds as the widget copy and blendToState() in JS.
    let state = right >= 55 ? "right" : (right <= 45 ? "left" : "both")
    BreathIntentStore.appendPendingBlend(state, right)
    await finishLiveActivityTap()
    return .result()
  }
}
