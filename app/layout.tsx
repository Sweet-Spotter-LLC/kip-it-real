import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";

export const metadata: Metadata = {
  title: "Kip It Real — Find your sweet spot",
  description:
    "Unbiased glove matching for baseball, fastpitch, and slowpitch players. Powered by Sweet Spotter.",
  openGraph: {
    title: "Kip It Real",
    description:
      "Find your glove fit. Unbiased matching for baseball, fastpitch, and slowpitch.",
    siteName: "Kip It Real",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Inter + Fraunces — matches premium sports-product feel. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-brand-bg text-brand-text">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
