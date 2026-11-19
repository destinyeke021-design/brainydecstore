import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errMsg } from "../api/client";
import { Empty, ErrorBox, Spinner, Success } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { money, toMinor } from "../utils/format";

const TABS = ["Dashboard", "Products", "Orders", "Payments", "Refunds", "Deliveries", "Coupons", "Flash sales", "Reviews", "Settings", "Staff", "Audit logs"] as const;
const SUPER_ONLY = ["Settings", "Staff", "Audit logs"];

export default function Admin() {
  const { user } = useAuth(); const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  const tabs = TABS.filter((t) => user?.role === "super_admin" || !SUPER_ONLY.includes(t));
  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
      <nav className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex h-fit gap-1 overflow-x-auto md:flex-col">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm ${tab === t ? "bg-blue-600 text-white" : "hover:bg-stone-100"}`}>{t}</button>)}</nav>
      <div className="min-w-0">{tab === "Dashboard" && <Dashboard />}{tab === "Products" && <ProductsAdmin />}{tab === "Orders" && <OrdersAdmin />}{tab === "Payments" && <PaymentsAdmin />}
        {tab === "Refunds" && <RefundsAdmin />}{tab === "Deliveries" && <DeliveriesAdmin />}{tab === "Coupons" && <CouponsAdmin />}{tab === "Flash sales" && <FlashAdmin />}
        {tab === "Reviews" && <Empty>Moderate reviews via POST /api/reviews/&lt;id&gt;/moderate/ (UI list pending).</Empty>}
        {tab === "Settings" && <SettingsAdmin />}{tab === "Staff" && <StaffAdmin />}{tab === "Audit logs" && <AuditAdmin />}</div>
    </div>
  );
}

const Stat = ({ l, v }: { l: string; v: string | number }) => <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs text-slate-500">{l}</div><div className="text-xl font-semibold">{v}</div></div>;

function Dashboard() {
  const { data: d, isLoading, error } = useQuery({ queryKey: ["dash"], queryFn: async () => (await api.get("/analytics/dashboard/")).data });
  if (isLoading) return <Spinner />; if (error) return <ErrorBox msg={errMsg(error)} />;
  const max = Math.max(1, ...d.sales_over_time.map((s: any) => s.total));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat l="Total sales" v={money(d.total_sales)} /><Stat l="Today" v={money(d.today_sales)} /><Stat l="This month" v={money(d.monthly_sales)} /><Stat l="Orders" v={d.total_orders} />
        <Stat l="Pending orders" v={d.pending_orders} /><Stat l="Completed" v={d.completed_orders} /><Stat l="Cancelled" v={d.cancelled_orders} /><Stat l="Customers" v={d.total_customers} />
        <Stat l="New customers (30d)" v={d.new_customers} /><Stat l="Products" v={d.total_products} /><Stat l="Low stock" v={d.low_stock_products} /><Stat l="Out of stock" v={d.out_of_stock_products} />
        <Stat l="Pending payments" v={d.pending_payments} /><Stat l="Refund requests" v={d.refund_requests} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-2 font-semibold">Sales — last 30 days</div>
        {!d.sales_over_time.length ? <Empty>No sales yet.</Empty> : <div className="flex h-40 items-end gap-1">{d.sales_over_time.map((s: any) => <div key={s.d} title={`${s.d}: ${money(s.total)}`} className="flex-1 rounded-t bg-blue-600" style={{ height: `${(s.total / max) * 100}%` }} />)}</div>}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-2 font-semibold">Best sellers</div>{d.best_sellers.map((b: any) => <div key={b.name} className="flex justify-between text-sm"><span>{b.name}</span><span>{b.units}</span></div>)}</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-2 font-semibold">Payment methods</div>{d.payment_methods.map((b: any) => <div key={b.payment_method} className="flex justify-between text-sm"><span>{b.payment_method}</span><span>{b.count}</span></div>)}</div>
      </div>
    </div>
  );
}

