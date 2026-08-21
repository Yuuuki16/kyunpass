from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="kyunpass API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/investigate")
async def investigate(file: UploadFile) -> dict[str, str]:
    if not (file.filename or "").lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="txtファイルのみアップロードできます")

    return {"status": "received", "filename": file.filename or ""}
