from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Anthropic
    ANTHROPIC_API_KEY: str

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ed_triage"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"

    # App
    SECRET_KEY: str = "change_me"
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # AI
    TRIAGE_MODEL: str = "claude-sonnet-4-6"
    FOLLOWUP_MODEL: str = "claude-sonnet-4-6"
    DISCHARGE_MODEL: str = "claude-sonnet-4-6"

    # Langfuse
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_BASE_URL: str = "https://us.cloud.langfuse.com"


settings = Settings()
