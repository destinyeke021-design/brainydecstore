
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

  const links = [
    { title: "My Orders", description: "Track and manage your purchases", to: "/orders", icon: "📦" },
    { title: "My Wallet", description: "Manage your wallet balance", to: "/wallet", icon: "💳" },
    { title: "Wishlist", description: "View your saved products", to: "/wishlist", icon: "♡" },
    { title: "Customer Support", description: "Get help with your orders", to: "/support", icon: "🎧" },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-slate-950 to-slate-900 p-6 text-white shadow-sm md:p-8">
        <p className="text-sm font-medium text-blue-300">YOUR BD STORE ACCOUNT</p>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">
          Hello, {user?.first_name || user?.email}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Welcome back! Manage your orders, wallet, wishlist and support requests.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl transition group-hover:bg-blue-100">
              {item.icon}
            </div>
            <h2 className="mt-4 font-bold text-slate-900 group-hover:text-blue-700">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            <p className="mt-4 text-sm font-semibold text-blue-600">
              Open section →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Orders() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/orders/")).data.results,
  });

  if (isLoading) return <Spinner />;
  if (!data?.length) return <Empty>No orders yet.</Empty>;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="font-bold text-slate-900">My Orders</h2>
        <p className="mt-1 text-sm text-slate-500">
          View your purchases and check their status.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {data.map((o: any) => (
          <Link
            key={o.id}
            to={`/orders/${o.number}`}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm transition hover:bg-blue-50"
          >
            <div>
              <span className="block font-bold text-slate-900">
                {o.number}
              </span>
              <span className="mt-1 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                {o.status.replaceAll("_", " ")}
              </span>
            </div>

            <span className="font-bold text-slate-900">
              {money(o.total)}
            </span>
            <span className="font-semibold text-blue-600">View order →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function OrderDetail() {
  const { number } = useParams();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");

  const { data: o, isLoading } = useQuery({
    queryKey: ["order", number],
    queryFn: async () => (await api.get(`/orders/${number}/`)).data,
  });

  const act = useMutation({
    mutationFn: (a: string) =>
      api.post(
        `/orders/${number}/${a}/`,
        a === "refund" ? { reason: prompt("Reason for refund?") ?? "" } : {}
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", number] });
    },
    onError: (e) => setMsg(errMsg(e)),
  });

  if (isLoading) return <Spinner />;

  const invoice = async () => {
    try {
      const r = await api.get(`/orders/${number}/invoice/`, {
        responseType: "blob",
      });
      window.open(URL.createObjectURL(r.data));
    } catch (e) {
      setMsg(errMsg(e));
    }
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-950 to-slate-900 p-5 text-white shadow-sm">
        <div>
          <p className="text-sm text-blue-300">ORDER DETAILS</p>
          <h1 className="mt-1 text-xl font-bold">Order {o.number}</h1>
        </div>
        <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold capitalize text-blue-200">
          {o.status.replaceAll("_", " ")}
        </span>
      </section>

      {msg && <ErrorBox msg={msg} />}

      {o.payment_method === "bank_transfer" && o.status === "pending_payment" && (
        <TransferForm
          number={o.number}
          onDone={() => qc.invalidateQueries({ queryKey: ["order", number] })}
        />
      )}

      {o.payment_method === "paystack" && o.status === "pending_payment" && (
        <button
          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          onClick={async () => {
            try {
              const { data } = await api.post("/payments/initialize/", {
                order: o.number,
                provider: "paystack",
              });
              window.location.href = data.checkout_url;
            } catch (e) {
              setMsg(errMsg(e));
            }
          }}
        >
          Pay Now
        </button>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold text-slate-900">Order Tracking</h2>
        <ol className="space-y-4">
          {o.history.map((h: any, i: number) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-600 ring-4 ring-blue-50" />
              <div>
                <p className="font-semibold capitalize text-slate-900">
                  {h.to_status.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-slate-500">
                  {new Date(h.created_at).toLocaleString()}
                </p>
                {h.note && (
                  <p className="mt-1 text-slate-600">{h.note}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="font-bold text-slate-900">Items Ordered</h2>
        </div>

        <div className="divide-y divide-slate-100 px-5">
          {o.items.map((i: any) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
            >
              <span className="font-medium text-slate-800">{i.name}</span>
              <span className="text-slate-500">× {i.quantity}</span>
              <span className="font-bold text-slate-900">
                {money(i.line_total)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Shipping</span>
            <span>{money(o.shipping_fee)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-900">
            <span>Total</span>
            <span>{money(o.total)}</span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          onClick={invoice}
        >
          Download {o.is_paid ? "Receipt" : "Invoice"}
        </button>

        {["pending_payment", "payment_verification", "confirmed"].includes(o.status) && (
          <button
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100"
            onClick={() => confirm("Cancel this order?") && act.mutate("cancel")}
          >
            Cancel Order
          </button>
        )}

        {o.is_paid && ["confirmed", "processing", "delivered"].includes(o.status) && (
          <button
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={() => act.mutate("refund")}
          >
            Request Refund
          </button>
        )}
      </div>
    </div>
  );
}

function TransferForm({
  number,
  onDone,
}: {
  number: string;
  onDone: () => void;
}) {
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg("");
        setBusy(true);

        const fd = new FormData();
        fd.append("order", number);
        fd.append("reference", ref);
        if (file) fd.append("proof", file);

        try {
          await api.post("/payments/bank-transfer/", fd);
          onDone();
        } catch (er) {
          setMsg(errMsg(er));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="font-bold text-slate-900">
          Submit Bank Transfer Details
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter your transfer reference and optionally attach payment proof.
        </p>
      </div>

      <input
        required
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        placeholder="Transfer reference"
        value={ref}
        onChange={(e) => setRef(e.target.value)}
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Payment proof (image or PDF)
        </label>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-700"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {msg && <ErrorBox msg={msg} />}

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Submitting..." : "Submit for Verification"}
      </button>
    </form>
  );
}

export function WalletPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["wallet"],
    queryFn: async () => (await api.get("/wallet/")).data,
  });

  const [amt, setAmt] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-slate-950 to-slate-900 p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-blue-300">YOUR BD STORE WALLET</p>
        <p className="mt-3 text-sm text-slate-300">Available Balance</p>
        <h1 className="mt-1 text-3xl font-bold md:text-4xl">
          {money(data.balance)}
        </h1>
        <p className="mt-3 text-xs text-slate-400">
          Your wallet balance can be used for eligible purchases.
        </p>
      </section>

      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          setBusy(true);

          try {
            const { data: r } = await api.post("/wallet/fund/", {
              amount: toMinor(amt),
              provider: "paystack",
            });
            window.location.href = r.checkout_url;
          } catch (er) {
            setErr(errMsg(er));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <h2 className="font-bold text-slate-900">Fund Your Wallet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add money securely using Paystack.
          </p>
        </div>

        <input
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          type="number"
          min="100"
          required
          placeholder="Amount (₦)"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
        />

        {err && <ErrorBox msg={err} />}

        <button
          type="submit"
          disabled={busy || !amt || Number(amt) < 100}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Redirecting..." : "Fund Wallet"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-900">Wallet Transactions</h2>
            <p className="mt-1 text-xs text-slate-500">
              Your recent wallet activity.
            </p>
          </div>
          <button
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
            onClick={() => refetch()}
          >
            Refresh
          </button>
        </div>

        <div className="divide-y divide-slate-100 px-5">
          {!data.transactions.length ? (
            <Empty>No transactions yet.</Empty>
          ) : (
            data.transactions.map((t: any) => (
              <div
                key={t.id}
                className="flex flex-wrap justify-between gap-2 py-4 text-sm"
              >
                <span className="text-slate-700">{t.description}</span>
                <span
                  className={`font-bold ${
                    t.kind === "credit" ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  {t.kind === "credit" ? "+" : "−"}
                  {money(t.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export function WishlistPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => (await api.get("/wishlist/")).data,
  });

  const qc = useQueryClient();

  if (isLoading) return <Spinner />;
  if (!data?.length) return <Empty>Your wishlist is empty.</Empty>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Wishlist</h2>
        <p className="mt-1 text-sm text-slate-500">
          Products you've saved for later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {data.map((p: any) => (
          <div key={p.id} className="min-w-0">
            <ProductCard p={p} />
            <button
              className="mt-2 w-full rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
              onClick={async () => {
                try {
                  await api.delete(`/wishlist/?product=${p.id}`);
                  qc.invalidateQueries({ queryKey: ["wishlist"] });
                } catch (e) {
                  alert(errMsg(e));
                }
              }}
            >
              Remove from Wishlist
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SupportPage() {
  const qc = useQueryClient();

  const [f, setF] = useState({
    subject: "",
    category: "order",
    body: "",
  });

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => (await api.get("/tickets/")).data.results,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form
        className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg("");
          setErr("");
          setBusy(true);

          try {
            const { data: t } = await api.post("/tickets/", {
              subject: f.subject,
              category: f.category,
            });

            await api.post(`/tickets/${t.id}/reply/`, {
              body: f.body,
            });

            setF({ subject: "", category: "order", body: "" });
            setMsg("Your support ticket has been created.");
            qc.invalidateQueries({ queryKey: ["tickets"] });
          } catch (er) {
            setErr(errMsg(er));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Contact Support
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tell us how we can help you.
          </p>
        </div>

        <input
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          required
          placeholder="Subject"
          value={f.subject}
          onChange={(e) => setF({ ...f, subject: e.target.value })}
        />

        <textarea
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          required
          rows={5}
          placeholder="Describe the problem"
          value={f.body}
          onChange={(e) => setF({ ...f, body: e.target.value })}
        />

        {err && <ErrorBox msg={err} />}
        {msg && <Success>{msg}</Success>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Submitting..." : "Submit Support Request"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="font-bold text-slate-900">Your Support Tickets</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review your conversations with our support team.
          </p>
        </div>

        <div className="space-y-4 p-5">
          {!data?.length ? (
            <Empty>No support tickets yet.</Empty>
          ) : (
            data.map((t: any) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-sm text-slate-900">
                    #{t.id} {t.subject}
                  </b>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                    {t.status}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {t.messages.map((m: any) => (
                    <div
                      key={m.id}
                      className="rounded-lg bg-slate-50 p-3 text-sm"
                    >
                      <p className="mb-1 text-xs font-bold text-blue-700">
                        {m.author_role === "customer" ? "You" : "Support"}
                      </p>
                      <p className="text-slate-700">{m.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
