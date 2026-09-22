import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Navigation } from "@/components/navigation";

export const metadata: Metadata = {
  title: "REDmesh — Enterprise Resource Access & Provisioning",
  description: "Enterprise resource access, authorization, and provisioning platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 min-h-screen flex flex-col antialiased bg-mesh-grid selection:bg-cyan-500/30 selection:text-cyan-200">
        <AuthProvider>
          <Navigation />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-surface-border py-6 text-center text-xs text-slate-500 font-sans">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span>REDmesh — Enterprise Resource Access & Provisioning Platform</span>
              <span className="text-slate-500 font-mono text-[11px]">REDmesh • Evaluation Environment</span>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
