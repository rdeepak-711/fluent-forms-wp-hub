from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    PROJECT_NAME: str
    PROJECT_DESCRIPTION: str
    PROJECT_VERSION: str
    API_V1_STR: str
    ADMIN_EMAIL: str = "admin@hub.local"
    ADMIN_PASSWORD: str = "admin123!"
    SECRET_KEY: str
    ENCRYPTION_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    REDIS_URL: str

    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    SMTP_TLS: bool = True
    SMTP_PORT: int
    SMTP_HOST: str
    SMTP_EMAIL: str
    SMTP_PASSWORD: str
    EMAILS_FROM_EMAIL: str
    EMAILS_FROM_NAME: str

    WP_DEFAULT_API_KEY: str = ""
    WP_DEFAULT_API_SECRET: str = ""

    CRYPT_ALGORITHM: str

    CORS_ORIGINS: str

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
