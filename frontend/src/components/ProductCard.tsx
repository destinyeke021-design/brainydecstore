
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, errMsg } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { money } from "../utils/format";
import { Countdown } from "./ui";

export default function ProductCard({ p }: { p: any }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const add = useMutation({
    mutationFn: () =>
      api.post("/cart/items/", { product: p.id, quantity: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
    onError: (e) => alert(errMsg(e)),
  });

  const wish = useMutation({
    mutationFn: () => api.post("/wishlist/", { product: p.id }),
    onSuccess: () => alert("Saved to wishlist"),
    onError: (e) => alert(errMsg(e)),
  });

  const img =
    p.images?.find((i: any) => i.is_primary) ?? p.images?.[0];

  const onSale = Number(p.current_price) < Number(p.regular_price);

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
      {/* Product image */}
      <div className="relative overflow-hidden bg-slate-50">
        <Link
          to={`/products/${p.slug}`}
          className="block aspect-square overflow-hidden"
        >
          {img ? (
            <img
              src={img.image}
              alt={img.alt_text || p.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm font-medium text-slate-400">
              No image available
            </div>
          )}
        </Link>

        {onSale && (
          <span className="absolute left-3 top-3 rounded-lg bg-blue-700 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            SALE
          </span>
        )}

        {!p.in_stock && (
          <span className="absolute inset-x-0 bottom-0 bg-slate-950/75 py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
            Out of stock
          </span>
        )}

        {user?.role === "customer" && (
          <button
            type="button"
            aria-label="Add to wishlist"
            title="Add to wishlist"
            onClick={() => wish.mutate()}
            disabled={wish.isPending}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-xl text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          >
            ♡
          </button>
        )}
      </div>

      {/* Product details */}
      <div className="flex flex-1 flex-col p-3.5">
        <Link
          to={`/products/${p.slug}`}
          className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-800 transition hover:text-blue-700"
        >
          {p.name}
        </Link>

        {/* Pricing */}
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-base font-extrabold text-blue-800">
            {money(p.current_price)}
          </span>

          {onSale && (
            <span className="text-xs text-slate-400 line-through">
              {money(p.regular_price)}
            </span>
          )}
        </div>

        {/* Flash sale */}
        {p.flash_sale_ends_at && (
          <div className="mt-2 rounded-lg bg-blue-50 p-2">
            <span className="mb-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
              Flash sale
            </span>
            <div className="text-xs text-slate-600">
              <Countdown endsAt={p.flash_sale_ends_at} />
            </div>
          </div>
        )}

        {/* Ratings */}
        {p.review_count > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            <span className="text-amber-500">★</span>
            <span className="font-semibold text-slate-700">
              {Number(p.rating_avg).toFixed(1)}
            </span>
            <span>({p.review_count} reviews)</span>
          </div>
        )}

        {/* Cart button */}
        <div className="mt-auto pt-4">
          <button
            type="button"
            className="w-full rounded-xl bg-blue-700 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!p.in_stock || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending
              ? "Adding..."
              : p.in_stock
                ? "Add to cart"
                : "Out of stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
