import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import ProductCard from "../components/ProductCard";
import { Countdown, Spinner } from "../components/ui";
import { money } from "../utils/format";

function Row({ title, params }: { title: string; params: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["home", params], queryFn: async () => (await api.get(`/products/?${params}`)).data.results });
  if (isLoading) return <Spinner />;
  if (!data?.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between"><h2 className="text-lg font-semibold">{title}</h2><Link className="text-sm text-brand" to={`/products?${params}`}>View all</Link></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">{data.slice(0, 5).map((p: any) => <ProductCard key={p.id} p={p} />)}</div>
    </section>
  );
}

export default function Home() {
  const banners = useQuery({ queryKey: ["banners"], queryFn: async () => (await api.get("/banners/")).data });
  const flash = useQuery({ queryKey: ["flash"], queryFn: async () => (await api.get("/flash-sales/")).data.results });
  const b = banners.data?.[0];
  return (
    <div>
      <section className="rounded-2xl bg-gradient-to-r from-stone-900 to-stone-700 p-8 text-white md:p-14">
        <h1 className="text-3xl font-bold md:text-4xl">{b?.title ?? "Everything you need, delivered."}</h1>
        <p className="mt-2 max-w-xl text-stone-300">{b?.subtitle ?? "Shop phones, fashion, home essentials and more at honest prices."}</p>
        <Link to={b?.link || "/products"} className="btn-primary mt-5">Shop now</Link>
      </section>
      {flash.data?.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Flash sales</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {flash.data.slice(0, 3).map((f: any) => (
              <Link key={f.id} to={`/products/${f.product_slug}`} className="card hover:border-brand">
                <div className="text-sm font-medium">{f.product_name}</div>
                <div className="mt-1"><span className="font-semibold">{money(f.sale_price)}</span> <span className="text-xs text-stone-400 line-through">{money(f.regular_price)}</span></div>
                <Countdown endsAt={f.ends_at} />
              </Link>))}
          </div>
        </section>
      )}
      <Row title="Featured" params="featured=1" />
      <Row title="New arrivals" params="sort=newest" />
      <Row title="Best sellers" params="sort=popular" />
      <Row title="Deals" params="on_sale=1" />
    </div>
  );
}
