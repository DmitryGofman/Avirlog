// Feature flags.
//
// ACCOUNTS_ENABLED gates email/Google sign-in and cloud sync. It is OFF for
// the first release: AvirLog ships fully functional as a local, on-device app
// (no backend required). Flip this to true once a production backend is
// deployed and EXPO_PUBLIC_BACKEND_URL points at it — sign-in then reappears
// in Settings and api() resumes talking to the server when authenticated.
export const ACCOUNTS_ENABLED = false;
