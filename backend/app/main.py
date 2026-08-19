from fastapi import FastAPI

app = FastAPI(title="kyunpass API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
