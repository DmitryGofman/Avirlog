// Feature flags.
//
// ACCOUNTS_ENABLED gates email/Google sign-in and cloud sync. It is OFF for
// the first release: AvirLog ships fully functional as a local, on-device app
// (no backend required). Flip this to true once a production backend is
// deployed and EXPO_PUBLIC_BACKEND_URL points at it — sign-in then reappears
// in Settings and api() resumes talking to the server when authenticated.
export const ACCOUNTS_ENABLED = false;

// The "Living Banners" Log screen: day-cycle sky on the real clock, true
// moon phase, banner buttons. Flip to false to instantly revert the Log
// screen to the classic button design (everything else is unaffected).
export const LIVING_BANNERS = true;
