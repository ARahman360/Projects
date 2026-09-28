import type { Metadata } from "next";
import AppShell from "@/src/components/app-shell";
import SiteEnhancements from "@/src/components/site-enhancements";
import "./globals.css";
import "./marketplace.css";
import "./home-sections.css";
import "./page-experience.css";
import "./auth.css";
import "./ui-components.css";
import "./favorites.css";
import "./addresses.css";
import "./theme-system.css";
import "./customer-collections.css";
import "./operations.css";
import "./admin-workspace.css";
import "./app-navigation.css";
import "./kitchen-experience.css";
import "./account-experience.css";

export const metadata: Metadata = {
  title: "HomeFoods — Homemade happiness, delivered",
  description: "Discover lovely homemade food from independent home cooks in your neighbourhood.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.dataset.theme=localStorage.getItem('home-foods-theme')==='dark'?'dark':'light'}catch{}"}}/></head>
      <body className="min-h-full flex flex-col"><SiteEnhancements /><AppShell>{children}</AppShell></body>
    </html>
  );
}
