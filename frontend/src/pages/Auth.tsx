
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { api, errMsg } from "../api/client";
import { ErrorBox, Success } from "../components/ui";
import { homeFor, useAuth } from "../contexts/AuthContext";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  phone: z.string().min(7, "Enter a valid phone"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

function AuthShell({ children, heading, subtitle }: {
  children: React.ReactNode;
  heading: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto flex min-h-[680px] w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-200/70 md:grid-cols-2">
        <div className="relative hidden min-h-[650px] flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white md:flex lg:p-14">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900" />
          <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black shadow-lg shadow-blue-900/40">
                BD
              </span>
              <span className="text-2xl font-extrabold tracking-tight">
                BD Store<span className="text-blue-400">.</span>
              </span>
            </Link>
          </div>

          <div className="relative z-10 max-w-md">
            <span className="mb-6 inline-flex rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
              Your shopping destination
            </span>
            <h2 className="text-4xl font-bold leading-tight lg:text-5xl">
              Great products.
              <br />
              Better shopping.
              <br />
              <span className="text-blue-400">Every day.</span>
            </h2>
            <p className="mt-6 max-w-sm text-base leading-7 text-slate-300">
              Discover products you love, enjoy a smooth shopping experience
              and manage all your orders in one place.
            </p>

            <div className="mt-10 flex items-center gap-3 text-sm text-slate-300">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg">
                ✓
              </span>
              Simple and convenient online shopping
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
            <span>BD Store © {new Date().getFullYear()}</span>
            <span>Shop with confidence.</span>
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md">
            <Link to="/" className="mb-10 inline-flex items-center gap-2 md:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-black text-white">
                BD
              </span>
              <span className="text-xl font-extrabold text-slate-900">
                BD Store
              </span>
            </Link>

            <div className="mb-8">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
                Welcome to BD Store
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                {heading}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {subtitle}
              </p>
            </div>
            {children}
            <p className="mt-8 text-center text-xs text-slate-400">
              Secure shopping experience · BD Store
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: {
  label: string;
  error?: any;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 block text-xs font-medium text-red-600">
          {String(error)}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10";

function PasswordInput({
  register,
  name,
}: {
  register: any;
  name: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        className={`${inputClass} pr-16`}
        type={visible ? "text" : "password"}
        placeholder="Enter your password"
        autoComplete={name === "password" ? "current-password" : "new-password"}
        {...register(name)}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 hover:text-blue-800"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

function ForgotLink() {
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function reset() {
    const email = prompt("Enter your registered email address");
    if (!email) return;

    try {
      await api.post("/auth/password-reset/", { email });
      setSent(true);
      setMessage("");
    } catch (error) {
      setMessage(errMsg(error));
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={reset}
        className="text-sm font-semibold text-blue-600 hover:text-blue-800"
      >
        {sent ? "Email requested" : "Forgot password?"}
      </button>
      {message && <p className="mt-1 text-xs text-red-600">{message}</p>}
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  return (
    <AuthShell
      heading="Welcome back"
      subtitle="Sign in to your account to continue shopping."
    >
      <form
        className="space-y-5"
        onSubmit={handleSubmit(async (v) => {
          setErr("");
          try {
            const u = await login(v.email, v.password);
            nav(homeFor(u));
          } catch (e: any) {
            setErr(
              e?.response?.status === 401
                ? "Invalid email or password."
                : errMsg(e)
            );
          }
        })}
      >
        {err && <ErrorBox msg={err} />}

        <Field label="Email address" error={errors.email?.message}>
          <input
            className={inputClass}
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
          />
        </Field>

        <div className="space-y-2">
          <Field label="Password" error={errors.password?.message}>
            <PasswordInput register={register} name="password" />
          </Field>
          <ForgotLink />
        </div>

        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing you in..." : "Sign in to your account"}
          {!isSubmitting && <span>→</span>}
        </button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-xs text-slate-400">
              NEW TO BD STORE?
            </span>
          </div>
        </div>

        <Link
          to="/register"
          className="block w-full rounded-xl border border-slate-200 px-5 py-3.5 text-center text-sm font-bold text-slate-700 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700"
        >
          Create a new account
        </Link>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  return (
    <AuthShell
      heading="Create account"
      subtitle="Join BD Store and start enjoying a better shopping experience."
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit(async (v) => {
          setErr("");
          try {
            await api.post("/auth/register/", v);
            await login(v.email, v.password);
            nav("/");
          } catch (e) {
            setErr(errMsg(e));
          }
        })}
      >
        {err && <ErrorBox msg={err} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.first_name?.message}>
            <input
              className={inputClass}
              placeholder="First name"
              {...register("first_name")}
            />
          </Field>
          <Field label="Last name" error={errors.last_name?.message}>
            <input
              className={inputClass}
              placeholder="Last name"
              {...register("last_name")}
            />
          </Field>
        </div>

        <Field label="Phone number" error={errors.phone?.message}>
          <input
            className={inputClass}
            type="tel"
            placeholder="+234..."
            {...register("phone")}
          />
        </Field>

        <Field label="Email address" error={errors.email?.message}>
          <input
            className={inputClass}
            type="email"
            placeholder="you@example.com"
            {...register("email")}
          />
        </Field>

        <Field label="Password" error={errors.password?.message}>
          <PasswordInput register={register} name="password" />
          <span className="mt-1.5 block text-xs text-slate-400">
            Use at least 8 characters.
          </span>
        </Field>

        <button
          className="w-full rounded-xl bg-blue-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account..." : "Create my account →"}
        </button>

        <p className="pt-2 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            className="font-bold text-blue-600 hover:text-blue-800"
            to="/login"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ResetPassword() {
  const { uid, token } = useParams();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <AuthShell
      heading="Reset password"
      subtitle="Choose a new password for your BD Store account."
    >
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg("");
          setLoading(true);
          try {
            await api.post("/auth/password-reset/confirm/", {
              uid,
              token,
              password: pw,
            });
            setOk(true);
          } catch (er) {
            setMsg(errMsg(er));
          } finally {
            setLoading(false);
          }
        }}
      >
        {ok ? (
          <Success>
            Password updated successfully.{" "}
            <Link className="font-bold underline" to="/login">
              Sign in
            </Link>
          </Success>
        ) : (
          <>
            {msg && <ErrorBox msg={msg} />}
            <Field label="New password">
              <div className="relative">
                <input
                  className={`${inputClass} pr-16`}
                  type={visible ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600"
                >
                  {visible ? "Hide" : "Show"}
                </button>
              </div>
            </Field>
            <button
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </>
        )}
      </form>
    </AuthShell>
  );
}
