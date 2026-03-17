"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data.token) {
        localStorage.setItem("token", data.token);
        alert("✅ Login successful");
        router.push("/");
      } else {
        alert(data.error || "❌ Invalid email or password");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Something went wrong. Try again later.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 to-red-500 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🍳</div>
          <h1 className="text-xl font-bold text-orange-500">KitchenBuddy</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full px-4 py-2.5 border border-gray-200 text-gray-800 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            required
            className="w-full px-4 py-2.5 border border-gray-200 text-gray-800 rounded-lg focus:ring-2 focus:ring-orange-400 focus:outline-none text-sm"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg transition-colors font-medium text-sm disabled:opacity-70 cursor-pointer"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-5 text-center">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="text-orange-500 font-medium hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
