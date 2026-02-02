import logging
import re
from urllib.parse import urlparse, urlunparse

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=30,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


_SAFE_DB_NAME = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def init_db():
    db_name = settings.DB_NAME

    # C5 fix: Validate db_name to prevent SQL injection via environment variable
    if not _SAFE_DB_NAME.match(db_name):
        raise ValueError(
            f"Invalid database name: '{db_name}'. "
            "Must start with a letter or underscore and contain only alphanumeric characters."
        )

    parsed = urlparse(settings.DATABASE_URL)
    server_url = urlunparse(parsed._replace(path=""))
    temp_engine = create_engine(server_url)
    try:
        with temp_engine.connect() as connection:
            connection.execute(text(f"CREATE DATABASE IF NOT EXISTS {db_name}"))
            logger.info("Database '%s' created or already exists.", db_name)
    finally:
        temp_engine.dispose()
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    logger.info("Tables created or verified.")
    
    # Manual migration for new columns (Task 6.7 response)
    # We do this to ensure existing installs get the new columns without Alembic
    _ensure_columns_exist()

def _ensure_columns_exist():
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    
    # 1. Update form_submissions table
    if "form_submissions" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("form_submissions")]
        with engine.connect() as conn:
            if "submitter_name" not in columns:
                conn.execute(text("ALTER TABLE form_submissions ADD COLUMN submitter_name VARCHAR(255)"))
                logger.info("Added submitter_name to form_submissions")
            if "submitter_email" not in columns:
                conn.execute(text("ALTER TABLE form_submissions ADD COLUMN submitter_email VARCHAR(255)"))
                conn.execute(text("CREATE INDEX ix_form_submissions_submitter_email ON form_submissions (submitter_email)"))
                logger.info("Added submitter_email to form_submissions")
            if "subject" not in columns:
                conn.execute(text("ALTER TABLE form_submissions ADD COLUMN subject VARCHAR(255)"))
                logger.info("Added subject to form_submissions")
            if "message" not in columns:
                conn.execute(text("ALTER TABLE form_submissions ADD COLUMN message TEXT"))
                logger.info("Added message to form_submissions")
            if "api_key" in columns:
                conn.execute(text("ALTER TABLE form_submissions RENAME COLUMN api_key TO username"))
                logger.info("Renamed api_key to username from form_submissions")
            if "api_secret" in columns: # C5 fix: Rename api_secret to application_password
                conn.execute(text("ALTER TABLE form_submissions RENAME COLUMN api_secret TO application_password"))
                logger.info("Renamed api_secret to application_password from form_submissions")

            conn.commit()

    # 2. Update email_threads table
    if "email_threads" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("email_threads")]
        with engine.connect() as conn:
            if "to_email" not in columns:
                conn.execute(text("ALTER TABLE email_threads ADD COLUMN to_email VARCHAR(255)"))
                logger.info("Added to_email to email_threads")
            if "from_email" not in columns:
                conn.execute(text("ALTER TABLE email_threads ADD COLUMN from_email VARCHAR(255)"))
                logger.info("Added from_email to email_threads")
            if "status" not in columns:
                conn.execute(text("ALTER TABLE email_threads ADD COLUMN status VARCHAR(20)"))
                logger.info("Added status to email_threads")
            conn.commit()
