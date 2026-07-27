import WidgetKit
import SwiftUI
import AppIntents
import UserNotifications
import ActivityKit

// Shared App Group container. Keep this identifier in sync with
// app.config.js, expo-target.config.js, and modules/app-group-storage.
let APP_GROUP = "group.com.avirlog.app"

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

  static func armNextDue() {
    defaults?.set(Date().timeIntervalSince1970 + intervalSeconds, forKey: "nextDueAt")
  }

  static func isDueNow() -> Bool {
    guard let due = nextDueAt else { return false }
    return Date() >= due
  }
}

// MARK: - App Intent (log from a widget button)

struct LogBreathIntent: AppIntent {
  static var title: LocalizedStringResource = "Log breath"

  // Run straight from the Lock Screen without unlocking first. iOS otherwise
  // defaults to requiring authentication, which is why taps on the Lock-Screen
  // widget appeared to do nothing. Safe here: logging a nostril writes one row
  // to our own App Group container and reveals no personal data on screen.
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  // Never bounce the user into the app — the whole point is logging in place.
  static var openAppWhenRun: Bool = false

  @Parameter(title: "State")
  var state: String

  init() {}
  init(state: String) { self.state = state }

  func perform() async throws -> some IntentResult {
    SharedStore.appendPendingLog(state)
    SharedStore.markLogged()
    SharedStore.armNextDue()
    // You logged on the widget or the Live Activity — clear the classic
    // reminder and close any open logging window.
    UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    await confirmThenEndActivities()
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}

// Show "LOGGED" on the Live Activity so the tap visibly registers, then close
// it. Without the brief confirmation the window either vanished with no
// feedback or — if ending failed — sat there for the rest of the countdown.
@available(iOS 16.1, *)
func confirmThenEndActivities() async {
  for activity in Activity<BreathActivityAttributes>.activities {
    let done = BreathActivityAttributes.ContentState(endsAt: Date(), logged: true)
    if #available(iOS 16.2, *) {
      await activity.update(ActivityContent(state: done, staleDate: nil))
    }
  }
  try? await Task.sleep(nanoseconds: 900_000_000)
  for activity in Activity<BreathActivityAttributes>.activities {
    await activity.end(nil, dismissalPolicy: .immediate)
  }
}

// Log a blend from an advanced preset button. `right` is the right-nostril %.
struct LogBlendIntent: AppIntent {
  static var title: LocalizedStringResource = "Log breath blend"

  // Same as LogBreathIntent: usable while the device is locked.
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
    SharedStore.armNextDue()
    UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    await confirmThenEndActivities()
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}

// The five preset blends shown in advanced mode: (label, right-nostril %).
// 80L/65L lean Ida, 50 is even (Sushumna), 65R/80R lean Pingala.
let BLEND_PRESETS: [(String, Int)] = [("80L", 20), ("65L", 35), ("50", 50), ("65R", 65), ("80R", 80)]

// Colour a preset by which side it leans: first two Ida, middle even, last two Pingala.
func blendPresetColor(_ i: Int, _ left: Color, _ both: Color, _ right: Color) -> Color {
  return i < 2 ? left : (i == 2 ? both : right)
}

// MARK: - Live Activity

// Attributes shared with the app's LiveActivityModule. ActivityKit matches the
// app's Activity<BreathActivityAttributes> to this widget by TYPE, so this
// struct must stay byte-for-byte identical to the one in
// modules/live-activity/ios/LiveActivityModule.swift (see LIVEACTIVITY.md).
struct BreathActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var endsAt: Date   // when this logging window closes
    var logged: Bool   // set true after a log, for a brief confirmation
  }
  var title: String
}

@available(iOS 16.1, *)
struct BreathLiveActivity: Widget {
  private let leftColor = Color(red: 0.33, green: 0.40, blue: 0.35)
  private let rightColor = Color(red: 0.54, green: 0.30, blue: 0.24)
  private let bothColor = Color(red: 0.42, green: 0.42, blue: 0.40)

