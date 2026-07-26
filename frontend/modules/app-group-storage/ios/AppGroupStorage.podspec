# Podspec for the local AppGroupStorage Expo module.
#
# Without this file CocoaPods never compiles AppGroupStorageModule.swift, so the
# native module does not exist at runtime and every widgetBridge call silently
# no-ops (requireOptionalNativeModule returns null) — which means widget taps
# never reach History and the shared "advanced" flag never reaches the widget.
Pod::Spec.new do |s|
  s.name           = 'AppGroupStorage'
  s.version        = '1.0.0'
  s.summary        = 'Shared App Group storage bridge for the AvirLog widget'
  s.description    = 'Lets the JS app read/write the App Group store shared with the WidgetKit extension and reload the widget timeline.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
