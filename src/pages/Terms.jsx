import LegalPage, { Contact } from "./LegalPage.jsx";
import { site } from "../site.js";

export default function Terms() {
  return (
    <LegalPage title="Terms and Conditions">
      <p>By using {site.name} you agree to these terms. If you do not agree, please do not use the site.</p>

      <h2>What the service does</h2>
      <p>
        The site reads the transaction JSON that you add, finds the Base64 encoded PDF documents in it, lets you
        preview them and lets you download the ones you select, either as individual PDF files or as one ZIP
        file. It can also place eStamp PDFs that you choose before the documents they belong to, print the
        certificate numbers you enter at the top of those documents, and produce merged A4 PDFs. It is built for
        NeSL transaction JSON and may not work with other formats.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Only process documents that you have the right to access and handle.</li>
        <li>Check the extracted and merged files before relying on them, including the page order and the certificate numbers you entered. File names are built from the DDE transaction ID you enter.</li>
        <li>Do not use the site to break the law or to infringe the rights of others.</li>
      </ul>

      <h2>No warranty</h2>
      <p>
        The site is provided as is and as available, without warranties of any kind, express or implied. We do not
        guarantee that it will be uninterrupted, error free, or that every document in your JSON will be found,
        decoded or merged correctly.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent allowed by law, {site.operator || "the operator of this site"} is not liable for any loss or
        damage arising from your use of the site, including loss caused by missing, incomplete or incorrect
        extracted or merged documents.
      </p>

      <h2>Privacy</h2>
      <p>
        How data is handled is described in the <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated. The date at the top of this page shows the latest version. Continued use of the
        site after a change means you accept the updated terms.
      </p>

      <Contact />
    </LegalPage>
  );
}
