"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Icons from "lucide-react";
import { ChevronDown, Menu, X } from "lucide-react";
import NotificationCenter from "@/components/notification-center";
import { approvalInboxQueryKeys, useApprovalInbox } from "@/lib/approval-inbox-queries";
import { initials, navGroups } from "@/lib/erp";
import { getPendingOrderCount, UserAccount } from "@/lib/user-api";

export const iconMap = Icons as unknown as Record<
  string,
  React.ComponentType<{ className?: string }>
>;

export function Sidebar({
  active,
  setActive,
  collapsed,
  setCollapsed,
  mobileNav,
  setMobileNav,
  companyName,
  companyLogoUrl,
  canReadAssets,
  canReadCustomers,
  canReadSales,
}: {
  active: string;
  setActive: (value: string) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  mobileNav: boolean;
  setMobileNav: (value: boolean) => void;
  companyName: string;
  companyLogoUrl: string;
  canReadAssets: boolean;
  canReadCustomers: boolean;
  canReadSales: boolean;
}) {
  const queryClient = useQueryClient();
  const approvalInboxQuery = useApprovalInbox();
  const pendingOrdersQuery = useQuery({
    queryKey: ["orders", "pending-count"],
    queryFn: getPendingOrderCount,
    enabled: canReadSales,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const approvalInProgressCount = approvalInboxQuery.data?.counts.inProgress;
  const pendingOrderCount = pendingOrdersQuery.data;
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (item.label !== "Assets Management" || canReadAssets) &&
          (item.label !== "Customer Management" || canReadCustomers) &&
          (item.label !== "Sales" || canReadSales) &&
          (item.label !== "Credit Sales" || canReadSales) &&
          (item.label !== "Receipt Management" || canReadSales),
      ),
    }))
    .filter((group) => group.items.length > 0);
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/30 lg:hidden ${mobileNav ? "block" : "hidden"}`}
        onClick={() => setMobileNav(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ${mobileNav ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[76px]" : "lg:translate-x-0"} lg:translate-x-0`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-5">
          <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#6d28d9] text-sm font-bold text-white shadow-lg shadow-purple-200">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt=""
                className="size-full bg-white object-contain p-1"
              />
            ) : (
              companyName.charAt(0).toUpperCase()
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div
                className="max-w-40 truncate text-[15px] font-bold tracking-tight"
                title={companyName}
              >
                {companyName}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Management system
              </div>
            </div>
          )}
          <button
            aria-label="Close navigation"
            className="ml-auto lg:hidden"
            onClick={() => setMobileNav(false)}
          >
            <X className="size-5 text-slate-400" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {visibleNavGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <div
                className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ${collapsed ? "lg:hidden" : ""}`}
              >
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = iconMap[item.icon] || LayoutFallback;
                const comingSoon = [
                  "Analysis",
                  "Data Backup",
                  "Invoicing",
                ].includes(item.label);
                return (
                  <button
                    key={item.label}
                    title={collapsed
                      ? `${item.label}${comingSoon ? " (coming soon!)" : ""}${item.label === "Approvals" && approvalInProgressCount !== undefined ? ` · ${approvalInProgressCount} in progress` : ""}${item.label === "Orders" && pendingOrderCount !== undefined ? ` · ${pendingOrderCount} pending` : ""}`
                      : undefined}
                    aria-label={
                      `${comingSoon ? `${item.label} (coming soon!)` : item.label}${item.label === "Approvals" && approvalInProgressCount !== undefined ? `, ${approvalInProgressCount} in progress` : item.label === "Approvals" && approvalInboxQuery.isError ? ", in-progress count unavailable" : ""}${item.label === "Orders" && pendingOrderCount !== undefined ? `, ${pendingOrderCount} pending` : item.label === "Orders" && pendingOrdersQuery.isError ? ", pending count unavailable" : ""}`
                    }
                    disabled={comingSoon}
                    onClick={() => {
                      if (item.label === "Approvals") {
                        void queryClient.invalidateQueries({ queryKey: approvalInboxQueryKeys.all });
                      }
                      if (item.label === "Orders") {
                        void queryClient.invalidateQueries({ queryKey: ["orders", "pending-count"] });
                      }
                      setActive(item.label);
                    }}
                    className={`group relative mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition ${comingSoon ? "cursor-not-allowed text-slate-400" : active === item.label ? "bg-[#f1eafd] text-[#6d28d9]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
                  >
                    <Icon
                      className={`size-[17px] shrink-0 ${active === item.label ? "text-[#6d28d9]" : "text-slate-400 group-hover:text-slate-600"}`}
                    />
                    {!collapsed && (
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <span className="truncate">{item.label}</span>
                        {comingSoon && (
                          <span className="shrink-0 text-[10px] font-medium text-slate-400">
                            (coming soon!)
                          </span>
                        )}
                      </span>
                    )}
                    {(item.label === "Approvals" || item.label === "Orders" && canReadSales) && (
                      <span
                        aria-hidden="true"
                        className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${active === item.label ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-600"} ${collapsed ? "absolute right-1 top-0.5 min-w-4 px-1 text-center text-[9px]" : ""}`}
                      >
                        {item.label === "Approvals"
                          ? approvalInProgressCount === undefined
                            ? approvalInboxQuery.isError ? "!" : "…"
                            : approvalInProgressCount > 99 ? "99+" : approvalInProgressCount
                          : pendingOrderCount === undefined
                            ? pendingOrdersQuery.isError ? "!" : "…"
                            : pendingOrderCount > 99 ? "99+" : pendingOrderCount}
                      </span>
                    )}
                    {!collapsed && active === item.label && (
                      <span className="ml-auto size-1.5 rounded-full bg-[#6d28d9]" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export function LayoutFallback({ className }: { className?: string }) {
  return <div className={className} />;
}

export function Header({
  active,
  setMobileNav,
  currentUser,
  onNavigate,
  onLogout,
  onChangePassword,
}: {
  active: string;
  setMobileNav: (value: boolean) => void;
  currentUser: UserAccount;
  onNavigate: (section: string) => void;
  onLogout: () => void;
  onChangePassword: () => void;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !profileMenuRef.current?.contains(event.target)
      )
        setProfileMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          aria-label="Open navigation"
          onClick={() => setMobileNav(true)}
          className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-slate-600">{active}</span>
          </div>
          {currentUser.roles.includes("Super Admin") && (
            <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
              Temporary all-department access
            </span>
          )}
          {/* <h1 className="mt-0.5 text-lg font-bold tracking-tight sm:text-xl">
            {active}
          </h1> */}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        {/* <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:flex"><Search className="size-4 text-slate-400" /><input className="w-36 bg-transparent text-xs outline-none placeholder:text-slate-400" placeholder="Search anything..." /></div> */}
        <NotificationCenter currentUser={currentUser} onNavigate={onNavigate} />
        <div className="hidden h-7 w-px bg-slate-200 sm:block" />
        <div ref={profileMenuRef} className="relative">
          <button
            type="button"
            aria-label="Open user menu"
            aria-haspopup="menu"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg p-1.5 text-left hover:bg-slate-50"
          >
            <div className="grid size-8 place-items-center rounded-full bg-[#e9ddff] text-[10px] font-bold text-[#6d28d9]">
              {initials(currentUser.name)}
            </div>
            <div className="hidden text-left sm:block">
              <div className="text-xs font-semibold">{currentUser.name}</div>
              <div className="text-[10px] text-slate-400">
                {currentUser.roles.join(" · ")}
              </div>
            </div>
            <ChevronDown
              className={`hidden size-3.5 text-slate-400 transition-transform sm:block ${profileMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {profileMenuOpen && (
            <div
              role="menu"
              aria-label="User menu"
              className="absolute right-0 top-full z-40 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onChangePassword();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Icons.KeyRound className="size-3.5" />
                Change password
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                <Icons.LogOut className="size-3.5" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
