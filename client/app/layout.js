import "./globals.css";
import { AppNav } from "../components/AppNav";

export const metadata = {
  title: "Football Matchday Ticketing",
  description: "Admin and supporter portal for blockchain-backed football ticketing and verification"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