function ProductsAdmin() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => (await api.get("/products/")).data.results,
  });

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories/")).data,
  });

  const [f, setF] = useState({
    name: "",
    sku: "",
    category: "",
    regular_price: "",
    stock_quantity: "0",
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post("/products/", {
        ...f,
        category: Number(f.category),
        regular_price: toMinor(f.regular_price),
        stock_quantity: Number(f.stock_quantity),
      });

      setMsg("Product created successfully.");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["dash"] });
    } catch (er) {
      setMsg(errMsg(er));
    }
  };

  const upload = async (slug: string, file: File) => {
    const fd = new FormData();
    fd.append("image", file);

    try {
      await api.post(`/products/${slug}/images/`, fd);
      setMsg("Image uploaded successfully.");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (er) {
      setMsg(errMsg(er));
    }
  };

  const csv = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);

    try {
      const r = await api.post("/products/import/", fd);
      setMsg(`Imported: ${r.data.created} new, ${r.data.updated} updated`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (er) {
      setMsg(errMsg(er));
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      {msg && <Success>{msg}</Success>}

      <form onSubmit={create} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm grid gap-2 md:grid-cols-6">
        <input
          required
          className="input md:col-span-2"
          placeholder="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />

        <input
          required
          className="input"
          placeholder="SKU"
          value={f.sku}
          onChange={(e) => setF({ ...f, sku: e.target.value })}
        />

        <select
          required
          className="input"
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
        >
          <option value="">Category</option>
          {(cats.data ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          required
          className="input"
          type="number"
          step="0.01"
          placeholder="Price ₦"
          value={f.regular_price}
          onChange={(e) => setF({ ...f, regular_price: e.target.value })}
        />

        <input
          className="input"
          type="number"
          placeholder="Stock"
          value={f.stock_quantity}
          onChange={(e) => setF({ ...f, stock_quantity: e.target.value })}
        />

        <button className="btn-primary md:col-span-6">
          Add product
        </button>
      </form>

      <div className="flex gap-2">
        <label className="btn-outline cursor-pointer">
          Import CSV/XLSX
          <input
            type="file"
            hidden
            accept=".csv,.xlsx"
            onChange={(e) =>
              e.target.files?.[0] && csv(e.target.files[0])
            }
          />
        </label>

        <button
          className="btn-outline"
          onClick={async () => {
            try {
              const r = await api.get("/products/export/", {
                responseType: "blob",
              });

              const a = document.createElement("a");
              a.href = URL.createObjectURL(r.data);
              a.download = "products.csv";
              a.click();
              URL.revokeObjectURL(a.href);
            } catch (e) {
              setMsg(errMsg(e));
            }
          }}
        >
          Export CSV
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Name</th>
              <th className="table-th">SKU</th>
              <th className="table-th">Price</th>
              <th className="table-th">Stock</th>
              <th className="table-th">Status</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>

          <tbody>
            {data.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="table-td">{p.name}</td>
                <td className="table-td">{p.sku}</td>
                <td className="table-td">{money(p.regular_price)}</td>
                <td className="table-td">
                  {p.stock_quantity}
                  {p.stock_quantity <= p.low_stock_threshold && (
                    <span className="badge ml-1 bg-amber-100">low</span>
                  )}
                </td>
                <td className="table-td">{p.status}</td>

                <td className="table-td space-x-2">
                  <button
                    className="text-blue-600"
                    onClick={async () => {
                      const q = prompt("Stock change (+/-)");
                      if (!q) return;

                      try {
                        await api.post(
                          `/products/${p.slug}/adjust_stock/`,
                          { quantity: Number(q) }
                        );
                        qc.invalidateQueries({ queryKey: ["admin-products"] });
                      } catch (e) {
                        setMsg(errMsg(e));
                      }
                    }}
                  >
                    Stock
                  </button>

                  <label className="cursor-pointer text-blue-600">
                    Image
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload(p.slug, file);
                        e.target.value = "";
                      }}
                    />
                  </label>

                  <button
                    className="font-medium text-red-600"
                    onClick={async () => {
                      const confirmed = confirm(
                        `Delete "${p.name}"?\n\nProducts with existing orders will be archived instead. Products without order history will be permanently deleted.`
                      );

                      if (!confirmed) return;

                      try {
                        const response = await api.delete(
                          `/products/${p.slug}/`
                        );

                        setMsg(
                          response.data?.detail ||
                            "Product deletion completed."
                        );

                        qc.invalidateQueries({
                          queryKey: ["admin-products"],
                        });
                        qc.invalidateQueries({ queryKey: ["dash"] });
                      } catch (error) {
                        setMsg(errMsg(error));
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}    

const NEXT: Record<string, string[]> = { confirmed: ["processing"], processing: ["ready_for_dispatch"], ready_for_dispatch: ["shipped"], shipped: ["out_for_delivery", "delivered"], out_for_delivery: ["delivered"] };
function OrdersAdmin() {
  const qc = useQueryClient(); const [status, setStatus] = useState(""); const [err, setErr] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["admin-orders", status], queryFn: async () => (await api.get(`/orders/${status ? `?status=${status}` : ""}`)).data.results });
  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-3">{err && <ErrorBox msg={err} />}
      <select className="input w-56" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{["pending_payment", "payment_verification", "confirmed", "processing", "ready_for_dispatch", "shipped", "out_for_delivery", "delivered", "cancelled", "refund_requested", "refunded"].map((s) => <option key={s}>{s}</option>)}</select>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto"><table className="w-full"><thead><tr>{["Order", "Customer", "Total", "Method", "Status", "Move to"].map((h) => <th key={h} className="table-th">{h}</th>)}</tr></thead>
        <tbody>{data.map((o: any) => <tr key={o.id} className="border-t"><td className="table-td">{o.number}</td><td className="table-td">{o.customer_email}</td><td className="table-td">{money(o.total)}</td><td className="table-td">{o.payment_method}</td><td className="table-td"><span className="badge">{o.status}</span></td>
          <td className="table-td space-x-1">{(NEXT[o.status] ?? []).map((n) => <button key={n} className="btn-outline px-2 py-1 text-xs" onClick={async () => { try { await api.post(`/orders/${o.number}/set_status/`, { status: n }); qc.invalidateQueries({ queryKey: ["admin-orders"] }); } catch (e) { setErr(errMsg(e)); } }}>{n.replaceAll("_", " ")}</button>)}</td></tr>)}</tbody></table></div></div>
  );
}

function PaymentsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["payments"], queryFn: async () => (await api.get("/payments/")).data });
  if (isLoading) return <Spinner />;
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto"><table className="w-full"><thead><tr>{["Ref", "Order", "Provider", "Amount", "Status", ""].map((h) => <th key={h} className="table-th">{h}</th>)}</tr></thead>
    <tbody>{data.map((p: any) => <tr key={p.id} className="border-t"><td className="table-td">{p.reference}</td><td className="table-td">{p.order_number}</td><td className="table-td">{p.provider}</td><td className="table-td">{money(p.amount)}</td><td className="table-td">{p.status}</td>
      <td className="table-td space-x-1">{p.status === "awaiting_verification" && <><button className="btn-primary px-2 py-1 text-xs" onClick={async () => { await api.post(`/payments/${p.id}/verify-transfer/`, { approve: true }); qc.invalidateQueries({ queryKey: ["payments"] }); }}>Approve</button>
        <button className="btn-danger px-2 py-1 text-xs" onClick={async () => { await api.post(`/payments/${p.id}/verify-transfer/`, { approve: false }); qc.invalidateQueries({ queryKey: ["payments"] }); }}>Reject</button></>}
        {p.provider === "cod" && p.status === "pending" && <button className="btn-outline px-2 py-1 text-xs" onClick={async () => { await api.post(`/payments/cod/${p.order_number}/collect/`, { reconciled: true }); qc.invalidateQueries({ queryKey: ["payments"] }); }}>Mark collected</button>}</td></tr>)}</tbody></table></div>;
}

