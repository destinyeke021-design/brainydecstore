import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, errMsg } from "../api/client";
import { Empty, ErrorBox, Spinner, Success } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { money } from "../utils/format";

export function CartPage() {
  const qc = useQueryClient(); const [coupon, setCoupon] = useState(""); const [applied, setApplied] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["cart", applied], queryFn: async () => (await api.get(`/cart/${applied ? `?coupon=${applied}` : ""}`)).data });
  const set = useMutation({ mutationFn: (v: { product: number; quantity: number }) => api.post("/cart/items/", v), onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }), onError: (e) => alert(errMsg(e)) });
  if (isLoading) return <Spinner />;
  if (!data.items.length) return <Empty>Your cart is empty. <Link className="text-brand" to="/products">Continue shopping</Link></Empty>;
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="card divide-y">
        {data.items.map((i: any) => (
          <div key={i.id} className="flex items-center gap-4 py-3">
            <div className="flex-1"><Link to={`/products/${i.product.slug}`} className="font-medium">{i.product.name}</Link>
              <div className="text-sm text-stone-500">{money(i.unit_price)}{!i.available && <span className="ml-2 text-red-600">Not enough stock</span>}</div></div>
            <div className="flex items-center gap-2">
              <button className="btn-outline px-2" onClick={() => set.mutate({ product: i.product.id, quantity: i.quantity - 1 })}>−</button>
              <span className="w-6 text-center">{i.quantity}</span>
              <button className="btn-outline px-2" onClick={() => set.mutate({ product: i.product.id, quantity: i.quantity + 1 })}>+</button>
            </div>
            <div className="w-28 text-right font-medium">{money(i.line_total)}</div>
            <button className="text-sm text-red-600" onClick={() => set.mutate({ product: i.product.id, quantity: 0 })}>Remove</button>
          </div>))}
      </div>
      <aside className="card h-fit space-y-2 text-sm">
        <div className="flex gap-2"><input className="input" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} /><button className="btn-outline" onClick={() => setApplied(coupon)}>Apply</button></div>
        {data.coupon_error && <ErrorBox msg={data.coupon_error} />}
        <Row l="Subtotal" v={money(data.subtotal)} />{data.discount > 0 && <Row l="Discount" v={`− ${money(data.discount)}`} />}
        <Row l="Delivery" v={data.shipping ? money(data.shipping) : "Free"} /><div className="border-t pt-2"><Row l="Total" v={money(data.total)} bold /></div>
        <Link to={`/checkout${applied ? `?coupon=${applied}` : ""}`} className="btn-primary w-full">Proceed to checkout</Link>
        <Link to="/products" className="block text-center text-brand">Continue shopping</Link>
      </aside>
    </div>
  );
}
const Row = ({ l, v, bold }: { l: string; v: string; bold?: boolean }) => <div className={`flex justify-between ${bold ? "text-base font-semibold" : ""}`}><span>{l}</span><span>{v}</span></div>;

