import type { Metadata } from "next";
import "./admin.css"; // verbatim <style> from admin_dashboard_3.html (identical to _1/_2)
import "./admin-extras.css"; // only for things the prototype never had (login, sign-out)

export const metadata: Metadata = { title: "AdMaya.ai — Team Dashboard", robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
