from datetime import datetime
from enum import Enum as PythonEnum
from typing import Any, Dict, Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON, String

from .activity_log import ActivityLog, ActivityType
from .restaurant import (
    MenuItemStatus,
    EventStatus,
    CareerStatus,
    PromotionType,
    CafeSettings,
    CafePageSettings,
    VR360Scene,
    CafeBranch,
    CafeBranchTranslation,
    CafeBranchMedia,
    CafeMenuCategory,
    CafeMenuCategoryTranslation,
    CafeMenuItem,
    CafeMenuItemTranslation,
    CafeMenuItemMedia,
    CafeEvent,
    CafeEventTranslation,
    CafeEventMedia,
    CafeCareer,
    CafeCareerTranslation,
    CafeCareerMedia,
    CafePromotion,
    CafePromotionTranslation,
    CafePromotionMedia,
    CafeAchievement,
    CafeAchievementTranslation,
    CafeAchievementMedia,
    CafeSpace,
    CafeSpaceTranslation,
    CafeSpaceMedia,
    CafeService,
    CafeServiceTranslation,
    CafeServiceMedia,
    CafeContentSection,
    CafeContentSectionTranslation,
    RestaurantSettings,
    RestaurantPageSettings,
    VR360Scene as RestaurantVR360Scene,
    RestaurantBranch,
    RestaurantBranchTranslation,
    RestaurantBranchMedia,
    RestaurantMenuCategory,
    RestaurantMenuCategoryTranslation,
    RestaurantMenuItem,
    RestaurantMenuItemTranslation,
    RestaurantMenuItemMedia,
    RestaurantEvent,
    RestaurantEventTranslation,
    RestaurantEventMedia,
    RestaurantCareer,
    RestaurantCareerTranslation,
    RestaurantCareerMedia,
    RestaurantPromotion,
    RestaurantPromotionTranslation,
    RestaurantPromotionMedia,
    RestaurantAchievement,
    RestaurantAchievementTranslation,
    RestaurantAchievementMedia,
    RestaurantSpace,
    RestaurantSpaceTranslation,
    RestaurantSpaceMedia,
    RestaurantService,
    RestaurantServiceTranslation,
    RestaurantServiceMedia,
    RestaurantContentSection,
    RestaurantContentSectionTranslation,
)


class UserRole(str, PythonEnum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    EDITOR = "EDITOR"
    VIEWER = "VIEWER"


class PostStatus(str, PythonEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class EventType(str, PythonEnum):
    PAGE_VIEW = "page_view"
    CLICK = "click"
    SHARE = "share"


class DeviceType(str, PythonEnum):
    DESKTOP = "desktop"
    TABLET = "tablet"
    MOBILE = "mobile"


class MediaKind(str, PythonEnum):
    IMAGE = "image"
    VIDEO = "video"
    FILE = "file"
    ICON = "icon"


class MediaSource(str, PythonEnum):
    RESTAURANT = "restaurant"
    GENERAL = "general"


class Plan(SQLModel, table=True):
    __tablename__ = "plans"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(max_length=50, unique=True)
    name: str = Field(max_length=120)
    features_json: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Tenant(SQLModel, table=True):
    __tablename__ = "tenants"

    id: Optional[int] = Field(default=None, primary_key=True)
    plan_id: Optional[int] = Field(default=None, foreign_key="plans.id")
    name: str = Field(max_length=200)
    code: str = Field(max_length=80, unique=True)
    default_locale: str = Field(default="vi", max_length=10)
    fallback_locale: str = Field(default="en", max_length=10)
    settings_json: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)


class Locale(SQLModel, table=True):
    __tablename__ = "locales"

    code: str = Field(primary_key=True, max_length=10)
    name: str = Field(max_length=100)
    native_name: str = Field(max_length=100)


class AdminUser(SQLModel, table=True):
    __tablename__ = "admin_users"

    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.id")
    email: str = Field(max_length=190)
    password_hash: str = Field(max_length=255)
    full_name: str = Field(max_length=180)
    role: UserRole = Field(default=UserRole.EDITOR)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)


class MediaFile(SQLModel, table=True):
    __tablename__ = "media_files"

    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id")
    uploader_id: Optional[int] = Field(default=None, foreign_key="admin_users.id")
    kind: str
    mime_type: Optional[str] = Field(default=None, max_length=120)
    file_key: str = Field(max_length=255)
    original_filename: Optional[str] = Field(default=None, max_length=255)
    width: Optional[int] = None
    height: Optional[int] = None
    size_bytes: Optional[int] = None
    alt_text: Optional[str] = Field(default=None, max_length=300)
    source: Optional[str] = Field(default="restaurant", sa_column=Column(String(20)))
    entity_type: Optional[str] = Field(default=None, sa_column=Column(String(50)))
    entity_id: Optional[int] = Field(default=None)
    folder: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AdminUserCreate(SQLModel):
    email: str
    password: str
    full_name: str
    role: UserRole = UserRole.EDITOR
    tenant_id: int


class AdminUserUpdate(SQLModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
