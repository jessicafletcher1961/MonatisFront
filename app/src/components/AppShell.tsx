import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";

export function AppShell() {
  return (
    <div className="relative min-h-screen fade-in-glam">
      <Sidebar />
      <div className="mx-auto min-h-screen max-w-[1400px] px-6 py-6 lg:pl-[calc(250px+1.5rem)]">
        <div className="flex min-h-[calc(100vh-3rem)] flex-col">
          <Topbar />
          <main className="mt-6 flex-1 pb-24 lg:pb-0 rise-in-glam">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
