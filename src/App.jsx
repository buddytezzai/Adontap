import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import TemplateGallery from "./components/TemplateGallery";
import Studio from "./components/Studio";
import AdRepository from "./components/AdRepository";
import Pricing from "./components/Pricing";
import Toast from "./components/Toast";
import AuthModal from "./components/AuthModal";
import { TEMPLATES, INITIAL_REPOSITORY } from "./data/mockData";
import "./App.css";

const STORAGE_KEYS = {
  USER: "admaya_user_session",
  REPOSITORY: "admaya_ad_repository",
};

export default function App() {
  const [activeId, setActiveId] = useState(TEMPLATES[0].id);
  const [toast, setToast] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // User Authentication State
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 24-Hour Ad Repository State
  const [repository, setRepository] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REPOSITORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Filter out items older than 24 hours on initial load
        const valid = parsed.filter((item) => item.expiresAt > Date.now());
        return valid;
      }
      return INITIAL_REPOSITORY;
    } catch {
      return INITIAL_REPOSITORY;
    }
  });

  const timer = useRef();

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3000);
  }, []);

  // Save user changes to localStorage
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  // Save repository changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.REPOSITORY, JSON.stringify(repository));
    } catch (e) {
      console.error(e);
    }
  }, [repository]);

  // Periodic 24-hour cleanup checker
  useEffect(() => {
    const cleanUpInterval = setInterval(() => {
      setRepository((prev) => {
        const now = Date.now();
        const unexpired = prev.filter((item) => item.expiresAt > now);
        if (unexpired.length !== prev.length) {
          showToast("Expired items older than 24h were cleaned up from the repository.");
        }
        return unexpired;
      });
    }, 60000); // check every minute

    return () => clearInterval(cleanUpInterval);
  }, [showToast]);

  useEffect(() => {
    document.title = "AdMaya.ai · AI Video Ads & 24h Video Repository";
    return () => clearTimeout(timer.current);
  }, []);

  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const chooseTemplate = (id) => {
    setActiveId(id);
    setTimeout(() => scrollTo("studio"), 50);
  };

  const handleLogin = (userData) => {
    setUser(userData);
    showToast(`Welcome, ${userData.name}! You are now signed in.`);
  };

  const handleLogout = () => {
    setUser(null);
    showToast("Signed out successfully.");
  };

  const handleAddGeneratedAd = (newAd) => {
    setRepository((prev) => [newAd, ...prev]);
    // Deduct mock credits if user is logged in
    if (user && user.credits >= newAd.price) {
      setUser((prev) => ({
        ...prev,
        credits: prev.credits - newAd.price,
      }));
    }
  };

  const handleDeleteFromRepo = (id) => {
    setRepository((prev) => prev.filter((item) => item.id !== id));
    showToast("Ad removed from temporary repository.");
  };

  const handleExportToMeta = (ad) => {
    showToast(`Queued "${ad.title}" for Meta Ads Manager upload`);
  };

  return (
    <div className="app-container">
      <Navbar
        scrollTo={scrollTo}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        repoCount={repository.filter((i) => i.expiresAt > Date.now()).length}
      />

      <main>
        <Hero scrollTo={scrollTo} />

        <TemplateGallery
          templates={TEMPLATES}
          activeId={activeId}
          onSelect={chooseTemplate}
        />

        <Studio
          key={activeId}
          template={TEMPLATES.find((t) => t.id === activeId) || TEMPLATES[0]}
          user={user}
          onRequireAuth={() => setAuthModalOpen(true)}
          onAddGeneratedAd={handleAddGeneratedAd}
          showToast={showToast}
          scrollTo={scrollTo}
        />

        <AdRepository
          items={repository}
          onDelete={handleDeleteFromRepo}
          onExport={handleExportToMeta}
          showToast={showToast}
          scrollTo={scrollTo}
        />

        <Pricing
          showToast={showToast}
          onOpenAuth={() => setAuthModalOpen(true)}
          user={user}
        />
      </main>

      <footer className="footer">
        <div className="wrap foot-row">
          <div className="foot-brand">
            <div className="brand-mark sm">A</div>
            <div>
              <b>AdMaya.ai</b> · High-converting AI video ad generation platform.
            </div>
          </div>
          <div className="foot-notice">
            <span>⚠️ 24-Hour ephemeral repository storage policy enforced for all generated assets.</span>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLogin={handleLogin}
      />

      <Toast message={toast} />
    </div>
  );
}
