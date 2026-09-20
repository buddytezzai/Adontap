export default function StubView() {
  return (
    <div className="view active" id="view-stub">
      <div className="topbar">
        <div>
          <h2>Coming soon</h2>
          <div className="sub">Not part of this prototype yet</div>
        </div>
      </div>
      <div className="content">
        <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--ink-faint)" }}>
          This section (orders/renders, credit wallets, provider keys) is scoped in the technical plan but not wired into this prototype — the template management flow is the focus here.
        </div>
      </div>
    </div>
  );
}
