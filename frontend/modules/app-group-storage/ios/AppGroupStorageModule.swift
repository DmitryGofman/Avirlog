import ExpoModulesCore
import WidgetKit

// Lets the JS app read/write the App Group store shared with the widget, and
// reload the widget's timeline. Keep the group id in sync with the widget.
private let APP_GROUP = "group.com.avirlog.app"

public class AppGroupStorageModule: Module {
  private var store: UserDefaults? { UserDefaults(suiteName: APP_GROUP) }

  public func definition() -> ModuleDefinition {
    Name("AppGroupStorage")

    Function("setNumber") { (key: String, value: Double) in
      self.store?.set(value, forKey: key)
    }

    Function("getNumber") { (key: String) -> Double in
      return self.store?.double(forKey: key) ?? 0
    }

    Function("setString") { (key: String, value: String) in
      self.store?.set(value, forKey: key)
    }

    Function("getString") { (key: String) -> String? in
      return self.store?.string(forKey: key)
    }

    Function("remove") { (key: String) in
      self.store?.removeObject(forKey: key)
    }

    Function("reloadWidget") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
