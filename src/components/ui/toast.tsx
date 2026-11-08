"use client";

import { Toast } from "@base-ui/react/toast";
import { CheckCircle2, CircleAlert, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";

const toast = Toast.createToastManager();
export { toast };

const icons = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  loading: LoaderCircle,
};
type ToastType = keyof typeof icons;

function isToastType(type: string | undefined): type is ToastType {
  return Boolean(type && Object.hasOwn(icons, type));
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none">
        {toasts.map((item) => {
          const type = isToastType(item.type) ? item.type : "info";
          const Icon = icons[type];
          return (
            <Toast.Root key={item.id} toast={item} className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-xl data-[type=error]:border-[var(--danger)]/50 data-[type=success]:border-emerald-500/50">
              <Toast.Content className="flex items-start gap-3">
                <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${type === "loading" ? "animate-spin" : ""}`} />
                <div className="min-w-0 flex-1">
                  {item.title ? <Toast.Title className="font-semibold" /> : null}
                  {item.description ? <Toast.Description className="mt-1 text-sm text-[var(--text-muted)]" /> : null}
                </div>
                {item.actionProps ? <Toast.Action className="rounded-md border border-[var(--divider)] px-2 py-1 text-sm font-medium" /> : null}
                <Toast.Close aria-label="Dismiss notification" className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)]"><X className="size-4" /></Toast.Close>
              </Toast.Content>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={toast} timeout={15_000}>
      <ToastList />
    </Toast.Provider>
  );
}
