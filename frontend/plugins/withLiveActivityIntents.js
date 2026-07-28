// Adds native/BreathLiveIntents.swift to the iOS **app** target.
//
// The Live Activity's buttons need a `LiveActivityIntent`, and iOS only performs
// those in the app's process if the intent type is compiled into the app's own
// bundle. Expo local modules (modules/live-activity) are built as CocoaPods
// targets, not as app-target sources, so a file dropped there is not enough —
// hence this plugin, which copies the Swift file into ios/<Project>/ during
// prebuild and adds it to the app target's "Compile Sources" phase.
//
// Without this the intent falls back to the widget extension's same-named copy,
// where `Activity<…>.activities` is empty — the log is still recorded, but the
// Lock Screen window never confirms it and never closes.

const { withDangerousMod, withXcodeProject, IOSConfig } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SOURCE_RELATIVE = path.join("native", "BreathLiveIntents.swift");
const FILE_NAME = "BreathLiveIntents.swift";

// Copy the file next to the app target's other sources. Done in a dangerous mod
// so it lands before the Xcode project is edited.
const withIntentSourceCopied = (config) =>
  withDangerousMod(config, [
    "ios",
    (cfg) => {
      const { projectRoot, platformProjectRoot } = cfg.modRequest;
      const projectName =
        cfg.modRequest.projectName || IOSConfig.XcodeUtils.sanitizedName(cfg.name);
      const from = path.join(projectRoot, SOURCE_RELATIVE);
      const toDir = path.join(platformProjectRoot, projectName);

      if (!fs.existsSync(from)) {
        throw new Error(
          `[withLiveActivityIntents] expected ${SOURCE_RELATIVE} to exist — ` +
            "the Live Activity buttons will not close the window without it.",
        );
      }
      fs.mkdirSync(toDir, { recursive: true });
      fs.copyFileSync(from, path.join(toDir, FILE_NAME));
      return cfg;
    },
  ]);

const withIntentInAppTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName =
      cfg.modRequest.projectName || IOSConfig.XcodeUtils.sanitizedName(cfg.name);
    const filepath = `${projectName}/${FILE_NAME}`;

    // Idempotent: prebuild can run repeatedly, and adding the file twice makes
    // Xcode fail with a duplicate-symbol build error.
    if (project.hasFile(filepath)) return cfg;

    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath,
      groupName: projectName,
      project,
    });
    return cfg;
  });

module.exports = function withLiveActivityIntents(config) {
  return withIntentInAppTarget(withIntentSourceCopied(config));
};
