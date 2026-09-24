# RAGGauge web UI

React, TypeScript, Vite, and Tailwind UI for the local RAGGauge control plane.

The development server listens on `http://127.0.0.1:8501` and proxies `/api` to
the FastAPI service at `http://127.0.0.1:8000`. Authentication uses the API's
database-backed bearer sessions. No provider credentials are stored in the browser.

```powershell
npm install
npm run lint
npm run build
npm run dev
```

Set `VITE_API_BASE` only when the API is exposed through a different same-origin
gateway. For the local application, the default `/api` proxy is authoritative.
