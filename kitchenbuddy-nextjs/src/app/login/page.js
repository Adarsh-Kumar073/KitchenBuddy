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
        router.push("/"); // redirect to home/dashboard
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-400 to-purple-500 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">
          Login
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full px-4 py-2 border text-black rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Password"
            required
            className="w-full px-4 py-2 border text-black rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition duration-200"
          >
            {loading ? "🔒 Logging in..." : "Login"}
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-5 text-center">
          Don’t have an account?{" "}
          <a
            href="/signup"
            className="text-blue-500 font-medium hover:underline"
          >
            Signup
          </a>
        </p>
      </div>
    </div>
  );
}
