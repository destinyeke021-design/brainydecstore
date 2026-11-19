
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, errMsg } from "../api/client";
import { Empty, ErrorBox, Spinner, Success } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { money } from "../utils/format";

export function CartPage() {
  const qc = useQueryClient();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cart", applied],
    queryFn: async () =>
      (await api.get(`/cart/${applied ? `?coupon=${applied}` : ""}`)).data,
  });

  const set = useMutation({
    mutationFn: (v: { product: number; quantity: number }) =>
      api.post("/cart/items/", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
    onError: (e) => alert(errMsg(e)),
  });

  if (isLoading) return <Spinner />;

  if (!data?.items?.length) {
    return (
      <Empty>
        Your cart is empty.{" "}
        <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/products">
          Continue shopping
        </Link>
      </Empty>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Shopping Cart</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review your items before checkout.
          </p>
        </div>

        <div className="divide-y divide-slate-100 px-5">
          {data.items.map((i: any) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center gap-4 py-5"
            >
              <div className="min-w-0 flex-1">
                <Link
                  to={`/products/${i.product.slug}`}
                  className="font-semibold text-slate-900 transition hover:text-blue-600"
                >
                  {i.product.name}
                </Link>

                <div className="mt-1 text-sm text-slate-500">
                  {money(i.unit_price)}
                  {!i.available && (
                    <span className="ml-2 font-medium text-red-600">
                      Not enough stock
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-1">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={set.isPending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  onClick={() =>
                    set.mutate({
                      product: i.product.id,
                      quantity: i.quantity - 1,
                    })
                  }
                >
                  −
                </button>

                <span className="w-7 text-center text-sm font-semibold text-slate-900">
                  {i.quantity}
                </span>

                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={set.isPending}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  onClick={() =>
                    set.mutate({
                      product: i.product.id,
                      quantity: i.quantity + 1,
                    })
                  }
                >
                  +
                </button>
              </div>

              <div className="w-28 text-right font-bold text-slate-900">
                {money(i.line_total)}
              </div>

              <button
                type="button"
                disabled={set.isPending}
                className="text-sm font-medium text-red-600 transition hover:text-red-800 disabled:opacity-50"
                onClick={() =>
                  set.mutate({ product: i.product.id, quantity: 0 })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>

        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Coupon code"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
          />
          <button
            type="button"
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            onClick={() => setApplied(coupon.trim())}
          >
            Apply
          </button>
        </div>

        {data.coupon_error && <ErrorBox msg={data.coupon_error} />}

        <div className="space-y-3 border-b border-slate-200 pb-4 text-sm">
          <Row l="Subtotal" v={money(data.subtotal)} />

          {data.discount > 0 && (
            <Row l="Discount" v={`− ${money(data.discount)}`} />
          )}

          <Row
            l="Delivery"
            v={data.shipping ? money(data.shipping) : "Free"}
          />
        </div>

        <div className="flex items-center justify-between text-base font-bold text-slate-900">
          <span>Total</span>
          <span>{money(data.total)}</span>
        </div>

        <Link
          to={`/checkout${applied ? `?coupon=${encodeURIComponent(applied)}` : ""}`}
          className="block w-full rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Proceed to Checkout
        </Link>

        <Link
          to="/products"
          className="block text-center text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          Continue Shopping
        </Link>
      </aside>
    </div>
  );
}

const Row = ({
  l,
  v,
}: {
  l: string;
  v: string;
  bold?: boolean;
}) => (
  <div className="flex justify-between text-sm text-slate-600">
    <span>{l}</span>
    <span className="font-medium text-slate-900">{v}</span>
  </div>
);

export function Checkout() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [sp] = useSearchParams();

  const coupon = sp.get("coupon") ?? "";

  const cart = useQuery({
    queryKey: ["cart", coupon],
    queryFn: async () =>
      (await api.get(`/cart/${coupon ? `?coupon=${coupon}` : ""}`)).data,
  });

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings/public/")).data,
  });

  const addrs = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => (await api.get("/auth/addresses/")).data.results,
  });

  const [addr, setAddr] = useState<number | null>(null);
  const [method, setMethod] = useState("paystack");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (addrs.data?.length && addr === null) {
      setAddr(addrs.data[0].id);
    }
  }, [addrs.data, addr]);

  const place = async () => {
    setErr("");
    setBusy(true);

    try {
      const { data: order } = await api.post("/checkout/", {
        address_id: addr,
        payment_method: method,
        coupon_code: coupon,
        idempotency_key: key,
      });

      qc.invalidateQueries({ queryKey: ["cart"] });

      if (method === "paystack" || method === "flutterwave") {
        const { data } = await api.post("/payments/initialize/", {
          order: order.number,
          provider: method,
        });

        window.location.href = data.checkout_url;
        return;
      }

      nav(`/orders/${order.number}`);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (cart.isLoading || settings.isLoading || addrs.isLoading) {
    return <Spinner />;
  }

  if (!cart.data?.items?.length) {
    return <Empty>Your cart is empty.</Empty>;
  }

  const methods: Record<string, string> = {
    paystack: "Card / Bank (Paystack)",
    flutterwave: "Card / Bank (Flutterwave)",
    bank_transfer: "Bank Transfer",
    cod: "Cash on Delivery",
    wallet: "Wallet Balance",
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Delivery Address
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select where you want your order delivered.
            </p>
          </div>

          {addrs.data?.length ? (
            <div className="space-y-3">
              {addrs.data.map((a: any) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                    addr === a.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery-address"
                    checked={addr === a.id}
                    onChange={() => setAddr(a.id)}
                    className="mt-1 accent-blue-600"
                  />

                  <span className="text-sm">
                    <span className="block font-semibold text-slate-900">
                      {a.full_name}
                    </span>
                    <span className="mt-1 block text-slate-600">
                      {a.line1}, {a.city}, {a.state}
                    </span>
                    <span className="mt-1 block text-slate-500">
                      {a.phone}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              You have not added a delivery address yet.
            </p>
          )}

          <button
            type="button"
            className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            onClick={() => setShow(!show)}
          >
            {show ? "Cancel" : "+ Add New Address"}
          </button>

          {show && (
            <AddressForm
              onDone={() => {
                setShow(false);
                addrs.refetch();
              }}
            />
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Payment Method
          </h2>

          <p className="mb-4 mt-1 text-sm text-slate-500">
            Choose how you want to pay for your order.
          </p>

          <div className="space-y-3">
            {(settings.data?.enabled_payment_methods ?? []).map(
              (m: string) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm transition ${
                    method === m
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="accent-blue-600"
                  />
                  <span className="font-medium text-slate-800">
                    {methods[m] ?? m}
                  </span>
                </label>
              )
            )}
          </div>

          {method === "bank_transfer" && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
              <h3 className="mb-2 font-semibold text-blue-900">
                Bank Transfer Details
              </h3>
              <p>
                Bank:{" "}
                <b>{settings.data.bank_name || "(bank not configured)"}</b>
              </p>
              <p>
                Account Number:{" "}
                <b>{settings.data.bank_account_number}</b>
              </p>
              <p>
                Account Name:{" "}
                <b>{settings.data.bank_account_name}</b>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                You will submit your payment reference after placing the order.
              </p>
            </div>
          )}
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Order Summary
        </h2>

        <div className="space-y-3 border-b border-slate-200 pb-4">
          <Row l="Subtotal" v={money(cart.data.subtotal)} />

          {cart.data.discount > 0 && (
            <Row l="Discount" v={`− ${money(cart.data.discount)}`} />
          )}

          <Row
            l="Delivery"
            v={cart.data.shipping ? money(cart.data.shipping) : "Free"}
          />
        </div>

        <div className="flex justify-between text-base font-bold text-slate-900">
          <span>Total</span>
          <span>{money(cart.data.total)}</span>
        </div>

        {err && <ErrorBox msg={err} />}

        <button
          type="button"
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !addr}
          onClick={place}
        >
          {busy ? "Placing Order..." : "Place Order"}
        </button>

        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          Signed in as{" "}
          <span className="font-semibold text-slate-700">
            {user?.email}
          </span>
          . Final prices and stock availability are confirmed by our server.
        </div>
      </aside>
    </div>
  );
}

function AddressForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    full_name: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
    country: "NG",
  });

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const u = (k: string) => (e: any) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <form
      className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        setBusy(true);

        try {
          await api.post("/auth/addresses/", f);
          onDone();
        } catch (er) {
          setErr(errMsg(er));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-semibold text-slate-900 md:col-span-2">
        New Delivery Address
      </h3>

      {(
        ["full_name", "phone", "line1", "city", "state"] as const
      ).map((k) => (
        <input
          key={k}
          required
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder={k.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          value={f[k]}
          onChange={u(k)}
        />
      ))}

      {err && (
        <div className="md:col-span-2">
          <ErrorBox msg={err} />
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 md:col-span-2"
      >
        {busy ? "Saving Address..." : "Save Address"}
      </button>
    </form>
  );
}

export function PaymentCallback() {
  const [sp] = useSearchParams();
  const nav = useNavigate();

  const ref =
    sp.get("reference") || sp.get("tx_ref") || "";

  const [state, setState] = useState<
    "checking" | "success" | "failed" | "error"
  >("checking");

  useEffect(() => {
    if (!ref) {
      setState("error");
      return;
    }

    api
      .get(`/payments/verify/?reference=${encodeURIComponent(ref)}`)
      .then((r) =>
        setState(r.data.status === "success" ? "success" : "failed")
      )
      .catch(() => setState("error"));
  }, [ref]);

  if (state === "checking") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Spinner />
        <p className="mt-4 font-medium text-slate-700">
          Verifying your payment...
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Please wait while we confirm your transaction.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      {state === "success" ? (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl text-blue-600">
            ✓
          </div>
          <Success>Payment verified. Thank you for shopping with BD Store!</Success>
        </>
      ) : (
        <>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl text-red-600">
            !
          </div>
          <ErrorBox
            msg={
              state === "failed"
                ? "Payment was not completed."
                : "We could not verify this payment yet. Please check your orders shortly."
            }
          />
        </>
      )}

      <button
        type="button"
        className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
        onClick={() => nav("/orders")}
      >
        View My Orders
      </button>
    </div>
  );
}
