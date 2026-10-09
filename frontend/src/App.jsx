import { useState } from "react";
import { api } from "./api";
import Feed from "./Feed.jsx";
import Profile from "./Profile.jsx";

function decodeUserFromToken() {
  // The signup/login response carries the full user object; we stash a
  // trimmed copy in localStorage alongside the token so a page refresh
  // doesn't need a round trip just to know who's logged in.
  const raw = localStorage.getItem("pulse_user");
  return raw ? JSON.parse(raw) : null;
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({ handle: "", displayName: "", email: "", password: "", identifier: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result =
        mode === "signup"
          ? await api.signup({
              handle: form.handle,
              displayName: form.displayName,
              email: form.email,
              password: form.password,
            })
          : await api.login({ identifier: form.identifier, password: form.password });

      api.setToken(result.token);
      localStorage.setItem("pulse_user", JSON.stringify(result.user));
      onAuthed(result.user);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>Pulse</h1>
      <p className="sub">{mode === "signup" ? "Create your account" : "Welcome back"}</p>

      <form onSubmit={handleSubmit}>
        {mode === "signup" ? (
          <>
            <input placeholder="Name" value={form.displayName} onChange={update("displayName")} required />
            <input placeholder="Handle (e.g. ada_dev)" value={form.handle} onChange={update("handle")} required />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={update("email")}
              required
            />
          </>
        ) : (
          <input
            placeholder="Handle or email"
            value={form.identifier}
            onChange={update("identifier")}
            required
          />
        )}
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={update("password")}
          required
          minLength={mode === "signup" ? 8 : undefined}
        />
        {error && <div className="form-error">{error}</div>}
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Please wait…" : mode === "signup" ? "Sign up" : "Log in"}
        </button>
      </form>

      <div className="switch">
        {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
        <button onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
          {mode === "signup" ? "Log in" : "Sign up"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => (api.getToken() ? decodeUserFromToken() : null));
  // Simple state-based routing — no react-router needed for two views.
  // { type: "feed" } | { type: "profile", handle }
  const [view, setView] = useState({ type: "feed" });

  function handleLogout() {
    api.clearToken();
    localStorage.removeItem("pulse_user");
    setUser(null);
    setView({ type: "feed" });
  }

  function goToProfile(handle) {
    if (!handle) return;
    setView({ type: "profile", handle });
  }

  function goHome() {
    setView({ type: "feed" });
  }

  // Keep the locally-stored user in sync after an edit-profile save, so a
  // page refresh (or a re-render reading from localStorage) shows the
  // updated name/avatar/bio without an extra round trip.
  function handleProfileUpdated(updatedUser) {
    setUser((prev) => {
      const merged = { ...prev, ...updatedUser };
      localStorage.setItem("pulse_user", JSON.stringify(merged));
      return merged;
    });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="wordmark-btn" onClick={goHome}>
          <span className="wordmark">Pulse</span>
        </button>
        {user && (
          <div className="session">
            <button className="handle-link" onClick={() => goToProfile(user.handle)}>
              @{user.handle}
            </button>
            <button onClick={handleLogout}>Log out</button>
          </div>
        )}
      </header>

      {!user && <AuthScreen onAuthed={setUser} />}

      {user && view.type === "feed" && (
        <Feed user={{ id: user._id, ...user }} onNavigate={goToProfile} />
      )}

      {user && view.type === "profile" && (
        <Profile
          handle={view.handle}
          currentUser={{ id: user._id, ...user }}
          onProfileUpdated={handleProfileUpdated}
          onNavigate={goToProfile}
        />
      )}
    </div>
  );
}
