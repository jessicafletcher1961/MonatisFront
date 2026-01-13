import * as React from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
};

export function Modal({ open, onClose, title, children, footer, wide }: Props) {
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-2 scale-[0.98]"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-2 scale-[0.98]"
            >
              <Dialog.Panel
                className={cn(
                  "w-full rounded-3xl border border-white/10 bg-[#12081f]/95 p-5 shadow-[0_25px_100px_rgba(0,0,0,.65)] backdrop-blur",
                  wide ? "max-w-4xl" : "max-w-xl"
                )}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    {title ? <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title> : null}
                    <div className="text-sm text-white/60">Monatis</div>
                  </div>
                  <button className="rounded-2xl p-2 hover:bg-white/10" onClick={onClose} aria-label="Fermer">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">{children}</div>

                {footer ? (
                  <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
                    {footer}
                  </div>
                ) : null}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
