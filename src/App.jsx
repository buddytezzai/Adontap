import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import TemplateGallery from "./components/TemplateGallery";
import Studio from "./components/Studio";
import AdRepository from "./components/AdRepository";
import Pricing from "./components/Pricing";
import Toast from "./components/Toast";
import AuthModal from "./components/AuthModal";
import AdminDashboard from "./components/AdminDashboard";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { INITIAL_REPOSITORY } from "./data/mockData";
import { apiFetch } from "./api";
import TrendingVotes from "./components/TrendingVotes";
import UploadPanel from "./components/UploadPanel";
import "./App.css";

const STORAGE_KEYS = {
  REPOSITORY: "admaya_ad_repository",
};

function RootSite() {
  const [templates, setTemplates] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState("");
  const [toast, setToast] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  // User Authentication State
  const [user, setUser] = useState(null);

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

  const loadTemplates = useCallback(() => {
    let mounted = true;
    setTemplatesLoading(true);
    setTemplatesError("");
    apiFetch("/api/templates")
      .then(({ templates: published }) => {
        if (!mounted) return;
        const mapped = (published || []).map((template) => {
          const script = template.variables?.find((variable) => variable.key === "script");
          const environment = template.variables?.find((variable) => variable.key === "environment");
          const camera = template.variables?.find((variable) => variable.key === "camera");
          const pacing = template.variables?.find((variable) => variable.key === "pacing");
          return {
            ...template,
            cat: template.category,
            image: template.image || "/samples/unbox.jpg",
            c1: template.colorFrom,
            c2: template.colorTo,
            dur: `${template.durationSeconds}s`,
            price: template.priceInr,
            script: script?.defaultValue || "",
            env: environment?.defaultValue || "Template-defined environment",
            cam: camera?.defaultValue || "Template-defined camera",
            pace: pacing?.defaultValue || "Template-defined pacing",
            variables: template.variables || [],
          };
        });
        setTemplates(mapped);
        setActiveId((current) => mapped.some((template) => template.id === current) ? current : mapped[0]?.id || null);
      })
      .catch((error) => { if (mounted) setTemplatesError(error.message || "Unable to load templates."); })
      .finally(() => { if (mounted) setTemplatesLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => loadTemplates(), [loadTemplates]);
  useEffect(() => {
    const refresh = () => loadTemplates();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [loadTemplates]);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }
      const identity = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Customer",
        email: firebaseUser.email || "",
        credits: 0,
        avatar: firebaseUser.photoURL,
      };
      setUser(identity);
      apiFetch("/api/auth/profile").then(({ user: profile }) => {
        setUser((current) => current ? { ...current, credits: profile.creditBalance } : current);
      }).catch(() => {});
      apiFetch("/api/my-ads").then(({ assets }) => {
        if (Array.isArray(assets) && assets.length) setRepository(assets);
      }).catch(() => {});
    });
  }, []);

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
    if (auth) signOut(auth).then(() => showToast("Signed out successfully."));
  };

  const handleAddGeneratedAd = (newAd) => {
    setRepository((prev) => [newAd, ...prev]);
    setUser((prev) => prev ? { ...prev, credits: Math.max(0, prev.credits - Number(newAd.price || 0)) } : prev);
  };

  const handleDeleteFromRepo = (id) => {
    setRepository((prev) => prev.filter((item) => item.id !== id));
    if (user) apiFetch(`/api/my-ads/${id}`, { method: "DELETE" }).catch(() => {});
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

        {templatesLoading && <div className="wrap"><p className="section-desc">Loading templates from the backend…</p></div>}
        {templatesError && <div className="wrap"><p className="section-desc">{templatesError}</p></div>}
        {!templatesLoading && !templatesError && templates.length === 0 && <div className="wrap"><p className="section-desc">No published templates are available yet.</p></div>}
        {templates.length > 0 && <>
          <TemplateGallery templates={templates} activeId={activeId} onSelect={chooseTemplate} />
          <Studio
            key={activeId}
            template={templates.find((t) => t.id === activeId) || templates[0]}
            user={user}
            onRequireAuth={() => setAuthModalOpen(true)}
            onAddGeneratedAd={handleAddGeneratedAd}
            showToast={showToast}
            scrollTo={scrollTo}
          />
        </>}

        <UploadPanel user={user} onRequireAuth={() => setAuthModalOpen(true)} showToast={showToast} />
        <TrendingVotes user={user} onRequireAuth={() => setAuthModalOpen(true)} showToast={showToast} />

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

export default function App() {
  return window.location.pathname.startsWith("/admin") ? <AdminDashboard /> : <RootSite />;
}
