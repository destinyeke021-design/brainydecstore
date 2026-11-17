import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errMsg } from "../api/client";
import ProductCard from "../components/ProductCard";
import { Empty, ErrorBox, Spinner, Success } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { money, toMinor } from "../utils/format";

export function Account() {
  const { user } = useAuth();
  return (
    <div><h1 className="text-2xl font-semibold">Hello, {user?.first_name || user?.email}</h1>
      <div className="mt-4 grid gap-4 md:grid-cols-4">{[["Orders", "/orders"], ["Wallet", "/wallet"], ["Wishlist", "/wishlist"], ["Support", "/support"]].map(([t, to]) => <Link key={to} to={to} className="card text-center font-medium hover:border-brand">{t}</Link>)}</div></div>
  );
}

export function Orders() {
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: async () => (await api.get("/orders/")).data.results });
  if (isLoading) return <Spinner />;
  if (!data.length) return <Empty>No orders yet.</Empty>;
  return <div className="card divide-y">{data.map((o: any) => (
    <Link key={o.id} to={`/orders/${o.number}`} className="flex items-center justify-between py-3 text-sm hover:text-brand"><span className="font-medium">{o.number}</span><span className="badge">{o.status.replaceAll("_", " ")}</span><span>{money(o.total)}</span></Link>))}</div>;
}

export function OrderDetail() {
  const { number } = useParams(); const qc = useQueryClient(); const [msg, setMsg] = useState("");
  const { data: o, isLoading } = useQuery({ queryKey: ["order", number], queryFn: async () => (await api.get(`/orders/${number}/`)).data });
  const act = useMutation({ mutationFn: (a: string) => api.post(`/orders/${number}/${a}/`, a === "refund" ? { reason: prompt("Reason for refund?") ?? "" } : {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["order", number] }), onError: (e) => setMsg(errMsg(e)) });
  if (isLoading) return <Spinner />;
  const invoice = async () => { const r = await api.get(`/orders/${number}/invoice/`, { responseType: "blob" }); window.open(URL.createObjectURL(r.data)); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-xl font-semibold">Order {o.number}</h1><span className="badge">{o.status.replaceAll("_", " ")}</span></div>
      {msg && <ErrorBox msg={msg} />}
      {o.payment_method === "bank_transfer" && o.status === "pending_payment" && <TransferForm number={o.number} onDone={() => qc.invalidateQueries({ queryKey: ["order", number] })} />}
      {o.payment_method === "paystack" && o.status === "pending_payment" && <button className="btn-primary" onClick={async () => { try { const { data } = await api.post("/payments/initialize/", { order: o.number, provider: "paystack" }); window.location.href = data.checkout_url; } catch (e) { setMsg(errMsg(e)); } }}>Pay now</button>}
      <div className="card"><h2 className="mb-2 font-semibold">Tracking</h2><ol className="space-y-1 text-sm">{o.history.map((h: any, i: number) => <li key={i}>{new Date(h.created_at).toLocaleString()} — {h.to_status.replaceAll("_", " ")} {h.note && `(${h.note})`}</li>)}</ol></div>
      <div className="card"><table className="w-full text-sm"><tbody>{o.items.map((i: any) => <tr key={i.id} className="border-b"><td className="py-2">{i.name}</td><td>× {i.quantity}</td><td className="text-right">{money(i.line_total)}</td></tr>)}</tbody></table>
        <div className="mt-2 text-right text-sm">Shipping {money(o.shipping_fee)} · <b>Total {money(o.total)}</b></div></div>
      <div className="flex gap-2"><button className="btn-outline" onClick={invoice}>Download {o.is_paid ? "receipt" : "invoice"}</button>
        {["pending_payment", "payment_verification", "confirmed"].includes(o.status) && <button className="btn-danger" onClick={() => confirm("Cancel this order?") && act.mutate("cancel")}>Cancel order</button>}
        {o.is_paid && ["confirmed", "processing", "delivered"].includes(o.status) && <button className="btn-outline" onClick={() => act.mutate("refund")}>Request refund</button>}</div>
    </div>
  );
}

