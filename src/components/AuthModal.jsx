import { useState } from "react";
import { FiLock, FiMail, FiUser, FiX, FiCheck, FiZap, FiShield } from "react-icons/fi";

export default function AuthModal({ isOpen, onClose, onLogin, initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const displayName = name.trim() || email.split("@")[0];
      onLogin({
        id: "user-" + Math.random().toString(36).substring(2, 9),
        name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        email: email.toLowerCase(),
        credits: 1200,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      });
      onClose();
    }, 600);
  };

  const handleDemoLogin = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({
        id: "usr_demo_vip",
        name: "Alex Rivera",
        email: "alex.rivera@admaya.ai",
        credits: 1500,
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=AlexRivera",
      });
      onClose();
    }, 400);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <FiX />
        </button>

        <div className="auth-header">
          <div className="auth-badge">
            <FiShield className="auth-badge-icon" /> Secure AI Studio Access
          </div>
          <h3>{mode === "signin" ? "Sign in to AdMaya" : "Create your account"}</h3>
          <p className="auth-sub">
            Credentials required to generate AI ads and access your temporary 24-hour video repository.
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <div className="input-group">
              <label>Full Name</label>
              <div className="input-wrapper">
                <FiUser className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. Maya Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus={mode === "signup"}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <FiMail className="input-icon" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={mode === "signin"}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <FiLock className="input-icon" />
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="cta-btn auth-submit-btn" disabled={loading}>
            {loading ? "Authenticating…" : mode === "signin" ? "Sign In & Continue" : "Create Account & Continue"}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <button type="button" className="demo-login-btn" onClick={handleDemoLogin} disabled={loading}>
          <FiZap className="zap-icon" />
          <span>Instant 1-Click Demo Login</span>
          <span className="demo-tag">Free 1,500 Cr</span>
        </button>

        <div className="auth-footer-note">
          <FiCheck className="note-check" />
          <span>Generated ads are securely saved to your repository for 24 hours.</span>
        </div>
      </div>
    </div>
  );
}
