'use client';

/**
 * App sidebar — used inside the (app) route group layout.
 * Client Component because it reads usePathname() to highlight the active link.
 */
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV: { href: string; label: string; icon: string }[] = [
  { href: '/dashboard',   label: 'Dashboard',    icon: '📊' },
  { href: '/tasks',       label: 'All Tasks',    icon: '📋' },
  { href: '/tasks/mine',  label: 'My Tasks',     icon: '⭐' },
  { href: '/board',       label: 'Board View',   icon: '🗂️' },
  { href: '/reports',     label: 'Reports',      icon: '📈' },
  { href: '/receipts',    label: 'Receipts',     icon: '📎' },
  { href: '/contractors', label: 'Contractors',  icon: '👥' },
  { href: '/admin',       label: 'Admin',        icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 flex-col gap-1 bg-ouc-primary px-4 py-6 text-white">
      <div className="mb-3 flex items-center gap-2.5 border-b border-white/10 px-2 pb-5 pt-1">
        <Image
          src="/logos/ouc-reverse-pms432.png"
          alt="Oakwood University Church"
          width={72}
          height={36}
          className="h-9 w-auto"
        />
        <div className="leading-tight">
          <div className="text-[13px] font-bold tracking-wider">OUC TASKS</div>
          <div className="text-[11px] font-normal tracking-wider opacity-75">
            Infrastructure
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] transition-colors ${
                active
                  ? 'bg-white/15 font-semibold text-white'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4 text-xs text-white/65">
        tasks.oucsda.org
        <br />
        v0.1.0 — preview
      </div>
    </aside>
  );
}
