import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errMsg } from "../api/client";
import { Empty, ErrorBox, Spinner } from "../components/ui";
import { money } from "../utils/format";

export function DeliveryDashboard() {
  const qc = useQueryClient(); const [hist, setHist] = useState(false); const [err, setErr] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["my-del", hist], queryFn: async () => (await api.get(`/my-deliveries/${hist ? "?history=1" : ""}`)).data });
  const set = async (id: number, status: string) => {
    const body: any = { status }; if (status === "failed") { const r = prompt("Reason for failed delivery?"); if (!r) return; body.reason = r; }
    try { await api.post(`/my-deliveries/${id}/status/`, body); qc.invalidateQueries({ queryKey: ["my-del"] }); } catch (e) { setErr(errMsg(e)); }
  };
  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-3"><div className="flex items-center justify-between"><h1 className="text-xl font-semibold">My deliveries</h1><button className="btn-outline" onClick={() => setHist(!hist)}>{hist ? "Active" : "History"}</button></div>
      {err && <ErrorBox msg={err} />}{!data.length && <Empty>No deliveries.</Empty>}
      {data.map((d: any) => <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-1 text-sm"><div className="font-medium">{d.order_number} <span className="badge">{d.status}</span></div><div>{d.recipient} · {d.phone}</div><div>{d.address}</div>
        {d.cod_amount_due > 0 && <div className="font-semibold text-amber-700">Collect cash: {money(d.cod_amount_due)}</div>}
        {!["delivered", "failed"].includes(d.status) && <div className="flex gap-2 pt-2">{d.status === "assigned" && <button className="btn-outline" onClick={() => set(d.id, "picked_up")}>Picked up</button>}
          <button className="btn-outline" onClick={() => set(d.id, "out_for_delivery")}>Out for delivery</button><button className="btn-primary" onClick={() => set(d.id, "delivered")}>Delivered</button><button className="btn-danger" onClick={() => set(d.id, "failed")}>Failed</button></div>}</div>)}</div>
  );
}

export function SupportDesk() {
  const qc = useQueryClient(); const { data, isLoading } = useQuery({ queryKey: ["desk"], queryFn: async () => (await api.get("/tickets/")).data.results });
  const [reply, setReply] = useState<Record<number, string>>({});
  if (isLoading) return <Spinner />; if (!data.length) return <Empty>No tickets assigned to you.</Empty>;
  const call = async (id: number, path: string, body: any = {}) => { try { await api.post(`/tickets/${id}/${path}/`, body); qc.invalidateQueries({ queryKey: ["desk"] }); } catch (e) { alert(errMsg(e)); } };
  return <div className="space-y-3">{data.map((t: any) => <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2 text-sm"><div className="font-medium">#{t.id} {t.subject} <span className="badge">{t.status}</span> <span className="badge">{t.priority}</span></div>
    {t.order_summary && <div className="text-slate-500">Order {t.order_summary.number} · {t.order_summary.status}</div>}
    {t.messages.map((m: any) => <div key={m.id} className={m.is_internal ? "italic text-amber-700" : ""}>{m.author_role}: {m.body}</div>)}
    <div className="flex gap-2"><input className="input" value={reply[t.id] ?? ""} onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })} placeholder="Reply…" />
      <button className="btn-primary" onClick={() => { call(t.id, "reply", { body: reply[t.id] }); setReply({ ...reply, [t.id]: "" }); }}>Send</button>
      <button className="btn-outline" onClick={() => call(t.id, "escalate")}>Escalate</button><button className="btn-outline" onClick={() => { const r = prompt("Resolution?"); if (r) call(t.id, "resolve", { resolution: r }); }}>Resolve</button></div></div>)}</div>;
}
