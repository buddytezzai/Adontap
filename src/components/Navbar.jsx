import { FiUser, FiLogOut, FiFolder, FiZap } from "react-icons/fi";

export default function Navbar({
  scrollTo,
  user,
  onOpenAuth,
  onLogout,
  repoCount = 0,
}) {
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        {/* Brand */}
        <div className="brand" onClick={() => scrollTo("hero")} style={{ cursor: "pointer" }}>
          <div className="brand-mark">A</div>
          <div className="brand-name">
            AdMaya<em>.ai</em>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="topnav">
          <button onClick={() => scrollTo("templates")}>Templates</button>
          <button onClick={() => scrollTo("studio")}>AI Studio</button>
          <button onClick={() => scrollTo("repository")} className="nav-repo-btn">
            <FiFolder className="nav-icon" />
            Ad Repository
            {repoCount > 0 && <span className="nav-badge">{repoCount}</span>}
          </button>
          <button onClick={() => scrollTo("pricing")}>Pricing</button>
        </nav>

        {/* User Account / Auth Actions */}
        <div className="topbar-actions">
          {user ? (
            <div className="user-profile-menu">
              <div className="user-credits-pill">
                <FiZap className="credits-icon" />
                <span>{user.credits} Cr</span>
              </div>
              <div className="user-info-pill" title={`Logged in as ${user.email}`}>
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="user-avatar-img"
                />
                <span className="user-display-name">{user.name}</span>
              </div>
              <button
                className="user-logout-btn"
                onClick={onLogout}
                title="Log out"
              >
                <FiLogOut />
              </button>
            </div>
          ) : (
            <button className="ghost-btn login-nav-btn" onClick={onOpenAuth}>
              <FiUser className="nav-icon" /> Sign In
            </button>
          )}

          <button className="cta-btn browse-btn" onClick={() => scrollTo("templates")}>
            Create AI Ad
          </button>
        </div>
      </div>
    </header>
  );
}