  var body: some WidgetConfiguration {
    ActivityConfiguration(for: BreathActivityAttributes.self) { context in
      // Lock Screen / banner presentation.
      VStack(spacing: 9) {
        HStack {
          Text(context.state.logged ? "LOGGED" : "LOG YOUR BREATH")
            .font(.system(size: 11, weight: .heavy)).tracking(1.5)
          Spacer()
          if !context.state.logged {
            Text(timerInterval: Date()...context.state.endsAt, countsDown: true)
              .font(.system(size: 13, weight: .semibold).monospacedDigit())
              .multilineTextAlignment(.trailing)
              .frame(maxWidth: 54)
          }
        }
        .foregroundColor(.white.opacity(0.85))
        if !context.state.logged {
          HStack(spacing: 7) {
            if SharedStore.advanced {
              ForEach(0..<BLEND_PRESETS.count, id: \.self) { i in
                laBlendButton(BLEND_PRESETS[i], blendPresetColor(i, leftColor, bothColor, rightColor))
              }
            } else {
              laButton("Left", "left", leftColor)
              laButton("Both", "both", bothColor)
              laButton("Right", "right", rightColor)
            }
          }
        }
      }
      .padding(14)
      .activityBackgroundTint(Color.black.opacity(0.55))
      .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          HStack(spacing: 7) {
            if SharedStore.advanced {
              ForEach(0..<BLEND_PRESETS.count, id: \.self) { i in
                laBlendButton(BLEND_PRESETS[i], blendPresetColor(i, leftColor, bothColor, rightColor))
              }
            } else {
              laButton("L", "left", leftColor)
              laButton("B", "both", bothColor)
              laButton("R", "right", rightColor)
            }
          }
          .padding(.vertical, 4)
        }
      } compactLeading: {
        Image(systemName: "wind")
      } compactTrailing: {
        Text(timerInterval: Date()...context.state.endsAt, countsDown: true)
          .font(.system(size: 12, weight: .semibold).monospacedDigit())
          .frame(maxWidth: 44)
      } minimal: {
        Image(systemName: "wind")
      }
    }
  }

  func laButton(_ label: String, _ state: String, _ color: Color) -> some View {
    Button(intent: LogBreathIntent(state: state)) {
      Text(label)
        .font(.system(size: 15, weight: .heavy))
        .foregroundColor(.white)
        .frame(maxWidth: .infinity, minHeight: 34)
        .background(color)
        .clipShape(RoundedRectangle(cornerRadius: 9))
    }
    .buttonStyle(.plain)
  }

  func laBlendButton(_ preset: (String, Int), _ color: Color) -> some View {
    Button(intent: LogBlendIntent(right: preset.1)) {
      Text(preset.0)
        .font(.system(size: 12, weight: .heavy))
        .minimumScaleFactor(0.7)
        .lineLimit(1)
        .foregroundColor(.white)
        .frame(maxWidth: .infinity, minHeight: 34)
        .background(color)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    .buttonStyle(.plain)
  }
}

// MARK: - Timeline

