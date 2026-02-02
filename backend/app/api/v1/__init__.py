from fastapi import APIRouter

from app.api.v1 import auth, email, site, submission, sync, diagnostics, contact

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(email.router, prefix="/emails", tags=["email"])
api_router.include_router(site.router, prefix="/sites", tags=["site"])
api_router.include_router(submission.router, prefix="/submissions", tags=["submission"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(diagnostics.router, prefix="/diagnostics", tags=["diagnostics"])
api_router.include_router(contact.router, prefix="/sites", tags=["contact"])