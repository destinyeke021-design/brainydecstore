import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, errMsg } from "../api/client";
import ProductCard from "../components/ProductCard";
import { Empty, ErrorBox, Spinner } from "../components/ui";
import { money, toMinor } from "../utils/format";

export function Products() {
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get("page") ?? 1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["products", sp.toString()],
    queryFn: async () => (await api.get(`/products/?${sp.toString()}`)).data,
  });
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); n.delete("page"); setSp(n); };
  const brands = useQuery({ queryKey: ["brands"], queryFn: async () => (await api.get("/brands/")).data });
  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <aside className="card h-fit space-y-3 text-sm">
        <div className="font-semibold">Filters</div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Min ₦" defaultValue={sp.get("min_price") ? Number(sp.get("min_price")) / 100 : ""} onBlur={(e) => set("min_price", e.target.value ? String(toMinor(e.target.value)) : "")} />
          <input className="input" placeholder="Max ₦" defaultValue={sp.get("max_price") ? Number(sp.get("max_price")) / 100 : ""} onBlur={(e) => set("max_price", e.target.value ? String(toMinor(e.target.value)) : "")} />
        </div>
        <select className="input" value={sp.get("brand") ?? ""} onChange={(e) => set("brand", e.target.value)}>
          <option value="">All brands</option>{(brands.data ?? []).map((b: any) => <option key={b.id} value={b.slug}>{b.name}</option>)}
        </select>
        <select className="input" value={sp.get("min_rating") ?? ""} onChange={(e) => set("min_rating", e.target.value)}>
          <option value="">Any rating</option><option value="4">4★ &amp; up</option><option value="3">3★ &amp; up</option>
        </select>
        <label className="flex items-center gap-2"><input type="checkbox" checked={sp.get("in_stock") === "1"} onChange={(e) => set("in_stock", e.target.checked ? "1" : "")} /> In stock</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={sp.get("on_sale") === "1"} onChange={(e) => set("on_sale", e.target.checked ? "1" : "")} /> On sale</label>
      </aside>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-stone-500">{data ? `${data.count} products` : ""}</div>
          <select className="input w-auto" value={sp.get("sort") ?? ""} onChange={(e) => set("sort", e.target.value)}>
            <option value="">Relevance</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
            <option value="newest">Newest</option><option value="popular">Most popular</option><option value="rating">Highest rated</option>
          </select>
        </div>
        {isLoading ? <Spinner /> : error ? <ErrorBox msg={errMsg(error)} /> : !data.results.length ? <Empty>No products match your search.</Empty> : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{data.results.map((p: any) => <ProductCard key={p.id} p={p} />)}</div>
            <div className="mt-6 flex justify-center gap-3">
              <button className="btn-outline" disabled={!data.previous} onClick={() => setSp(new URLSearchParams({ ...Object.fromEntries(sp), page: String(page - 1) }))}>Previous</button>
              <button className="btn-outline" disabled={!data.next} onClick={() => setSp(new URLSearchParams({ ...Object.fromEntries(sp), page: String(page + 1) }))}>Next</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function ProductDetail() {
  const { slug } = useParams();
  const qc = useQueryClient();
  const { data: p, isLoading, error } = useQuery({ queryKey: ["product", slug], queryFn: async () => (await api.get(`/products/${slug}/`)).data });
  const reviews = useQuery({ queryKey: ["reviews", p?.id], enabled: !!p, queryFn: async () => (await api.get(`/reviews/?product=${p.id}`)).data.results });
  const [qty, setQty] = useState(1);
  const add = useMutation({ mutationFn: () => api.post("/cart/items/", { product: p.id, quantity: qty }), onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }), onError: (e) => alert(errMsg(e)) });
  if (isLoading) return <Spinner />;
  if (error || !p) return <ErrorBox msg="Product not found." />;
  const img = p.images?.[0];
  return (
    <div>
      <nav className="mb-4 text-sm text-stone-500"><Link to="/">Home</Link> / <Link to={`/products?category=${p.category}`}>{p.category_name}</Link> / {p.name}</nav>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-xl bg-stone-100">{img ? <img src={img.image} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-stone-400">No image</div>}</div>
        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <div className="mt-1 text-sm text-stone-500">{p.brand_name} · ★ {Number(p.rating_avg).toFixed(1)} ({p.review_count} reviews)</div>
          <div className="mt-4 flex items-baseline gap-3"><span className="text-3xl font-bold">{money(p.current_price)}</span>{p.current_price < p.regular_price && <span className="text-stone-400 line-through">{money(p.regular_price)}</span>}</div>
          <p className="mt-4 text-stone-600">{p.short_description || p.description}</p>
          <div className="mt-2 text-sm">{p.in_stock ? <span className="text-brand">In stock ({p.stock_quantity} available)</span> : <span className="text-red-600">Out of stock</span>}</div>
          <div className="mt-5 flex items-center gap-3">
            <input type="number" min={1} max={p.stock_quantity} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="input w-24" />
            <button className="btn-primary" disabled={!p.in_stock || add.isPending} onClick={() => add.mutate()}>Add to cart</button>
          </div>
          {add.isSuccess && <div className="mt-2 text-sm text-brand">Added to cart.</div>}
          {p.specifications?.length > 0 && <table className="mt-6 w-full text-sm"><tbody>{p.specifications.map((s: any) => <tr key={s.id} className="border-t"><td className="py-1.5 text-stone-500">{s.name}</td><td>{s.value}</td></tr>)}</tbody></table>}
        </div>
      </div>
      <section className="mt-10"><h2 className="mb-3 text-lg font-semibold">Customer reviews</h2>
        {!reviews.data?.length ? <Empty>No reviews yet.</Empty> : reviews.data.map((r: any) => (
          <div key={r.id} className="border-t py-3 text-sm"><div className="font-medium">{"★".repeat(r.rating)} {r.title}</div><div className="text-stone-600">{r.comment}</div><div className="text-xs text-stone-400">{r.author}{r.is_verified_purchase && " · Verified purchase"}</div></div>))}
        <ReviewForm productId={p.id} onDone={() => qc.invalidateQueries({ queryKey: ["reviews", p.id] })} />
      </section>
    </div>
  );
}

function ReviewForm({ productId, onDone }: { productId: number; onDone: () => void }) {
  const [rating, setRating] = useState(5); const [comment, setComment] = useState(""); const [msg, setMsg] = useState("");
  return (
    <form className="card mt-4 space-y-2" onSubmit={async (e) => { e.preventDefault(); try { await api.post("/reviews/", { product: productId, rating, comment }); setComment(""); setMsg("Thanks for your review!"); onDone(); } catch (er) { setMsg(errMsg(er)); } }}>
      <div className="text-sm font-medium">Write a review</div>
      <select className="input w-32" value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select>
      <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your experience" />
      <button className="btn-primary">Submit</button>{msg && <div className="text-sm text-stone-600">{msg}</div>}
    </form>
  );
}
