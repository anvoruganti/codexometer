import Link from "next/link";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/compare", label: "Comparison" },
  { href: "/posts", label: "Post Explorer" },
  { href: "/methodology", label: "Methodology" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/30 px-4 py-6 lg:flex">
      <div className="mb-6 font-semibold">Navigation</div>
      <nav className="flex flex-col gap-2 text-sm">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-muted-foreground transition hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
