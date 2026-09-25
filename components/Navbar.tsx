import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/sugerencias", label: "Sugerencias" },
  { href: "/sugerencias/lista", label: "Ver sugerencias" },
];

export default function Navbar() {
  return (
    <nav className="flex items-center gap-6 border-b border-zinc-200 bg-white px-6 py-4">
      <Link href="/" className="text-lg font-semibold">
        Mis Sugerencias
      </Link>
      <div className="flex flex-1 justify-end gap-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}