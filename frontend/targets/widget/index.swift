import WidgetKit
import SwiftUI
import AppIntents
import UserNotifications

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

  static func appendPendingLog(_ state: String) {
    guard let d = defaults else { return }
    var arr: [[String: Any]] = []
    if let raw = d.string(forKey: "pendingLogs"),
       let data = raw.data(using: .utf8),
       let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
      arr = parsed
    }
    arr.append(["state": state, "at": Date().timeIntervalSince1970])
    if let out = try? JSONSerialization.data(withJSONObject: arr),
       let s = String(data: out, encoding: .utf8) {
      d.set(s, forKey: "pendingLogs")
    }
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

  @Parameter(title: "State")
  var state: String

  init() {}
  init(state: String) { self.state = state }

  func perform() async throws -> some IntentResult {
    SharedStore.appendPendingLog(state)
    SharedStore.armNextDue()
    // You logged on the widget — clear the classic reminder.
    UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    WidgetCenter.shared.reloadAllTimelines()
    return .result()
  }
}

// MARK: - Timeline

struct BreathEntry: TimelineEntry {
  let date: Date
  let due: Bool
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> BreathEntry {
    BreathEntry(date: Date(), due: false)
  }

  func getSnapshot(in context: Context, completion: @escaping (BreathEntry) -> Void) {
    completion(BreathEntry(date: Date(), due: SharedStore.isDueNow()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<BreathEntry>) -> Void) {
    let now = Date()
    var entries: [BreathEntry] = []
    let due = SharedStore.nextDueAt
    entries.append(BreathEntry(date: now, due: (due != nil && now >= due!)))
    if let due = due, due > now {
      entries.append(BreathEntry(date: due, due: true))
    }
    let refreshAt = (due != nil && due! > now) ? due! : now.addingTimeInterval(600)
    completion(Timeline(entries: entries, policy: .after(refreshAt)))
  }
}

// MARK: - View

struct AvirLogWidgetView: View {
  var entry: BreathEntry

  private let leftColor = Color(red: 0.33, green: 0.40, blue: 0.35)
  private let rightColor = Color(red: 0.54, green: 0.30, blue: 0.24)
  private let bothColor = Color(red: 0.42, green: 0.42, blue: 0.40)

  var body: some View {
    VStack(spacing: 6) {
      Text(entry.due ? "LOG NOW" : "BREATH")
        .font(.system(size: 10, weight: .heavy))
        .tracking(2)
        .foregroundColor(entry.due ? .white : .secondary)
      HStack(spacing: 5) {
        button("L", "left", leftColor)
        button("R", "right", rightColor)
        button("B", "both", bothColor)
      }
    }
    .padding(8)
    .containerBackground(for: .widget) {
      Color.black.opacity(entry.due ? 0.92 : 0.82)
    }
    .overlay(
      RoundedRectangle(cornerRadius: 18)
        .stroke(entry.due ? Color.white : Color.white.opacity(0.12),
                lineWidth: entry.due ? 3 : 1)
    )
  }

  func button(_ label: String, _ state: String, _ color: Color) -> some View {
    Button(intent: LogBreathIntent(state: state)) {
      Text(label)
        .font(.system(size: 17, weight: .heavy))
        .foregroundColor(.white)
        .frame(maxWidth: .infinity, minHeight: 36)
        .background(color)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
    .buttonStyle(.plain)
  }
}

// MARK: - Widget

struct AvirLogWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "AvirLogWidget", provider: Provider()) { entry in
      AvirLogWidgetView(entry: entry)
    }
    .configurationDisplayName("Breath Log")
    .description("Log Left, Right or Both. Lights up when it's time.")
    .supportedFamilies([.systemSmall, .accessoryRectangular])
  }
}

@main
struct AvirLogWidgetBundle: WidgetBundle {
  var body: some Widget {
    AvirLogWidget()
  }
}