function RefundsAdmin() {
  const qc = useQueryClient(); const { data, isLoading } = useQuery({ queryKey: ["refunds"], queryFn: async () => (await api.get("/refunds/")).data });
  if (isLoading) return <Spinner />; if (!data.length) return <Empty>No refund requests.</Empty>;
  const decide = async (id: number, d: string) => { try { await api.post(`/refunds/${id}/${d}/`); qc.invalidateQueries({ queryKey: ["refunds"] }); } catch (e) { alert(errMsg(e)); } };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm divide-y">{data.map((r: any) => <div key={r.id} className="flex items-center justify-between py-2 text-sm"><span>{r.order} · {money(r.amount)} · {r.reason}</span><span className="badge">{r.status}</span>
    {r.status === "requested" && <span className="space-x-1"><button className="btn-primary px-2 py-1 text-xs" onClick={() => decide(r.id, "approve")}>Approve</button><button className="btn-outline px-2 py-1 text-xs" onClick={() => decide(r.id, "reject")}>Reject</button></span>}</div>)}</div>;
}

function DeliveriesAdmin() {
  const qc = useQueryClient(); const { data, isLoading } = useQuery({ queryKey: ["deliveries"], queryFn: async () => (await api.get("/deliveries/")).data.results });
  const staff = useQuery({ queryKey: ["staff-agents"], queryFn: async () => (await api.get("/auth/staff/")).data.results?.filter((u: any) => u.role === "delivery_agent") ?? [], retry: false });
  if (isLoading) return <Spinner />; if (!data.length) return <Empty>No deliveries yet.</Empty>;
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto"><table className="w-full"><thead><tr>{["Order", "Status", "Agent", "Assign (agent id)"].map((h) => <th key={h} className="table-th">{h}</th>)}</tr></thead>
    <tbody>{data.map((d: any) => <tr key={d.id} className="border-t"><td className="table-td">{d.order_number}</td><td className="table-td">{d.status}</td><td className="table-td">{d.agent_email ?? "—"}</td>
      <td className="table-td"><button className="text-blue-600" onClick={async () => { const id = prompt(`Agent user id${staff.data?.length ? ` (${staff.data.map((a: any) => `${a.id}:${a.email}`).join(", ")})` : ""}`); if (id) { try { await api.post(`/deliveries/${d.id}/assign/`, { agent: Number(id) }); qc.invalidateQueries({ queryKey: ["deliveries"] }); } catch (e) { alert(errMsg(e)); } } }}>Assign</button></td></tr>)}</tbody></table></div>;
}

