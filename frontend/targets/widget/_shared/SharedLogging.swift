import Foundation
import UserNotifications
import WidgetKit
import ActivityKit
import AppIntents

// Code shared by the app and the widget extension. Linked into BOTH targets by
// @bacons/apple-targets (re-run `expo prebuild` after adding or renaming files here).
// The app deployment target is lower than the widget's, so mind availability.

// Shared App Group container. Keep this identifier in sync with
// app.config.js, expo-target.config.js, and modules/app-group-storage.
let APP_GROUP = "group.com.avirlog.app"

// How many upcoming reminders are booked at once. Keep in sync with
// REMINDER_BATCH in src/lib/notifications.ts.
let REMINDER_BATCH = 48

// MARK: - Shared store

enum SharedStore {
  static var defaults: UserDefaults? { UserDefaults(suiteName: APP_GROUP) }

  static var nextDueAt: Date? {
    guard let t = defaults?.double(forKey: "nextDueAt"), t > 0 else { return nil }
    return Date(timeIntervalSince1970: t)
  }

  static var intervalSeconds: Double {
    let v = defaults?.double(forKey: "intervalSeconds") ?? 0
    return v > 0 ? v : 600
  }

  // Mirrors the app's Advanced-logging setting: when on, the widget + Live
  // Activity offer preset-blend buttons instead of Left/Right/Both.
  static var advanced: Bool { (defaults?.double(forKey: "advanced") ?? 0) > 0.5 }

  // Mirrors "Buzz on widget taps". Default ON when the key was never written.
  static var tapFeedback: Bool { (defaults?.double(forKey: "tapFeedback") ?? 1) > 0.5 }

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

  // A preset-blend tap: `right` is the right-nostril %, `state` its dominant side.
  static func appendPendingBlend(_ state: String, _ right: Int) {
    appendPending(["state": state, "blend": right, "at": Date().timeIntervalSince1970])
  }

  // Timestamp of the most recent widget tap, so the next render can show a
  // short "LOGGED" confirmation — widget buttons give no press animation of
  // their own, so without this a tap looked like nothing happened.
  static var lastLogAt: Date? {
    guard let t = defaults?.double(forKey: "lastLogAt"), t > 0 else { return nil }
    return Date(timeIntervalSince1970: t)
  }
  static func markLogged() {
    defaults?.set(Date().timeIntervalSince1970, forKey: "lastLogAt")
  }
  static func justLogged(within seconds: Double = 60) -> Bool {
    guard let t = lastLogAt else { return false }
    return Date().timeIntervalSince(t) < seconds
  }

  // Reminder settings mirrored from the app (setWidgetReminderConfig in
  // src/lib/widgetBridge.ts).
  static var remindersEnabled: Bool { (defaults?.double(forKey: "remindersEnabled") ?? 0) > 0.5 }
  static var bookNotifications: Bool { (defaults?.double(forKey: "bookNotifications") ?? 1) > 0.5 }
  static var reminderSound: Bool { (defaults?.double(forKey: "reminderSound") ?? 1) > 0.5 }
  static var quietEnabled: Bool { (defaults?.double(forKey: "quietEnabled") ?? 0) > 0.5 }
  static var quietStart: Int { Int(defaults?.double(forKey: "quietStart") ?? 0) }
  static var quietEnd: Int { Int(defaults?.double(forKey: "quietEnd") ?? 0) }

