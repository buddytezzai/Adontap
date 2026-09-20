import type { Metadata } from "next";
import "./site.css"; // verbatim <style> from vaani_prototype_6.html
import "./site-extras.css"; // only for states the prototype never had (loading / empty / 404)

export const metadata: Metadata = { title: "AdMaya.ai" };

// The public site and /admin are separate root layouts on purpose: both prototypes define
// colliding global rules (.topbar, .toast, .field, .tmpl-thumb …), so each gets its own document.
export default function SiteRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans:ital@1&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
