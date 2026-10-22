import { site } from "../site.js";

export default function Footer() {
  return (
    <footer className="footer">
      <p>This site belongs to {site.operator} and does not belong to NeSL.</p>
      <p>Developed by {site.operator} for personal use.</p>
      <div className="footer-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms and Conditions</a>
        <a href={site.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        <a href={site.github} target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </footer>
  );
}
