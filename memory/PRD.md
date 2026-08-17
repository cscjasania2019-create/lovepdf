# PDFPro Studio (LOVEPDF) — PRD

## Original Problem Statement
ilovepdf-style PDF tools website (repo: sanjusaharan10704-svg/LOVEPDF). Bug fix (PDF→Word on scanned PDFs), phir new features (Sign PDF drag-drop editor, Batch processing, Image tools, Name/DOB photo tool), aur `lovepdf.co.in` pe live deploy (Railway/Render Docker + MongoDB Atlas).

## User Choices
- Phase scope: SIRF bug fix pehle, baaki features baad me
- Background remover (future): rembg / remove.bg
- Deployment: Emergent preview pe ready + Railway/Render + DNS step-by-step guide (user khud karega)
- Light mode default (explicit requirement)

## Architecture
- Frontend: React (CRA), pdf-lib + pdfjs-dist@4.4.168 (client-side tools), Tailwind + shadcn
- Backend: FastAPI (/api/pdf/* router in pdf_tools.py), LibreOffice, Ghostscript, Tesseract, Poppler, pikepdf, ocrmypdf, pdf2docx, pdfplumber
- DB: MongoDB (status checks only for now)
- System deps recorded in /app/.emergent/system_deps.txt (libreoffice, ghostscript, tesseract-ocr, poppler-utils)

## Implemented (June 2026)
- Repo cloned from GitHub into this environment (backend + frontend code)
- All Python/Node deps installed; pdfjs-dist pinned to 4.4.168 (node 20 compatible)
- **BUG FIX (root cause):** pdf2docx scanned/image-only PDFs pe text extract nahi karta tha
  - `_has_text_layer()` (pdfplumber) detects missing text layer
  - `_scanned_pdf_to_docx()` runs ocrmypdf (sidecar) → builds editable docx via python-docx
  - Same OCR fallback in pdf-to-excel
- Default theme changed dark → light (ThemeContext.jsx)
- Testing agent verified E2E: real UI upload for text + scanned PDFs → valid docx with correct text; merge, protect, repair, health all pass (backend 6/6, frontend 100% critical)
- Regression suite: /app/backend/tests/test_pdf_tools.py (pytest)

## Known / Notes
- Landing stats/reviews are MOCK (sample data) — user aware
- qpdf not installed (not needed by current tools)
- No file-size limits on uploads (noted, not MVP-blocking)
- Some tools marked "soon" badge if not ready && no server config; all 26 slugs routable

## Backlog (priority order)
- P0: Sign PDF feature (draw/upload signature, drag-drop place/resize on page, backend stamp, download) — SignPage.jsx exists, verify/complete
- P0: Batch processing (multi-file upload → same tool on all → zip download)
- P1: File preview before processing (all tools)
- P1: Image tools: Image Compressor, Image Cropper, Background Remover (rembg/remove.bg — key needed for remove.bg)
- P1: Name/DOB photo text tool (text position, font, color, download)
- P2: Deployment guide — Railway/Render Docker image, MongoDB Atlas, lovepdf.co.in DNS (A/CNAME + api subdomain), SSL
- P2: Replace mock stats/reviews or label as "sample"
