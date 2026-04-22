from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from langfuse import Langfuse, get_client

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.routers.admin import router as admin_router
from app.routers.auth import router as auth_router
from app.routers.patients import router as patients_router
from app.routers.triage import router as triage_router

_SKIP_TRACE_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

_langfuse_enabled = bool(settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY)

Langfuse(
    public_key=settings.LANGFUSE_PUBLIC_KEY or None,
    secret_key=settings.LANGFUSE_SECRET_KEY or None,
    host=settings.LANGFUSE_BASE_URL,
    tracing_enabled=_langfuse_enabled,
    environment="coding-challenge-langfuse",
    release="1.0.0",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from scripts.seed import seed
    await seed()
    yield
    get_client().flush()


app = FastAPI(title="ED Triage Support API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def langfuse_trace_middleware(request: Request, call_next):
    if request.url.path in _SKIP_TRACE_PATHS or not _langfuse_enabled:
        return await call_next(request)
    lf = get_client()
    with lf.start_as_current_observation(
        name=f"{request.method} {request.url.path}",
        as_type="span",
        metadata={"method": request.method, "path": request.url.path},
    ):
        response = await call_next(request)
        lf.update_current_span(metadata={"status_code": response.status_code})
    return response


# All routers mounted under /api so CloudFront can route /api/* to the ALB
# and the SPA root stays at S3 with no path conflicts.
app.include_router(auth_router, prefix="/api")
app.include_router(patients_router, prefix="/api")
app.include_router(triage_router, prefix="/api")
app.include_router(admin_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
