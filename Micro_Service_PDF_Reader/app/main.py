from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .monatis_mapper import build_monatis_import
from .parser import CaisseEpargneParser

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(
    title="Caisse d'Épargne PDF Importer",
    description="Mini app de test pour extraire des opérations depuis des relevés PDF Caisse d'Épargne, sans IA.",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def home() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze_pdf(file: UploadFile = File(...)) -> dict[str, Any]:
    filename = file.filename or "statement.pdf"
    suffix = Path(filename).suffix.lower()

    if suffix != ".pdf":
        raise HTTPException(status_code=400, detail="Merci d'envoyer un fichier PDF.")

    parser = CaisseEpargneParser()

    with tempfile.TemporaryDirectory() as temp_dir:
        pdf_path = Path(temp_dir) / "uploaded.pdf"
        with pdf_path.open("wb") as out:
            shutil.copyfileobj(file.file, out)

        try:
            result = parser.parse(pdf_path)
        except Exception as exc:  # noqa: BLE001 - app de diagnostic, on retourne l'erreur proprement.
            raise HTTPException(
                status_code=500,
                detail=f"Erreur pendant l'analyse du PDF : {exc}",
            ) from exc

    result["filename"] = filename
    result.update(build_monatis_import(result.get("transactions", [])))
    return result
