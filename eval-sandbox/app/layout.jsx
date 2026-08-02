import "./globals.css";

export const metadata = {
  title: "Eval Sandbox — elicitation sweep",
  description:
    "Hold the measurement constant, sweep the framing, compare models. A no-code instrument for behavioural evaluation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
