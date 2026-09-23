import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { FiLock, FiMail, FiUser, FiX, FiCheck, FiShield } from "react-icons/fi";
import { auth, firebaseConfigured } from "../firebase";

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
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!auth || !firebaseConfigured) {
      setError("Firebase is not configured. Add the REACT_APP_FIREBASE_* values to .env.");
      return;
    }

    setLoading(true);
    const operation = mode === "signin"
      ? signInWithEmailAndPassword(auth, email, password)
      : createUserWithEmailAndPassword(auth, email, password);
    operation.then(async ({ user }) => {
      if (mode === "signup" && name.trim()) await updateProfile(user, { displayName: name.trim() });
      setLoading(false);
      onLogin({
        id: user.uid,
        name: user.displayName || user.email.split("@")[0],
        email: user.email,
        credits: 0,
        avatar: user.photoURL,
      });
      onClose();
    }).catch((err) => {
      setLoading(false);
      setError(err.message || "Authentication failed.");
    });
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

        <div className="auth-footer-note">
          <FiCheck className="note-check" />
          <span>Generated ads are securely saved to your repository for 24 hours.</span>
        </div>
      </div>
    </div>
  );
}
