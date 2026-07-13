// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover lets safe-area insets work (home indicator);
            dvh below keeps the app above mobile Safari's toolbar. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Installed to the home screen, the web app runs fullscreen. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AvirLog" />
        <meta name="theme-color" content="#0A0C16" />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              /* Mobile Safari: 100% tracks the layout viewport, which runs
                 underneath the browser toolbar and swallows the tab bar.
                 Dynamic viewport units track what is actually visible. */
              @supports (height: 100dvh) {
                html, body { height: 100dvh !important; }
                body > div:first-child { bottom: auto !important; height: 100dvh !important; }
              }
              /* Keep the tab bar clear of the home indicator when installed
                 fullscreen (safe-area insets need viewport-fit=cover). */
              [role="tablist"] {
                padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
                height: calc(62px + max(8px, env(safe-area-inset-bottom))) !important;
              }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
