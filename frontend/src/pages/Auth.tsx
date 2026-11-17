import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { api, errMsg } from "../api/client";
import { ErrorBox, Success } from "../components/ui";
import { homeFor, useAuth } from "../contexts/AuthContext";

export const loginSchema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Password is required") });
export const registerSchema = z.object({
  first_name: z.string().min(1, "Required"), last_name: z.string().min(1, "Required"), phone: z.string().min(7, "Enter a valid phone"),
  email: z.string().email("Enter a valid email"), password: z.string().min(8, "At least 8 characters"),
});

const Field = ({ label, err, children }: { label: string; err?: any; children: React.ReactNode }) => (
  <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>{children}{err && <span className="mt-1 block text-xs text-red-600">{String(err)}</span>}</label>
);

export function Login() {
  const { login } = useAuth(); const nav = useNavigate(); const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      <form className="card space-y-3" onSubmit={handleSubmit(async (v) => { try { const u = await login(v.email, v.password); nav(homeFor(u)); } catch (e: any) { setErr(e?.response?.status === 401 ? "Invalid email or password." : errMsg(e)); } })}>
        {err && <ErrorBox msg={err} />}
        <Field label="Email" err={errors.email?.message}><input className="input" type="email" {...register("email")} /></Field>
        <Field label="Password" err={errors.password?.message}><input className="input" type="password" {...register("password")} /></Field>
        <button className="btn-primary w-full" disabled={isSubmitting}>Sign in</button>
        <div className="text-center text-sm"><Link className="text-brand" to="/register">Create account</Link> · <ForgotLink /></div>
      </form>
    </div>
  );
}

function ForgotLink() {
  const [sent, setSent] = useState(false);
  return <button type="button" className="text-brand" onClick={async () => { const email = prompt("Enter your email"); if (email) { await api.post("/auth/password-reset/", { email }); setSent(true); } }}>{sent ? "Check your email" : "Forgot password?"}</button>;
}

export function Register() {
  const { login } = useAuth(); const nav = useNavigate(); const [err, setErr] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema) });
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-semibold">Create your account</h1>
      <form className="card space-y-3" onSubmit={handleSubmit(async (v) => { try { await api.post("/auth/register/", v); await login(v.email, v.password); nav("/"); } catch (e) { setErr(errMsg(e)); } })}>
        {err && <ErrorBox msg={err} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" err={errors.first_name?.message}><input className="input" {...register("first_name")} /></Field>
          <Field label="Last name" err={errors.last_name?.message}><input className="input" {...register("last_name")} /></Field>
        </div>
        <Field label="Phone" err={errors.phone?.message}><input className="input" {...register("phone")} /></Field>
        <Field label="Email" err={errors.email?.message}><input className="input" type="email" {...register("email")} /></Field>
        <Field label="Password" err={errors.password?.message}><input className="input" type="password" {...register("password")} /></Field>
        <button className="btn-primary w-full" disabled={isSubmitting}>Create account</button>
      </form>
    </div>
  );
}

export function ResetPassword() {
  const { uid, token } = useParams(); const [pw, setPw] = useState(""); const [msg, setMsg] = useState(""); const [ok, setOk] = useState(false);
  return (
    <form className="card mx-auto max-w-sm space-y-3" onSubmit={async (e) => { e.preventDefault(); try { await api.post("/auth/password-reset/confirm/", { uid, token, password: pw }); setOk(true); } catch (er) { setMsg(errMsg(er)); } }}>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      {ok ? <Success>Password updated. <Link className="underline" to="/login">Sign in</Link></Success> : <>
        {msg && <ErrorBox msg={msg} />}<input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /><button className="btn-primary w-full">Update password</button></>}
    </form>
  );
}
