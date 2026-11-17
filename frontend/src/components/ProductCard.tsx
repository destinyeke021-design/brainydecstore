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
    mutationFn: () => api.post("/cart/items/", { product: p.id, quantity: 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
    onError: (e) => alert(errMsg(e)),
  });
  const wish = useMutation({ mutationFn: () => api.post("/wishlist/", { product: p.id }), onSuccess: () => alert("Saved to wishlist") });
  const img = p.images?.find((i: any) => i.is_primary) ?? p.images?.[0];
  const onSale = p.current_price < p.regular_price;
  return (
    <div className="card flex flex-col">
      <Link to={`/products/${p.slug}`} className="block aspect-square overflow-hidden rounded-lg bg-stone-100">
        {img ? <img src={img.image} alt={img.alt_text || p.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center text-stone-400">No image</div>}
      </Link>
      <Link to={`/products/${p.slug}`} className="mt-3 line-clamp-2 text-sm font-medium hover:text-brand">{p.name}</Link>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-semibold">{money(p.current_price)}</span>
        {onSale && <span className="text-xs text-stone-400 line-through">{money(p.regular_price)}</span>}
      </div>
      {p.flash_sale_ends_at && <div className="mt-1"><span className="badge bg-amber-100 text-amber-800">Flash sale</span> <Countdown endsAt={p.flash_sale_ends_at} /></div>}
      {p.review_count > 0 && <div className="mt-1 text-xs text-stone-500">★ {Number(p.rating_avg).toFixed(1)} ({p.review_count})</div>}
      <div className="mt-auto flex gap-2 pt-3">
        <button className="btn-primary flex-1" disabled={!p.in_stock || add.isPending} onClick={() => add.mutate()}>{p.in_stock ? "Add to cart" : "Out of stock"}</button>
        {user?.role === "customer" && <button className="btn-outline" aria-label="Add to wishlist" onClick={() => wish.mutate()}>♡</button>}
      </div>
    </div>
  );
}