function TransferForm({ number, onDone }: { number: string; onDone: () => void }) {
  const [ref, setRef] = useState(""); const [file, setFile] = useState<File | null>(null); const [msg, setMsg] = useState("");
  return (
    <form className="card space-y-2" onSubmit={async (e) => { e.preventDefault(); const fd = new FormData(); fd.append("order", number); fd.append("reference", ref); if (file) fd.append("proof", file); try { await api.post("/payments/bank-transfer/", fd); onDone(); } catch (er) { setMsg(errMsg(er)); } }}>
      <div className="font-medium">Submit your transfer details</div><input className="input" placeholder="Transfer reference" value={ref} onChange={(e) => setRef(e.target.value)} />
      <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><button className="btn-primary">Submit for verification</button>{msg && <ErrorBox msg={msg} />}
    </form>
  );
}

export function WalletPage() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["wallet"], queryFn: async () => (await api.get("/wallet/")).data });
  const [amt, setAmt] = useState(""); const [err, setErr] = useState("");
  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-4"><div className="card"><div className="text-sm text-stone-500">Wallet balance</div><div className="text-3xl font-bold">{money(data.balance)}</div></div>
      <form className="card flex gap-2" onSubmit={async (e) => { e.preventDefault(); try { const { data: r } = await api.post("/wallet/fund/", { amount: toMinor(amt), provider: "paystack" }); window.location.href = r.checkout_url; } catch (er) { setErr(errMsg(er)); } }}>
        <input className="input" type="number" min="100" placeholder="Amount (₦)" value={amt} onChange={(e) => setAmt(e.target.value)} /><button className="btn-primary">Fund wallet</button></form>
      {err && <ErrorBox msg={err} />}
      <div className="card divide-y">{!data.transactions.length ? <Empty>No transactions yet.</Empty> : data.transactions.map((t: any) => <div key={t.id} className="flex justify-between py-2 text-sm"><span>{t.description}</span><span className={t.kind === "credit" ? "text-brand" : "text-red-600"}>{t.kind === "credit" ? "+" : "−"}{money(t.amount)}</span></div>)}</div>
      <button className="text-sm text-stone-500" onClick={() => refetch()}>Refresh</button></div>
  );
}

export function WishlistPage() {
  const { data, isLoading } = useQuery({ queryKey: ["wishlist"], queryFn: async () => (await api.get("/wishlist/")).data });
  const qc = useQueryClient();
  if (isLoading) return <Spinner />;
  if (!data.length) return <Empty>Your wishlist is empty.</Empty>;
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{data.map((p: any) => (
    <div key={p.id}><ProductCard p={p} /><button className="mt-1 text-xs text-stone-500" onClick={async () => { await api.delete(`/wishlist/?product=${p.id}`); qc.invalidateQueries({ queryKey: ["wishlist"] }); }}>Remove</button></div>))}</div>;
}

export function SupportPage() {
  const qc = useQueryClient(); const [f, setF] = useState({ subject: "", category: "order", body: "" }); const [msg, setMsg] = useState("");
  const { data } = useQuery({ queryKey: ["tickets"], queryFn: async () => (await api.get("/tickets/")).data.results });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form className="card space-y-2" onSubmit={async (e) => { e.preventDefault(); try { const { data: t } = await api.post("/tickets/", { subject: f.subject, category: f.category }); await api.post(`/tickets/${t.id}/reply/`, { body: f.body }); setF({ subject: "", category: "order", body: "" }); setMsg("Ticket created."); qc.invalidateQueries({ queryKey: ["tickets"] }); } catch (er) { setMsg(errMsg(er)); } }}>
        <h2 className="font-semibold">Contact support</h2><input className="input" required placeholder="Subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <textarea className="input" required rows={4} placeholder="Describe the problem" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /><button className="btn-primary">Submit</button>{msg && <Success>{msg}</Success>}</form>
      <div className="card"><h2 className="mb-2 font-semibold">Your tickets</h2>{!data?.length ? <Empty>No tickets.</Empty> : data.map((t: any) => <div key={t.id} className="border-b py-2 text-sm"><b>#{t.id} {t.subject}</b> <span className="badge">{t.status}</span>{t.messages.map((m: any) => <div key={m.id} className="text-stone-600">{m.author_role === "customer" ? "You" : "Support"}: {m.body}</div>)}</div>)}</div>
    </div>
  );
}
