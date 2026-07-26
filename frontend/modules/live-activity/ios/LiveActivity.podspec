# Podspec for the local LiveActivity Expo module.
#
# Without this file CocoaPods never compiles LiveActivityModule.swift, so the
# native module does not exist at runtime and startBreathWindow()/endBreathWindow()
# silently no-op — which is why no Live Activity ever appeared on the Lock Screen.
Pod::Spec.new do |s|
  s.name           = 'LiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Starts and ends the AvirLog breath-logging Live Activity'
  s.description    = 'App-process control for the ActivityKit logging window rendered by the widget extension.'
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
