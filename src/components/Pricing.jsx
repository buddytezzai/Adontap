import { CREDIT_PACKS } from "../data/mockData";
export default function Pricing({ showToast }) {
  return (
    <section id="pricing">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">Pricing</div>
            <h2>Credit packs · pay per video, not per month</h2>
          </div>
        </div>
        <div className="price-grid">
          {CREDIT_PACKS.map((p) => (
            <article
              className={`price-card${p.featured ? " featured" : ""}`}
              key={p.tier}
            >
              <div className="price-tier">{p.tier}</div>
              <div className="price-amount">{p.amount}</div>
              <div className="price-note">{p.note}</div>
              <ul className="price-list">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                className={p.featured ? "cta-btn" : "ghost-btn"}
                onClick={() =>
                  showToast("This is a prototype · no live checkout yet")
                }
              >
                {p.action}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
