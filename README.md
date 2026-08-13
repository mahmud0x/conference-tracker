# Top CS Conference Tracker

A compact static conference tracker for **CORE A\***, **A**, and **B** venues in:

- AI / Machine Learning
- Security
- Software Engineering

The site is designed for GitHub Pages and requires no backend.

## Data source

Upstream JSON:

`https://honestcsrankings.org/data/conferences.json`

The webpage reads a local snapshot at `data/conferences.json`. The included GitHub Actions workflow refreshes that file from Honest CS Rankings automatically, which avoids browser CORS issues and keeps the site deployable as a purely static page.

## Publish with GitHub Pages

1. Create a new GitHub repository.
2. Upload all files from this project, including `.github`, `.nojekyll`, and `data`.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your default branch (usually `main`) and `/ (root)`.
6. Save.

Your site will be available at:

`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

## Local preview

Because the page loads a JSON file with `fetch()`, serve it through a local HTTP server instead of opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Files

- `index.html` — page structure
- `styles.css` — responsive UI
- `app.js` — filtering, sorting, rendering
- `data/conferences.json` — local conference snapshot
- `.github/workflows/update-data.yml` — automatic upstream refresh
