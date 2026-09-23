import type { Metadata } from "next";
import SiteEnhancements from "@/src/components/site-enhancements";
import "./globals.css";
import "./marketplace.css";
import "./home-sections.css";
import "./page-experience.css";
import "./auth.css";
import "./ui-components.css";

export const metadata: Metadata = {
  title: "HomeFoods — Homemade happiness, delivered",
  description: "Discover lovely homemade food from independent home cooks in your neighbourhood.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col"><SiteEnhancements />{children}</body>
    </html>
  );
}
