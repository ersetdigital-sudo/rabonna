"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/pesanan/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (!res.ok) {
        setError("Password salah. Coba lagi.");
        setLoading(false);
        return;
      }

      router.push("/pesanan/orders");
      router.refresh();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div
      className="pas-light min-h-screen flex items-center justify-center px-5 py-10"
      style={{ background: "var(--pas-bg)" }}
    >
      <div className="pas-card p-8 w-full max-w-sm">
        <div className="flex flex-col items-center text-center gap-3 mb-7">
          {/* Lockup lengkap (emblem + wordmark + tagline) — warna navy versi
              gelap, karena kartu login berlatar terang. Nama Rabona sudah ada
              di dalam logo, jadi tidak diulang sebagai teks. */}
          <img
            src="/logo-rabona-dark.png"
            alt="Rabona"
            className="w-56 max-w-full h-auto object-contain"
            style={{ filter: "drop-shadow(0 6px 16px rgba(18,48,91,.18))" }}
          />
          <span className="block text-[11px] tracking-[1.4px] uppercase text-[var(--pas-muted)]">
            Panel Pesanan
          </span>
        </div>

        <h1 className="pas-display text-[26px] mb-2">
          Login<span className="text-[var(--pas-accent)]">.</span>
        </h1>
        <p className="text-[13px] text-[var(--pas-muted)] mb-6">
          Masukkan password untuk mengakses panel pesanan.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="block">
            <span className="block text-[11px] font-semibold tracking-[1.2px] uppercase text-[var(--pas-muted)]">
              Password
            </span>
            <input
              required
              type="password"
              autoComplete="off"
              name="rabonna-pesanan-pass"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              autoFocus
              className="pas-field w-full mt-2 px-4 py-3.5 text-[16px]"
            />
          </label>

          {error && (
            <p
              className="mt-3 text-[13px] rounded-xl border px-4 py-3"
              style={{
                borderColor: "#DCE6F5",
                background: "#FDF2DA",
                color: "#12305B",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="pas-btn-accent w-full mt-5 py-3.5 text-[15px] disabled:opacity-50"
          >
            {loading ? "Memverifikasi…" : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
