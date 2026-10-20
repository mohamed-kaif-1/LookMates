import type { Metadata } from "next";
import "./globals.css";
import React from "react";

export const metadata: Metadata = {
  title: "LookMates — Different styles. One perfect moment.",
  description: "DuoMatch AI-powered collaborative couple styling and virtual try-on with YouCam Apparel VTO.",
  keywords: ["virtual try-on", "couple styling", "fashion ai", "youcam", "vto", "wedding outfits", "duomatch"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