export function Checkout() {
  const nav = useNavigate(); const qc = useQueryClient(); const { user } = useAuth(); const [sp] = useSearchParams();
  const coupon = sp.get("coupon") ?? "";
  const cart = useQuery({ queryKey: ["cart", coupon], queryFn: async () => (await api.get(`/cart/${coupon ? `?coupon=${coupon}` : ""}`)).data });
  const settings = useQuery({ queryKey: ["settings"], queryFn: async () => (await api.get("/settings/public/")).data });
  const addrs = useQuery({ queryKey: ["addresses"], queryFn: async () => (await api.get("/auth/addresses/")).data.results });
  const [addr, setAddr] = useState<number | null>(null); const [method, setMethod] = useState("paystack"); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const [show, setShow] = useState(false);
  useEffect(() => { if (addrs.data?.length && addr === null) setAddr(addrs.data[0].id); }, [addrs.data]);

  const place = async () => {
    setErr(""); setBusy(true);
    try {
      const { data: order } = await api.post("/checkout/", { address_id: addr, payment_method: method, coupon_code: coupon, idempotency_key: key });
      qc.invalidateQueries({ queryKey: ["cart"] });
      if (method === "paystack" || method === "flutterwave") {
        const { data } = await api.post("/payments/initialize/", { order: order.number, provider: method });
        window.location.href = data.checkout_url; return;
      }
      nav(`/orders/${order.number}`);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  if (cart.isLoading || settings.isLoading || addrs.isLoading) return <Spinner />;
  if (!cart.data?.items.length) return <Empty>Your cart is empty.</Empty>;
  const methods: Record<string, string> = { paystack: "Card / bank (Paystack)", flutterwave: "Card / bank (Flutterwave)", bank_transfer: "Bank transfer", cod: "Cash on delivery", wallet: "Wallet balance" };
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <section className="card"><h2 className="mb-2 font-semibold">Delivery address</h2>
          {addrs.data?.map((a: any) => (<label key={a.id} className="mb-2 flex gap-2 text-sm"><input type="radio" checked={addr === a.id} onChange={() => setAddr(a.id)} />{a.full_name}, {a.line1}, {a.city}, {a.state} · {a.phone}</label>))}
          <button className="btn-outline mt-2" onClick={() => setShow(!show)}>+ New address</button>{show && <AddressForm onDone={() => { setShow(false); addrs.refetch(); }} />}</section>
        <section className="card"><h2 className="mb-2 font-semibold">Payment method</h2>
          {settings.data.enabled_payment_methods.map((m: string) => <label key={m} className="mb-1 flex gap-2 text-sm"><input type="radio" checked={method === m} onChange={() => setMethod(m)} />{methods[m] ?? m}</label>)}
          {method === "bank_transfer" && <div className="mt-2 rounded bg-stone-100 p-3 text-sm">Transfer to <b>{settings.data.bank_name || "(bank not configured)"}</b> · {settings.data.bank_account_number} · {settings.data.bank_account_name}. You will submit your reference after placing the order.</div>}
        </section>
      </div>
      <aside className="card h-fit space-y-2 text-sm">
        <Row l="Subtotal" v={money(cart.data.subtotal)} />{cart.data.discount > 0 && <Row l="Discount" v={`− ${money(cart.data.discount)}`} />}
        <Row l="Delivery" v={cart.data.shipping ? money(cart.data.shipping) : "Free"} /><div className="border-t pt-2"><Row l="Total" v={money(cart.data.total)} bold /></div>
        {err && <ErrorBox msg={err} />}
        <button className="btn-primary w-full" disabled={busy || !addr} onClick={place}>{busy ? "Placing order…" : "Place order"}</button>
        <div className="text-xs text-stone-500">Signed in as {user?.email}. Final prices and stock are confirmed by our server.</div>
      </aside>
    </div>
  );
}

function AddressForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ full_name: "", phone: "", line1: "", city: "", state: "", country: "NG" }); const [err, setErr] = useState("");
  const u = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); try { await api.post("/auth/addresses/", f); onDone(); } catch (er) { setErr(errMsg(er)); } }}>
      {(["full_name", "phone", "line1", "city", "state"] as const).map((k) => <input key={k} required className="input" placeholder={k.replace("_", " ")} value={f[k]} onChange={u(k)} />)}
      <button className="btn-primary">Save address</button>{err && <ErrorBox msg={err} />}
    </form>
  );
}

export function PaymentCallback() {
  const [sp] = useSearchParams(); const nav = useNavigate();
  const ref = sp.get("reference") || sp.get("tx_ref") || ""; const [state, setState] = useState<"checking" | "success" | "failed" | "error">("checking");
  useEffect(() => {
    if (!ref) { setState("error"); return; }
    api.get(`/payments/verify/?reference=${ref}`).then((r) => setState(r.data.status === "success" ? "success" : "failed")).catch(() => setState("error"));
  }, [ref]);
  if (state === "checking") return <Spinner />;
  return (
    <div className="mx-auto max-w-md text-center">
      {state === "success" ? <Success>Payment verified. Thank you!</Success> : <ErrorBox msg={state === "failed" ? "Payment was not completed." : "We could not verify this payment yet. Check your orders shortly."} />}
      <button className="btn-primary mt-4" onClick={() => nav("/orders")}>View my orders</button>
    </div>
  );
}
