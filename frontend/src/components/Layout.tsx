
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { homeFor, useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const cart = useQuery({
    queryKey: ["cart"],
    queryFn: async () => (await api.get("/cart/")).data,
  });

  const count =
    cart.data?.items?.reduce((n: number, i: any) => n + i.quantity, 0) ?? 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    nav(`/products?search=${encodeURIComponent(q)}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <button
            className="md:hidden"
            aria-label="Menu"
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>

          <Link to="/" className="text-xl font-bold tracking-tight text-brand">
            BD Store
          </Link>

          <form onSubmit={submit} className="hidden flex-1 md:block">
            <input
              className="input"
              placeholder="Search products, brands and categories"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>

          <nav className="ml-auto flex items-center gap-4 text-sm">
            {user ? (
              <>
                <Link to={homeFor(user)} className="hover:text-brand">
                  {user.role === "customer" ? "Account" : "Dashboard"}
                </Link>
                <button
                  onClick={() => {
                    logout();
                    nav("/");
                  }}
                  className="hover:text-brand"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="hover:text-brand">
                Sign in
              </Link>
            )}

            <Link to="/wishlist" aria-label="Wishlist">
              ♡
            </Link>

            <Link to="/cart" className="relative" aria-label="Cart">
              🛒
              {count > 0 && (
                <span className="absolute -right-3 -top-2 rounded-full bg-brand px-1.5 text-xs text-white">
                  {count}
                </span>
              )}
            </Link>
          </nav>
        </div>

        <form onSubmit={submit} className="px-4 pb-3 md:hidden">
          <input
            className="input"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>

        <CategoryBar open={open} close={() => setOpen(false)} />
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function CategoryBar({
  open,
  close,
}: {
  open: boolean;
  close: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories/")).data,
  });

  return (
    <div className={`${open ? "block" : "hidden"} border-t border-stone-100 md:block`}>
      <div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 py-2 text-sm">
        {(data ?? []).map((c: any) => (
          <NavLink
            key={c.id}
            to={`/products?category=${c.slug}`}
            onClick={close}
            className="whitespace-nowrap text-stone-600 hover:text-brand"
          >
            {c.name}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function Footer() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const sub = async (e: FormEvent) => {
    e.preventDefault();

    try {
      await api.post("/newsletter/", { email });
      setMsg("Thanks for subscribing!");
      setEmail("");
    } catch {
      setMsg("Enter a valid email.");
    }
  };

  return (
    <footer className="mt-10 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <div className="text-xl font-bold text-brand">BD Store</div>
          <p className="mt-2 text-sm text-stone-500">
            Quality general merchandise, delivered across Nigeria.
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-stone-800">
            Need assistance?
          </div>

          <p className="text-sm text-stone-500">
            We're happy to help with orders, products and enquiries.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="tel:+2348024498086"
              className="inline-flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-200"
            >
              ☎ Call us
            </a>

            <a
              href="https://wa.me/2348024498086"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
            >
              WhatsApp
            </a>
          </div>

          <a
            href="mailto:destinyeke021@gmail.com"
            className="block break-all text-sm text-brand hover:underline"
          >
            ✉ destinyeke021@gmail.com
          </a>

          <div className="space-y-1 pt-2 text-sm text-stone-600">
            <Link to="/support" className="block hover:text-brand">
              Help &amp; support
            </Link>
            <Link to="/orders" className="block hover:text-brand">
              Track an order
            </Link>
          </div>
        </div>

        <form onSubmit={sub} className="space-y-3">
          <div className="text-sm font-semibold text-stone-800">
            Stay updated
          </div>
          <p className="text-sm text-stone-500">
            Subscribe to receive our latest products and updates.
          </p>

          <div className="flex gap-2">
            <input
              className="input min-w-0 flex-1"
              type="email"
              required
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-primary">Subscribe</button>
          </div>

          {msg && <div className="text-xs text-stone-500">{msg}</div>}
        </form>
      </div>

      <div className="border-t border-stone-100 py-4 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} BD Store. All rights reserved.
      </div>
    </footer>
  );
}
