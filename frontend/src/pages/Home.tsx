
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import ProductCard from "../components/ProductCard";
import { Countdown } from "../components/ui";
import { money } from "../utils/format";

function Row({ title, products }: { title: string; products: any[] }) {
  if (!products?.length) return null;

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        <Link
          className="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
          to="/products"
        >
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        {products.slice(0, 5).map((p: any) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["homepage"],
    queryFn: async () => (await api.get("/homepage/")).data,
    staleTime: 60 * 1000,
  });

  const b = data?.banners?.[0];

  return (
    <div className="space-y-2">
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900 px-6 py-12 text-white shadow-xl md:px-14 md:py-16">
        <div className="absolute -right-16 -top-20 -z-10 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 -z-10 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="max-w-2xl">
          <span className="inline-flex rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-300">
            Welcome to BD Store
          </span>

          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
            {b?.title ?? "Everything you need, delivered."}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 md:text-base">
            {b?.subtitle ??
              "Shop phones, fashion, home essentials and more at honest prices. Discover great deals and enjoy convenient shopping."}
          </p>

          <Link
            to={b?.link || "/products"}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-700"
          >
            Shop now →
          </Link>
        </div>
      </section>

      {isLoading && (
        <div className="py-12 text-center text-sm text-slate-500">
          Loading store collections...
        </div>
      )}

      {isError && (
        <div className="py-8 text-center text-sm text-red-600">
          Unable to load store collections. Please refresh the page.
        </div>
      )}

      {data && (
        <>
          {data.sponsored?.length > 0 && (
            <section className="mt-12">
              <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Sponsored
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Offers from our advertising partners
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  Paid advertisement
                </span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {data.sponsored.map((ad: any) => {
                  const content = (
                    <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
                      {ad.image && (
                        <img
                          src={ad.image}
                          alt={ad.title}
                          className="h-52 w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="p-5">
                        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-blue-700">
                          Sponsored · {ad.advertiser_name}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {ad.title}
                        </h3>
                        {ad.description && (
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {ad.description}
                          </p>
                        )}
                        {ad.destination_url && (
                          <span className="mt-4 inline-flex text-sm font-bold text-blue-700">
                            Learn more →
                          </span>
                        )}
                      </div>
                    </div>
                  );

                  return ad.destination_url ? (
                    <a
                      key={ad.id}
                      href={ad.destination_url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="block"
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={ad.id}>{content}</div>
                  );
                })}
              </div>
            </section>
          )}

          {data.flash?.length > 0 && (
            <section className="mt-12">
              <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Flash sales
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Limited-time deals. Shop before they end.
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-800">
                  Limited offers
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {data.flash.slice(0, 3).map((f: any) => (
                  <Link
                    key={f.id}
                    to={`/products/${f.product_slug}`}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-bold text-slate-900 transition group-hover:text-blue-700">
                        {f.product_name}
                      </div>
                      <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                        SALE
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-lg font-extrabold text-blue-700">
                        {money(f.sale_price)}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        {money(f.regular_price)}
                      </span>
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="mb-2 text-xs font-semibold text-slate-500">
                        Offer ends in
                      </p>
                      <Countdown endsAt={f.ends_at} />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <Row title="Featured products" products={data.featured} />
          <Row title="New arrivals" products={data.newest} />
          <Row title="Best sellers" products={data.popular} />
          <Row title="Today's deals" products={data.on_sale} />
        </>
      )}
    </div>
  );
}