  // A log was made on the widget or the Live Activity: restart the reminder
  // cadence from now, exactly as the app does after a log.
  //
  // This used to remove every pending reminder and book nothing in its place,
  // so each widget / Live Activity log silently switched reminders off until
  // the app was next opened.
  static func rebookReminders() async {
    let center = UNUserNotificationCenter.current()
    // The app mirrors its reminder settings here on every launch. Until it has
    // done so once (an update installed but the app not yet opened), we do not
    // know whether reminders are on — so leave whatever is booked alone rather
    // than wiping it, which is the failure this function exists to prevent.
    guard defaults?.object(forKey: "remindersEnabled") != nil else { return }
    center.removeAllPendingNotificationRequests()
    guard remindersEnabled else { return }
    let slots = reminderSlots(from: Date(), count: bookNotifications ? REMINDER_BATCH : 1)
    if let first = slots.first {
      defaults?.set(first.timeIntervalSince1970, forKey: "nextDueAt")
    }
    guard bookNotifications else { return }
    let content = UNMutableNotificationContent()
    content.title = "Breath check"
    content.body = advanced
      ? "How open is each nostril? Hold to log a blend"
      : "Which nostril is active? Hold to log · Left / Both / Right"
    content.categoryIdentifier = advanced ? "breath-blend" : "breath-log"
    if reminderSound { content.sound = .default }
    // Order doesn't matter to iOS, so add them concurrently.
    let failures = await withTaskGroup(of: Bool.self) { group -> Int in
      for at in slots {
        group.addTask {
          let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(1, at.timeIntervalSinceNow), repeats: false)
          let id = "breath-\(Int(at.timeIntervalSince1970.rounded()))"
          do {
            try await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
            return true
          } catch {
            NSLog("[AvirLog] could not book reminder \(id): \(error.localizedDescription)")
            return false
          }
        }
      }
      var failed = 0
      for await ok in group where !ok { failed += 1 }
      return failed
    }
    if failures > 0 {
      NSLog("[AvirLog] re-booked %d of %d reminders", slots.count - failures, slots.count)
    }
  }

  // Keep in sync with reminderSlots() in src/lib/reminderSlots.ts (tested by tests/reminderSlots.test.ts).
  static func reminderSlots(from start: Date, count: Int) -> [Date] {
    let step = max(5, intervalSeconds)
    var out: [Date] = []
    var t = start
    for _ in 0..<count {
      var next = t.addingTimeInterval(step)
      if quietEnabled && inQuiet(next) { next = quietEndAfter(next) }
      t = next
      out.append(next)
    }
    return out
  }

  private static func minutesOfDay(_ d: Date) -> Int {
    let c = Calendar.current.dateComponents([.hour, .minute], from: d)
    return (c.hour ?? 0) * 60 + (c.minute ?? 0)
  }

  private static func inQuiet(_ d: Date) -> Bool {
    let m = minutesOfDay(d), s = quietStart, e = quietEnd
    if s == e { return false }
    return s < e ? (m >= s && m < e) : (m >= s || m < e)
  }

  private static func quietEndAfter(_ d: Date) -> Date {
    var end = Calendar.current.date(
      bySettingHour: quietEnd / 60, minute: quietEnd % 60, second: 0, of: d) ?? d
    if end <= d { end = Calendar.current.date(byAdding: .day, value: 1, to: end) ?? end }
    return end
  }

  static func isDueNow() -> Bool {
    guard let due = nextDueAt else { return false }
    return Date() >= due
  }
}

// Everything that follows a log made on the widget or the Live Activity.
//
// Order matters for how the tap FEELS: repaint the tile and buzz first, and do
// the reminder bookkeeping alongside rather than before. Booking the batch used
// to sit ahead of the repaint, so the tile changed — and the phone buzzed —
// only after every reminder was re-booked.
@available(iOS 16.2, *)
func completeLog(label: String) async {
  // The reminder that asked is answered; take it down.
  UNUserNotificationCenter.current().removeAllDeliveredNotifications()
  // Restart the cadence from now, concurrently with the feedback below.
  async let rebooked: Void = SharedStore.rebookReminders()
  // Repaint to LOGGED ✓ first, then buzz — so the tile has already changed by
  // the time you feel the tap land.
  WidgetCenter.shared.reloadAllTimelines()
  await postTapConfirmation(label)
  await confirmThenEndActivities()
  // The batch must be fully booked before this process may be suspended, and
  // the tile needs one more repaint to pick up the new due time.
  await rebooked
  WidgetCenter.shared.reloadAllTimelines()
  try? await Task.sleep(nanoseconds: 900_000_000)
  clearTapConfirmation()
}

