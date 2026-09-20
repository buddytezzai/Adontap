import Link from "next/link";

export default function NotFound() {
  return (
    <div className="notfound">
      <div className="brand-mark" style={{ width: 40, height: 40 }}>A</div>
      <h1>That template isn&apos;t available</h1>
      <p>It may have been unpublished, or the link is wrong.</p>
      <Link className="cta-btn" href="/#templates">Browse templates</Link>
    </div>
  );
}
