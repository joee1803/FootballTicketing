import "./globals.css";
import { AppNav } from "../components/AppNav";
import { PageTransitionShell } from "../components/PageTransitionShell";
import { ToastProvider } from "../components/ToastProvider";

export const metadata = {
  title: "Football Matchday Ticketing",
  description: "Admin and supporter portal for blockchain-backed football ticketing and verification"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AppNav />
          <PageTransitionShell>{children}</PageTransitionShell>
        </ToastProvider>
      </body>
    </html>
  );
}
