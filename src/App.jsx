import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import TemplateGallery from "./components/TemplateGallery";
import Studio from "./components/Studio";
import Pricing from "./components/Pricing";
import Toast from "./components/Toast";
import { TEMPLATES } from "./data/mockData";
import "./App.css";
export default function App() {
  const [activeId, setActiveId] = useState(TEMPLATES[0].id),
    [toast, setToast] = useState("");
  const timer = useRef();
  useEffect(() => {
    document.title = "AdMaya.ai";
    return () => clearTimeout(timer.current);
  }, []);
  const scrollTo = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2600);
  }, []);
  const choose = (id) => {
    setActiveId(id);
    setTimeout(() => scrollTo("studio"), 0);
  };
  return (
    <>
      <Navbar scrollTo={scrollTo} />
      <main>
        <Hero scrollTo={scrollTo} />
        <TemplateGallery
          templates={TEMPLATES}
          activeId={activeId}
          onSelect={choose}
        />
        <Studio
          key={activeId}
          template={TEMPLATES.find((t) => t.id === activeId)}
          showToast={showToast}
        />
        <Pricing showToast={showToast} />
      </main>
      <footer>
        <div className="wrap foot-row">
          <div>
            AdMaya.ai · a product concept prototype, not a live service.
          </div>
          <div>माया · an illusion you script yourself</div>
        </div>
      </footer>
      <Toast message={toast} />
    </>
  );
}
