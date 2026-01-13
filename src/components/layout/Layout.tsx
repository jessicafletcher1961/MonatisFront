import { Outlet, useLocation } from "react-router-dom";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, X } from "lucide-react";
import { cn } from "@/utils/cn";

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(155,104,255,.30),transparent_55%),radial-gradient(900px_circle_at_80%_20%,rgba(255,46,139,.22),transparent_55%),radial-gradient(700px_circle_at_50%_90%,rgba(155,104,255,.18),transparent_60%)]">
      <div className="mx-auto flex max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="hidden h-screen w-72 shrink-0 border-r border-white/10 bg-black/20 backdrop-blur lg:block">
          <Sidebar />
        </aside>

        {/* Mobile header */}
        <div className="flex min-h-screen w-full flex-col">
          <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur lg:hidden">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl hover:bg-white/10"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm font-semibold">Monatis</div>
            <div className="h-10 w-10" />
          </div>

          {/* Content */}
          <main className={cn("w-full flex-1 p-4 lg:p-8", "min-w-0")}>
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      <Transition appear show={mobileOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[80] lg:hidden" onClose={() => setMobileOpen(false)}>
          <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-stretch justify-start">
              <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="-translate-x-4 opacity-0" enterTo="translate-x-0 opacity-100" leave="ease-in duration-150" leaveFrom="translate-x-0 opacity-100" leaveTo="-translate-x-4 opacity-0">
                <Dialog.Panel className="w-[320px] border-r border-white/10 bg-[#0b0613]/95 backdrop-blur">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="text-sm font-semibold">Menu</div>
                    <button className="rounded-2xl p-2 hover:bg-white/10" onClick={() => setMobileOpen(false)} aria-label="Fermer">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <Sidebar onNavigate={() => setMobileOpen(false)} />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
