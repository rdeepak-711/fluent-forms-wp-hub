import logging
import smtplib
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app import models, schemas
from app.core.config import settings
from app.services.email import send_email

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=schemas.EmailResponse, status_code=201)
def create_email(
    email_in: schemas.EmailCreate,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    # 1. Look up the submission to get the recipient email
    submission = (
        db.query(models.Submission)
        .filter(models.Submission.id == email_in.submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if not submission.submitter_email:
        raise HTTPException(
            status_code=422,
            detail="Submission has no submitter email address",
        )

    # 2. Resolve subject (auto-prefix with "Re:" if not provided)
    subject = email_in.subject
    if not subject:
        original_subject = submission.subject or "Your submission"
        subject = f"Re: {original_subject}"

    # 3. Build the email record
    to_email = submission.submitter_email
    from_email = settings.EMAILS_FROM_EMAIL

    email = models.EmailThread(
        submission_id=email_in.submission_id,
        user_id=current_user.id,
        direction=email_in.direction,
        subject=subject,
        body=email_in.body,
        message_id=str(uuid.uuid4()),
        to_email=to_email,
        from_email=from_email,
        status=None,
    )

    # 4. For outbound, actually send the email via SMTP
    if email_in.direction == "outbound":
        try:
            smtp_message_id = send_email(
                to_email=to_email,
                subject=subject,
                body=email_in.body,
            )
            email.status = "sent"
            if smtp_message_id:
                email.message_id = smtp_message_id
        except smtplib.SMTPException:
            logger.exception(
                "SMTP error sending email to %s for submission %s",
                to_email, email_in.submission_id,
            )
            email.status = "failed"
        except Exception:
            logger.exception(
                "Unexpected error sending email to %s for submission %s",
                to_email, email_in.submission_id,
            )
            email.status = "failed"

    # 5. Always persist to DB (even on failure, so there's a record)
    try:
        db.add(email)
        db.commit()
        db.refresh(email)
    except Exception:
        db.rollback()
        logger.exception("Failed to save email record")
        raise HTTPException(status_code=500, detail="Failed to save email record")

    # 6. If sending failed, inform the caller
    if email.status == "failed":
        raise HTTPException(
            status_code=502,
            detail="Email recorded but delivery failed. Check SMTP configuration.",
        )

    logger.info(
        "Email %s (status=%s) created for submission %s, to=%s",
        email.id, email.status, email.submission_id, to_email,
    )
    return email


@router.get("/", response_model=List[schemas.EmailResponse])
def list_emails(
    submission_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    emails = (
        db.query(models.EmailThread)
        .filter_by(submission_id=submission_id)
        .order_by(models.EmailThread.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    logger.info(f"Fetched {len(emails)} emails for submission {submission_id}")
    return emails
