
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

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    n.delete("page");
    setSp(n);
  };

  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: async () => (await api.get("/brands/")).data,
  });

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      {/* Filters sidebar */}
      <aside className="h-fit space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-lg font-bold text-slate-900">Filters</h2>
          <button
            type="button"
            onClick={() => setSp(new URLSearchParams())}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            Clear all
          </button>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Price range (₦)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              type="number"
              min="0"
              placeholder="Min"
              defaultValue={
                sp.get("min_price")
                  ? Number(sp.get("min_price")) / 100
                  : ""
              }
              onBlur={(e) =>
                set(
                  "min_price",
                  e.target.value
                    ? String(toMinor(e.target.value))
                    : ""
                )
              }
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              type="number"
              min="0"
              placeholder="Max"
              defaultValue={
                sp.get("max_price")
                  ? Number(sp.get("max_price")) / 100
                  : ""
              }
              onBlur={(e) =>
                set(
                  "max_price",
                  e.target.value
                    ? String(toMinor(e.target.value))
                    : ""
                )
              }
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Brand
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={sp.get("brand") ?? ""}
            onChange={(e) => set("brand", e.target.value)}
          >
            <option value="">All brands</option>
            {(brands.data ?? []).map((b: any) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Customer rating
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={sp.get("min_rating") ?? ""}
            onChange={(e) => set("min_rating", e.target.value)}
          >
            <option value="">Any rating</option>
            <option value="4">4 stars &amp; above</option>
            <option value="3">3 stars &amp; above</option>
          </select>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-700"
              checked={sp.get("in_stock") === "1"}
              onChange={(e) =>
                set("in_stock", e.target.checked ? "1" : "")
              }
            />
            In stock only
          </label>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-700"
              checked={sp.get("on_sale") === "1"}
              onChange={(e) =>
                set("on_sale", e.target.checked ? "1" : "")
              }
            />
            On sale
          </label>
        </div>
      </aside>

      {/* Products area */}
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Shop Products
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {data ? `${data.count} products found` : "Browse our collection"}
            </p>
          </div>

          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
            value={sp.get("sort") ?? ""}
            onChange={(e) => set("sort", e.target.value)}
          >
            <option value="">Relevance</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="newest">Newest</option>
            <option value="popular">Most popular</option>
            <option value="rating">Highest rated</option>
          </select>
        </div>

        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox msg={errMsg(error)} />
        ) : !data.results.length ? (
          <Empty>
            <div className="font-semibold text-slate-700">
              No products found
            </div>
            <p className="mt-2">
              Try changing your filters or searching for another product.
            </p>
          </Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {data.results.map((p: any) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!data.previous}
                onClick={() =>
                  setSp(
                    new URLSearchParams({
                      ...Object.fromEntries(sp),
                      page: String(page - 1),
                    })
                  )
                }
              >
                ← Previous
              </button>

              <span className="text-sm font-medium text-slate-500">
                Page {page}
              </span>

              <button
                className="rounded-xl border border-blue-700 bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!data.next}
                onClick={() =>
                  setSp(
                    new URLSearchParams({
                      ...Object.fromEntries(sp),
                      page: String(page + 1),
                    })
                  )
                }
              >
                Next →
              </button>
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

  const {
    data: p,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () =>
      (await api.get(`/products/${slug}/`)).data,
  });

  const reviews = useQuery({
    queryKey: ["reviews", p?.id],
    enabled: !!p,
    queryFn: async () =>
      (await api.get(`/reviews/?product=${p.id}`)).data.results,
  });

  const [qty, setQty] = useState(1);

  const add = useMutation({
    mutationFn: () =>
      api.post("/cart/items/", {
        product: p.id,
        quantity: qty,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["cart"] }),
    onError: (e) => alert(errMsg(e)),
  });

  if (isLoading) return <Spinner />;
  if (error || !p) return <ErrorBox msg="Product not found." />;

  const img = p.images?.[0];

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500">
        <Link to="/" className="hover:text-blue-700">
          Home
        </Link>
        {" / "}
        <Link
          to={`/products?category=${p.category}`}
          className="hover:text-blue-700"
        >
          {p.category_name}
        </Link>
        {" / "}
        <span className="font-medium text-slate-800">{p.name}</span>
      </nav>

      {/* Product details */}
      <div className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 md:p-8">
        <div className="aspect-square overflow-hidden rounded-2xl bg-slate-50">
          {img ? (
            <img
              src={img.image}
              alt={p.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No image available
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            {p.name}
          </h1>

          <div className="mt-3 text-sm text-slate-500">
            {p.brand_name}
            {" · "}
            <span className="text-amber-500">★</span>{" "}
            {Number(p.rating_avg).toFixed(1)}
            {" ("}
            {p.review_count} reviews)
          </div>

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-extrabold text-blue-800">
              {money(p.current_price)}
            </span>

            {p.current_price < p.regular_price && (
              <span className="text-base text-slate-400 line-through">
                {money(p.regular_price)}
              </span>
            )}
          </div>

          <p className="mt-5 leading-7 text-slate-600">
            {p.short_description || p.description}
          </p>

          <div className="mt-4 text-sm font-semibold">
            {p.in_stock ? (
              <span className="text-blue-700">
                In stock ({p.stock_quantity} available)
              </span>
            ) : (
              <span className="text-red-600">Out of stock</span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input
              type="number"
              min={1}
              max={p.stock_quantity}
              value={qty}
              onChange={(e) =>
                setQty(
                  Math.min(
                    p.stock_quantity || 1,
                    Math.max(1, Number(e.target.value))
                  )
                )
              }
              className="w-24 rounded-xl border border-slate-200 px-3 py-3 text-center text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              className="flex-1 rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!p.in_stock || add.isPending}
              onClick={() => add.mutate()}
            >
              {add.isPending ? "Adding..." : "Add to cart"}
            </button>
          </div>

          {add.isSuccess && (
            <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-medium text-blue-800">
              Added to cart successfully.
            </div>
          )}

          {p.specifications?.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-lg font-bold text-slate-900">
                Product specifications
              </h2>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <tbody>
                    {p.specifications.map((s: any) => (
                      <tr
                        key={s.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="bg-slate-50 px-4 py-3 font-medium text-slate-600">
                          {s.name}
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          {s.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer reviews */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <h2 className="mb-5 text-xl font-bold text-slate-900">
          Customer reviews
        </h2>

        {!reviews.data?.length ? (
          <Empty>No reviews yet. Be the first to review this product.</Empty>
        ) : (
          reviews.data.map((r: any) => (
            <div
              key={r.id}
              className="border-t border-slate-100 py-4 text-sm"
            >
              <div className="font-semibold text-slate-800">
                <span className="text-amber-500">
                  {"★".repeat(r.rating)}
                </span>{" "}
                {r.title}
              </div>

              <div className="mt-2 leading-6 text-slate-600">
                {r.comment}
              </div>

              <div className="mt-2 text-xs text-slate-400">
                {r.author}
                {r.is_verified_purchase && " · Verified purchase"}
              </div>
            </div>
          ))
        )}

        <ReviewForm
          productId={p.id}
          onDone={() =>
            qc.invalidateQueries({
              queryKey: ["reviews", p.id],
            })
          }
        />
      </section>
    </div>
  );
}

function ReviewForm({
  productId,
  onDone,
}: {
  productId: number;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <form
      className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
      onSubmit={async (e) => {
        e.preventDefault();

        try {
          await api.post("/reviews/", {
            product: productId,
            rating,
            comment,
          });

          setComment("");
          setMsg("Thanks for your review!");
          onDone();
        } catch (er) {
          setMsg(errMsg(er));
        }
      }}
    >
      <h3 className="font-bold text-slate-900">Write a review</h3>

      <select
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 md:w-40"
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
      >
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} stars
          </option>
        ))}
      </select>

      <textarea
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        rows={4}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience with this product..."
      />

      <button
        type="submit"
        disabled={!comment.trim()}
        className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit review
      </button>

      {msg && (
        <div className="text-sm font-medium text-blue-700">
          {msg}
        </div>
      )}
    </form>
  );
}
