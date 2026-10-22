# Deploy (no backend needed)

DDE PDF Toolkit is a **static website**: all extracting and merging happens in the user's browser and PDFs are never uploaded. Static hosting is enough, and Netlify works well.

## Option A: drag and drop (no Git)

1. `npm install`, then `npm run build`. This creates a `dist/` folder.
2. In Netlify choose *Add new site*, *Deploy manually* (or open https://app.netlify.com/drop).
3. Drag the `dist` folder onto the page.

To update later, run `npm run build` again and drag the new `dist` folder onto *Deploys*.

## Option B: GitHub and Netlify (auto deploys)

1. Push this project to a GitHub repository (`node_modules`, `dist` and `public/pdfjs` are in `.gitignore`).
2. In Netlify choose *Add new site*, *Import an existing project*, pick the repository.
3. `netlify.toml` already sets the build command (`npm run build`) and publish directory (`dist`). Click *Deploy*.

`npm run build` copies the PDF.js data files into `public/pdfjs` first, so nothing extra is needed.

## Custom domain

*Domain management*, *Add a domain*, then follow Netlify's DNS steps and enable HTTPS.

## Other hosts

Cloudflare Pages, Vercel and GitHub Pages work with the same two settings (build command `npm run build`, output `dist`). GitHub Pages also needs `base: "/<repo-name>/"` in `vite.config.js`.

If this is used for company work, confirm that hosting the tool on a third-party site is acceptable to your organisation.
