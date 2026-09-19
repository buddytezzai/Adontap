export default function Navbar({ scrollTo }) {
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div className="brand-name">
            AdMaya<em>.ai</em>
          </div>
        </div>
        <nav className="topnav">
          <button onClick={() => scrollTo("templates")}>Templates</button>
          <button onClick={() => scrollTo("studio")}>Studio</button>
          <button onClick={() => scrollTo("pricing")}>Pricing</button>
        </nav>
        <button className="cta-btn" onClick={() => scrollTo("templates")}>
          Browse templates
        </button>
      </div>
    </header>
  );
}
