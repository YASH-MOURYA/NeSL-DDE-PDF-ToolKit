import { useEffect } from "react";
import { site } from "../site.js";
import Footer from "../components/Footer.jsx";

export default function LegalPage({ title, children }) {
  useEffect(() => {
    document.title = `${title} | ${site.name}`;
  }, [title]);

  return (
    <div className="page legal">
      <a className="back-link" href="/">Back to {site.name}</a>
      <h1>{title}</h1>
      <p className="meta">Last updated: {site.lastUpdated}</p>
      {children}
      <Footer />
    </div>
  );
}

export function Contact() {
  return (
    <>
      <h2>Contact</h2>
      <p>
        {site.contactEmail ? (
          <>Questions about this page: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.</>
        ) : (
          "Contact details are not published yet."
        )}
      </p>
    </>
  );
}
