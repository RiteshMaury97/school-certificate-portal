import Link from "next/link";
import { ChevronRight, MoreHorizontal } from "lucide-react";

import type { ComponentProps, ReactNode } from "react";

type ClassNameProps = { className?: string };

export function Breadcrumb({ className, ...props }: ComponentProps<"nav">) {
  return <nav aria-label="Breadcrumb" className={className} {...props} />;
}

export function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      className={`flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)] ${className ?? ""}`}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
  return <li className={`inline-flex items-center gap-1.5 ${className ?? ""}`} {...props} />;
}

type BreadcrumbLinkProps = ClassNameProps & {
  href: ComponentProps<typeof Link>["href"];
  children: ReactNode;
};

export function BreadcrumbLink({ href, className, children }: BreadcrumbLinkProps) {
  return (
    <Link
      href={href}
      className={`no-underline transition-colors hover:text-[var(--primary)] hover:no-underline ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}

export function BreadcrumbPage({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      className={`font-medium text-[var(--text)] ${className ?? ""}`}
      {...props}
    />
  );
}

export function BreadcrumbSeparator({
  children,
  className,
}: ClassNameProps & { children?: ReactNode }) {
  return (
    <li
      aria-hidden="true"
      role="presentation"
      className={`text-[var(--text-muted)] ${className ?? ""}`}
    >
      {children ?? <ChevronRight size={14} strokeWidth={1.75} />}
    </li>
  );
}

export function BreadcrumbEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-7 w-7 items-center justify-center ${className ?? ""}`}
      {...props}
    >
      <MoreHorizontal size={15} />
      <span className="sr-only">More</span>
    </span>
  );
}
