from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.sync_tasks"],
)

celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    result_expires=3600,
    task_soft_time_limit=120,
    task_time_limit=180,
)

celery_app.conf.beat_schedule = {
    "sync-all-sites-every-2-hours": {
        "task": "app.tasks.sync_tasks.sync_all_sites_task",
        "schedule": crontab(minute=0, hour="*/2"),
    },
}