// MARK: - Tap feedback

// Physical feedback for a widget / Live Activity tap.
//
// There is no haptic API available here: these buttons run their App Intent in
// the widget EXTENSION process, and UIFeedbackGenerator only fires for an app
// that is foreground-active. The one thing an extension CAN do that reaches the
// Taptic Engine is post a local notification — iOS plays the alert sound and
// its haptic on delivery.
//
// So: post a confirmation with a sound, wait long enough for the buzz to land,
// then remove it again by identifier. You feel the tap and see a brief banner,
// and Notification Centre isn't left with a row per log.
let TAP_FEEDBACK_ID = "avirlog.tap.confirm"

func postTapConfirmation(_ label: String) async {
  guard SharedStore.tapFeedback else { return }
  let content = UNMutableNotificationContent()
  content.title = "Logged · \(label)"
  // The sound is what carries the haptic — a silent notification doesn't buzz.
  content.sound = .default
  let request = UNNotificationRequest(identifier: TAP_FEEDBACK_ID, content: content, trigger: nil)
  try? await UNUserNotificationCenter.current().add(request)
}

func clearTapConfirmation() {
  UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [TAP_FEEDBACK_ID])
}

// Human-readable name for what was logged, for the confirmation above.
func logLabel(state: String, right: Int? = nil) -> String {
  let side = state == "left" ? "Left" : (state == "right" ? "Right" : "Both")
  guard let r = right else { return side }
  if r == 50 { return "Both · 50 · 50" }
  return r < 50 ? "Left \(100 - r)%" : "Right \(r)%"
}

// Show "LOGGED" on the Live Activity so the tap visibly registers, then close
// it. Without the brief confirmation the window either vanished with no
// feedback or — if ending failed — sat there for the rest of the countdown.
@available(iOS 16.2, *)
func confirmThenEndActivities() async {
  for activity in Activity<BreathActivityAttributes>.activities {
    let done = BreathActivityAttributes.ContentState(endsAt: Date(), logged: true)
    await activity.update(ActivityContent(state: done, staleDate: nil))
  }
  try? await Task.sleep(nanoseconds: 900_000_000)
  for activity in Activity<BreathActivityAttributes>.activities {
    await activity.end(nil, dismissalPolicy: .immediate)
  }
}

// MARK: - Live Activity

// Attributes shared with the app's LiveActivityModule. ActivityKit matches the
// app's Activity<BreathActivityAttributes> to this widget by TYPE, so this
// struct must stay byte-for-byte identical to the one in
// modules/live-activity/ios/LiveActivityModule.swift (see LIVEACTIVITY.md).
@available(iOS 16.1, *)
struct BreathActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var endsAt: Date   // when this logging window closes
    var logged: Bool   // set true after a log, for a brief confirmation
  }
  var title: String
}


// MARK: - Live Activity buttons

// The buttons on the Live Activity run these, NOT the intents the home-screen
// widget uses. A LiveActivityIntent runs in the APP's process, which is the only
// place ActivityKit lets you see, update and end the activity: the widget
// extension process reports zero live activities, so the old intents could never
// show LOGGED or close the card, and it sat on the Lock Screen with live buttons
// until the app was next opened.
//
// Because the app runs them, this file is linked into both the app and the
// widget target (targets/widget/_shared).
@available(iOS 17.0, *)
struct LogBreathLiveIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Log breath"
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  static var openAppWhenRun: Bool = false

  @Parameter(title: "State")
  var state: String

  init() {}
  init(state: String) { self.state = state }

  func perform() async throws -> some IntentResult {
    SharedStore.appendPendingLog(state)
    SharedStore.markLogged()
    await completeLog(label: logLabel(state: state))
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
    let state = right >= 55 ? "right" : (right <= 45 ? "left" : "both")
    SharedStore.appendPendingBlend(state, right)
    SharedStore.markLogged()
    await completeLog(label: logLabel(state: state, right: right))
    return .result()
  }
}