struct BreathEntry: TimelineEntry {
  let date: Date
  let due: Bool
  let justLogged: Bool
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> BreathEntry {
    BreathEntry(date: Date(), due: false, justLogged: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (BreathEntry) -> Void) {
    completion(BreathEntry(date: Date(), due: SharedStore.isDueNow(), justLogged: SharedStore.justLogged()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BreathEntry>) -> Void) {
    let now = Date()
    var entries: [BreathEntry] = []
    let due = SharedStore.nextDueAt
    entries.append(BreathEntry(date: now, due: (due != nil && now >= due!), justLogged: SharedStore.justLogged()))
    if let due = due, due > now {
      entries.append(BreathEntry(date: due, due: true, justLogged: false))
    }
    let refreshAt = (due != nil && due! > now) ? due! : now.addingTimeInterval(600)
    completion(Timeline(entries: entries, policy: .after(refreshAt)))
  }
}

// MARK: - View

// One view for every supported size. Everything that changes with the widget
// family (button height, type size, full words vs initials, whether the dark
// card is drawn at all) is derived from `family`, so you can add the small,
// medium or large widget and it fills the space properly instead of staying tiny.
struct AvirLogWidgetView: View {
  var entry: BreathEntry
  // Fixed per widget kind — the widget you added never changes mode by itself.
  var advanced: Bool
  @Environment(\.widgetFamily) private var family

  private let leftColor = Color(red: 0.33, green: 0.40, blue: 0.35)
  private let rightColor = Color(red: 0.54, green: 0.30, blue: 0.24)
  private let bothColor = Color(red: 0.42, green: 0.42, blue: 0.40)

  // Lock-Screen accessory widgets are rendered monochrome/vibrant by iOS, so
  // they get no dark card and no coloured fills — just outlined buttons.
  private var isAccessory: Bool { family == .accessoryRectangular }
  private var isWide: Bool { family == .systemMedium || family == .systemLarge }

  private var buttonHeight: CGFloat {
    switch family {
    case .systemLarge: return 66
    case .systemMedium: return 50
    case .systemSmall: return 38
    default: return 26 // accessoryRectangular
    }
  }
  private var titleSize: CGFloat { isAccessory ? 9 : (family == .systemLarge ? 13 : 10) }
  private var gap: CGFloat { isAccessory ? 3 : (advanced ? 4 : 6) }

  var body: some View {
    VStack(spacing: isAccessory ? 3 : 8) {
      Text(entry.justLogged ? "LOGGED ✓" : (entry.due ? "LOG NOW" : "BREATH"))
        .font(.system(size: titleSize, weight: .heavy))
        .tracking(2)
        .foregroundColor(isAccessory ? .primary : (entry.due ? .white : .secondary))

      HStack(spacing: gap) {
        if advanced {
          ForEach(0..<BLEND_PRESETS.count, id: \.self) { i in
            blendButton(BLEND_PRESETS[i], blendPresetColor(i, leftColor, bothColor, rightColor))
          }
        } else {
          button(isWide ? "Left" : "L", "left", leftColor)
          button(isWide ? "Both" : "B", "both", bothColor)
          button(isWide ? "Right" : "R", "right", rightColor)
        }
      }

      // The large widget has room to spare — say what the buttons do.
      if family == .systemLarge {
        Text(advanced
             ? "Tap a blend — how open each nostril is"
             : "Tap the nostril that is open now")
          .font(.system(size: 11))
          .foregroundColor(.white.opacity(0.5))
          .multilineTextAlignment(.center)
      }
    }
    .opacity(entry.justLogged ? 0.55 : 1)
    .padding(isAccessory ? 0 : 12)
    .widgetBackground(dark: !isAccessory, due: entry.due)
  }

  func button(_ label: String, _ state: String, _ color: Color) -> some View {
    Button(intent: LogBreathIntent(state: state)) {
      Text(label)
        .font(.system(size: isAccessory ? 12 : (isWide ? 20 : 17), weight: .heavy))
        .minimumScaleFactor(0.6)
        .lineLimit(1)
        .foregroundColor(isAccessory ? .primary : .white)
        .frame(maxWidth: .infinity, minHeight: buttonHeight)
        .background(buttonFill(color))
        .clipShape(RoundedRectangle(cornerRadius: isAccessory ? 6 : 10))
    }
    .buttonStyle(.plain)
  }

  func blendButton(_ preset: (String, Int), _ color: Color) -> some View {
    Button(intent: LogBlendIntent(right: preset.1)) {
      Text(preset.0)
        .font(.system(size: isAccessory ? 9 : (isWide ? 15 : 11), weight: .heavy))
        .minimumScaleFactor(0.5)
        .lineLimit(1)
        .foregroundColor(isAccessory ? .primary : .white)
        .frame(maxWidth: .infinity, minHeight: buttonHeight)
        .background(buttonFill(color))
        .clipShape(RoundedRectangle(cornerRadius: isAccessory ? 5 : 8))
    }
    .buttonStyle(.plain)
  }

  // Accessory widgets can't carry our palette (iOS tints them), so use a faint
  // wash there and the real cloth colour everywhere else.
  @ViewBuilder
  func buttonFill(_ color: Color) -> some View {
    if isAccessory {
      RoundedRectangle(cornerRadius: 6).fill(Color.white.opacity(0.22))
    } else {
      color
    }
  }
}

private extension View {
  // The dark card + LOG-NOW border, skipped for Lock-Screen accessory widgets.
  @ViewBuilder
  func widgetBackground(dark: Bool, due: Bool) -> some View {
    if dark {
      self
        .containerBackground(for: .widget) { Color.black.opacity(due ? 0.92 : 0.82) }
        .overlay(
          RoundedRectangle(cornerRadius: 18)
            .stroke(due ? Color.white : Color.white.opacity(0.12), lineWidth: due ? 3 : 1)
        )
    } else {
      self.containerBackground(for: .widget) { Color.clear }
    }
  }
}

// MARK: - Widget

// Two separate widgets rather than one that changes mode on its own: you pick
// which to add, and the one on your screen stays as you chose it. Both offer
// every practical size, so you can add whichever size you want (iOS has no
// resize — remove and re-add at another size).
struct AvirLogWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "AvirLogWidget", provider: Provider()) { entry in
      AvirLogWidgetView(entry: entry, advanced: false)
    }
    .configurationDisplayName("Breath Log")
    .description("Tap Left, Both or Right. Lights up when it's time to log.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
  }
}

// The advanced counterpart: same widget, preset-blend buttons instead of
// Left/Both/Right. Shown as its own choice in the widget gallery.
struct AvirLogBlendWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "AvirLogBlendWidget", provider: Provider()) { entry in
      AvirLogWidgetView(entry: entry, advanced: true)
    }
    .configurationDisplayName("Breath Blend")
    .description("Tap a preset blend — how open each nostril is. Lights up when it's time to log.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
  }
}

@main
struct AvirLogWidgetBundle: WidgetBundle {
  var body: some Widget {
    AvirLogWidget()
    AvirLogBlendWidget()
    if #available(iOS 16.1, *) {
      BreathLiveActivity()
    }
  }
}
