
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
    setOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 shadow-lg shadow-slate-900/10">
        <div className="bg-gradient-to-r from-blue-950 via-slate-950 to-slate-900 text-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-5">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-xl text-white transition hover:bg-white/20 md:hidden"
              aria-label="Toggle menu"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? "✕" : "☰"}
            </button>

            <Link to="/" className="flex shrink-0 items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-900/40">
                BD
              </span>
              <span className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
                BD Store<span className="text-blue-400">.</span>
              </span>
            </Link>

            <form onSubmit={submit} className="hidden min-w-0 flex-1 md:flex">
              <div className="flex w-full overflow-hidden rounded-xl bg-white shadow-inner">
                <input
                  className="min-w-0 flex-1 border-0 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                  placeholder="Search products, brands and categories..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-blue-600 px-6 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  Search
                </button>
              </div>
            </form>

            <nav className="ml-auto flex shrink-0 items-center gap-3 text-sm text-white sm:gap-5">
              {user ? (
                <>
                  <Link
                    to={homeFor(user)}
                    className="hidden font-semibold transition hover:text-blue-300 sm:inline"
                  >
                    {user.role === "customer" ? "My Account" : "Dashboard"}
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      nav("/");
                    }}
                    className="hidden font-semibold text-slate-300 transition hover:text-white sm:inline"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="hidden rounded-lg border border-white/20 px-4 py-2 font-semibold transition hover:border-blue-400 hover:bg-white/10 sm:inline-flex"
                >
                  Sign in
                </Link>
              )}

              <Link
                to="/wishlist"
                aria-label="Wishlist"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl transition hover:bg-white/10 hover:text-blue-300"
                title="Wishlist"
              >
                ♡
              </Link>

              <Link
                to="/cart"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-xl transition hover:bg-white/10 hover:text-blue-300"
                aria-label="Cart"
                title="Shopping cart"
              >
                🛒
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-slate-950 bg-blue-500 px-1 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
              </Link>
            </nav>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="bg-slate-900 px-4 pb-3 md:hidden"
        >
          <div className="flex overflow-hidden rounded-xl bg-white">
            <input
              className="min-w-0 flex-1 border-0 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Search products..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </form>

        <CategoryBar open={open} close={() => setOpen(false)} />

        {open && (
          <div className="border-t border-white/10 bg-slate-950 px-4 py-4 text-white md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {user ? (
                <>
                  <Link
                    to={homeFor(user)}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-3 font-medium hover:bg-white/10"
                  >
                    {user.role === "customer" ? "My Account" : "Dashboard"}
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      nav("/");
                      setOpen(false);
                    }}
                    className="rounded-lg px-3 py-3 text-left font-medium hover:bg-white/10"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 font-medium hover:bg-white/10"
                >
                  Sign in / Create account
                </Link>
              )}

              <Link
                to="/wishlist"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 font-medium hover:bg-white/10"
              >
                Wishlist
              </Link>

              <Link
                to="/cart"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 font-medium hover:bg-white/10"
              >
                Shopping cart ({count})
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
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
    <div
      className={`${
        open ? "block" : "hidden"
      } border-t border-white/10 bg-slate-900 md:block`}
    >
      <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 py-3 text-sm">
        <NavLink
          to="/products"
          onClick={close}
          className={({ isActive }) =>
            `whitespace-nowrap font-semibold transition hover:text-blue-300 ${
              isActive ? "text-blue-400" : "text-slate-300"
            }`
          }
        >
          All Products
        </NavLink>

        {(data ?? []).map((c: any) => (
          <NavLink
            key={c.id}
            to={`/products?category=${c.slug}`}
            onClick={close}
            className={({ isActive }) =>
              `whitespace-nowrap font-medium transition hover:text-blue-300 ${
                isActive ? "text-blue-400" : "text-slate-300"
              }`
            }
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
    <footer className="mt-12 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 md:grid-cols-3">
        <div>
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 font-black shadow-lg shadow-blue-900/40">
              BD
            </span>
            <span className="text-2xl font-extrabold tracking-tight">
              BD Store<span className="text-blue-400">.</span>
            </span>
          </Link>

          <p className="mt-4 max-w-xs text-sm leading-7 text-slate-300">
            Quality general merchandise, delivered across Nigeria. Discover
            great products and enjoy a better shopping experience every day.
          </p>
        </div>

        <div className="space-y-4">
          <div className="text-base font-bold text-white">
            Need assistance?
          </div>

          <p className="text-sm leading-6 text-slate-300">
            We're happy to help with orders, products and enquiries.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="tel:+2348024498086"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-blue-400 hover:bg-blue-600"
            >
              ☎ Call us
            </a>

            <a
              href="https://wa.me/2348024498086"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              WhatsApp
            </a>
          </div>

          <a
            href="mailto:destinyeke021@gmail.com"
            className="block break-all text-sm text-blue-300 transition hover:text-white hover:underline"
          >
            ✉ destinyeke021@gmail.com
          </a>

          <div className="space-y-2 border-t border-white/10 pt-4 text-sm text-slate-300">
            <Link to="/support" className="block transition hover:text-blue-300">
              Help &amp; support
            </Link>
            <Link to="/orders" className="block transition hover:text-blue-300">
              Track an order
            </Link>
          </div>
        </div>

        <form onSubmit={sub} className="space-y-4">
          <div className="text-base font-bold text-white">
            Stay updated
          </div>

          <p className="text-sm leading-6 text-slate-300">
            Subscribe to receive our latest products and updates.
          </p>

          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              type="email"
              required
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700">
              Subscribe
            </button>
          </div>

          {msg && <div className="text-xs text-blue-300">{msg}</div>}
        </form>
      </div>

      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} BD Store. All rights reserved.
        <span className="mt-1 block text-slate-500">
          Shop with confidence.
        </span>
      </div>
    </footer>
  );
}
