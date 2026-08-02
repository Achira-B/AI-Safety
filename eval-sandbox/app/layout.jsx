import "./globals.css";

export const metadata = {
  title: "Eval Sandbox",
  description:
    "Ask the same question several ways, across several models, and see whether the answers change.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
