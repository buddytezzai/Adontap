import { CREDIT_PACKS } from "../data/mockData";
import { FiCheck, FiZap, FiHelpCircle } from "react-icons/fi";

export default function Pricing({ showToast, onOpenAuth, user }) {
  const handleAction = (pack) => {
    if (!user) {
      showToast("Please sign in first to purchase credit packs");
      onOpenAuth();
      return;
    }
    showToast(`Selected ${pack.tier} Pack (${pack.amount}) · Processing payment sandbox`);
  };

  return (
    <section id="pricing" className="pricing-section">
      <div className="wrap">
        <div className="section-head text-center">
          <div>
            <div className="eyebrow">Predictable Pricing</div>
            <h2>Credit Packs · Pay Per Video Ad, No Subscriptions</h2>
            <p className="section-desc">
              Buy credits as you need them. Video renders include 24-hour repository storage, instant downloads, and direct Meta Ads integration.
            </p>
          </div>
        </div>

        <div className="price-grid">
          {CREDIT_PACKS.map((p) => (
            <article
              className={`price-card ${p.featured ? "featured" : ""}`}
              key={p.tier}
            >
              {p.featured && (
                <div className="price-popular-tag">
                  <FiZap className="tag-icon" /> Most Popular
                </div>
              )}
              <div className="price-tier">{p.tier}</div>
              <div className="price-amount-box">
                <span className="price-amount">{p.amount}</span>
                {p.amount !== "Custom" && <span className="price-period">/ one-time</span>}
              </div>
              <div className="price-note">{p.note}</div>
              
              <div className="price-divider" />

              <ul className="price-list">
                {p.features.map((f) => (
                  <li key={f}>
                    <FiCheck className="check-icon" /> {f}
                  </li>
                ))}
                <li>
                  <FiCheck className="check-icon" /> 24h repository caching
                </li>
              </ul>

              <button
                className={p.featured ? "cta-btn price-btn" : "ghost-btn price-btn"}
                onClick={() => handleAction(p)}
              >
                {p.action}
              </button>
            </article>
          ))}
        </div>

        <div className="pricing-faq-banner">
          <FiHelpCircle className="faq-icon" />
          <div className="faq-text">
            <b>Need custom API integrations or enterprise volume?</b>
            <span>Our engineering team can deploy dedicated rendering clusters with custom 48h/72h repository retention SLAs.</span>
          </div>
          <button
            className="ghost-btn sm"
            onClick={() => showToast("Contact sales: enterprise@admaya.ai")}
          >
            Contact Enterprise
          </button>
        </div>
      </div>
    </section>
  );
}