function CouponsAdmin() {
  const qc = useQueryClient(); const { data, isLoading } = useQuery({ queryKey: ["coupons"], queryFn: async () => (await api.get("/coupons/")).data.results });
  const [f, setF] = useState({ code: "", kind: "percent", value: "10", min_purchase: "0" }); const [msg, setMsg] = useState("");
  if (isLoading) return <Spinner />;
  return <div className="space-y-3">{msg && <ErrorBox msg={msg} />}
    <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm grid gap-2 md:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); try { await api.post("/coupons/", { code: f.code, kind: f.kind, value: f.kind === "percent" ? Number(f.value) : toMinor(f.value), min_purchase: toMinor(f.min_purchase) }); qc.invalidateQueries({ queryKey: ["coupons"] }); setMsg(""); } catch (er) { setMsg(errMsg(er)); } }}>
      <input required className="input" placeholder="CODE" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="percent">Percent</option><option value="fixed">Fixed ₦</option></select>
      <input className="input" placeholder="Value" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /><input className="input" placeholder="Min purchase ₦" value={f.min_purchase} onChange={(e) => setF({ ...f, min_purchase: e.target.value })} /><button className="btn-primary">Create</button></form>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm divide-y">{data.map((c: any) => <div key={c.id} className="flex justify-between py-2 text-sm"><b>{c.code}</b><span>{c.kind === "percent" ? `${c.value}%` : money(c.value)} · used {c.used_count}</span></div>)}</div></div>;
}

