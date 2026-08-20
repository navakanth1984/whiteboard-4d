## 2026-08-20 - Path Traversal Vulnerability in Static File Server
**Vulnerability:** In `server.cjs`, `filePath` was constructed directly via `path.join(__dirname, normalizedPath)` using raw, unvalidated `req.url` path segments. This permitted path traversal attacks (e.g. `GET /../../../../etc/passwd`) to read arbitrary files outside `__dirname`.
**Learning:** `path.join` does not prevent path traversal if relative navigation sequences (`..`) resolve outside the intended root directory when joined to `__dirname`.
**Prevention:** Always decode URI components safely, normalize requested paths relative to the root directory, and enforce root directory jailing via `path.resolve` and strict prefix validation (`filePath.startsWith(safeBase + path.sep)` or `filePath === safeBase`).
