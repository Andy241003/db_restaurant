from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    media,
    plans,
    tenants,
    users,
    locales,
    activity_logs,
    activity_test,
    vr360,
)
from app.api.v1.restaurant import restaurant_router

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
api_router.include_router(plans.router, prefix="/plans", tags=["plans"], include_in_schema=False)
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"], include_in_schema=False)
api_router.include_router(users.router, prefix="/users", tags=["users"], include_in_schema=False)
api_router.include_router(locales.router, prefix="/locales", tags=["locales"], include_in_schema=False)
api_router.include_router(activity_logs.router, prefix="/activity-logs", tags=["activity-logs"], include_in_schema=False)
api_router.include_router(activity_test.router, prefix="/activity-test", tags=["activity-test"], include_in_schema=False)
api_router.include_router(vr360.router, prefix="/vr360", tags=["vr360"])
api_router.include_router(restaurant_router)