function FlashAdmin() {
  const qc = useQueryClient(); const { data, isLoading } = useQuery({ queryKey: ["flash-admin"], queryFn: async () => (await api.get("/flash-sales/")).data.results });
  const [f, setF] = useState({ product: "", sale_price: "", hours: "24", quota: "" }); const [msg, setMsg] = useState("");
  if (isLoading) return <Spinner />;
  return <div className="space-y-3">{msg && <ErrorBox msg={msg} />}
    <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm grid gap-2 md:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); const now = new Date(); try { await api.post("/flash-sales/", { product: Number(f.product), sale_price: toMinor(f.sale_price), starts_at: now.toISOString(), ends_at: new Date(now.getTime() + Number(f.hours) * 36e5).toISOString(), quota: f.quota ? Number(f.quota) : null }); qc.invalidateQueries({ queryKey: ["flash-admin"] }); setMsg(""); } catch (er) { setMsg(errMsg(er)); } }}>
      <input required className="input" placeholder="Product ID" value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} /><input required className="input" placeholder="Sale price ₦" value={f.sale_price} onChange={(e) => setF({ ...f, sale_price: e.target.value })} />
      <input className="input" placeholder="Duration (hours)" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /><input className="input" placeholder="Quota (optional)" value={f.quota} onChange={(e) => setF({ ...f, quota: e.target.value })} /><button className="btn-primary">Start sale</button></form>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm divide-y">{data.map((s: any) => <div key={s.id} className="flex justify-between py-2 text-sm"><span>{s.product_name}</span><span>{money(s.sale_price)} · ends {new Date(s.ends_at).toLocaleString()} · sold {s.sold}{s.quota ? `/${s.quota}` : ""}</span></div>)}</div></div>;
}

function SettingsAdmin() {
  const { data, isLoading } = useQuery({ queryKey: ["settings-admin"], queryFn: async () => (await api.get("/settings/")).data }); const [msg, setMsg] = useState("");
  if (isLoading) return <Spinner />;
  const save = async (patch: any) => { try { await api.patch("/settings/", patch); setMsg("Saved."); } catch (e) { setMsg(errMsg(e)); } };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2 text-sm">{msg && <Success>{msg}</Success>}
    {(["bank_name", "bank_account_name", "bank_account_number"] as const).map((k) => <label key={k} className="block">{k.replaceAll("_", " ")}<input className="input" defaultValue={data[k]} onBlur={(e) => save({ [k]: e.target.value })} /></label>)}
    <label className="flex gap-2"><input type="checkbox" defaultChecked={data.cod_enabled} onChange={(e) => save({ cod_enabled: e.target.checked })} /> Cash on delivery enabled</label></div>;
}

function StaffAdmin() {
  const qc = useQueryClient(); const { data, isLoading } = useQuery({ queryKey: ["staff"], queryFn: async () => (await api.get("/auth/staff/")).data.results });
  const [f, setF] = useState({ email: "", password: "", role: "store_admin" }); const [msg, setMsg] = useState("");
  if (isLoading) return <Spinner />;
  return <div className="space-y-3">{msg && <ErrorBox msg={msg} />}
    <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm grid gap-2 md:grid-cols-4" onSubmit={async (e) => { e.preventDefault(); try { await api.post("/auth/staff/", f); qc.invalidateQueries({ queryKey: ["staff"] }); setMsg(""); } catch (er) { setMsg(errMsg(er)); } }}>
      <input required type="email" className="input" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /><input required type="password" className="input" placeholder="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{["store_admin", "delivery_agent", "support_agent", "super_admin"].map((r) => <option key={r}>{r}</option>)}</select><button className="btn-primary">Create account</button></form>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm divide-y">{data.map((u: any) => <div key={u.id} className="flex items-center justify-between py-2 text-sm"><span>#{u.id} {u.email} · {u.role}</span>
      <button className="text-blue-600" onClick={async () => { try { await api.post(`/auth/staff/${u.id}/${u.is_active === false ? "enable" : "disable"}/`); qc.invalidateQueries({ queryKey: ["staff"] }); } catch (e) { setMsg(errMsg(e)); } }}>Disable / enable</button></div>)}</div></div>;
}

function AuditAdmin() {
  const { data, isLoading } = useQuery({ queryKey: ["audit"], queryFn: async () => (await api.get("/auth/audit-logs/")).data.results });
  if (isLoading) return <Spinner />;
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm divide-y text-sm">{data.map((a: any) => <div key={a.id} className="py-2">{new Date(a.created_at).toLocaleString()} · {a.actor_email ?? "system"} · <b>{a.action}</b> {a.target_type} {a.target_id}</div>)}</div>;
}
