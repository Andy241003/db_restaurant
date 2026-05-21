from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models import UserRole, PostStatus, EventType, DeviceType, MediaKind


# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class NewPassword(BaseModel):
    token: str
    new_password: str


# Base schemas with common fields
class TimestampResponse(BaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None


# Plan schemas
class PlanBase(BaseModel):
    code: str = Field(max_length=50)
    name: str = Field(max_length=120)
    features_json: Optional[Dict[str, Any]] = None


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    features_json: Optional[Dict[str, Any]] = None


class PlanResponse(PlanBase, TimestampResponse):
    id: int
    
    class Config:
        from_attributes = True


# Tenant schemas
class TenantBase(BaseModel):
    name: str = Field(max_length=200)
    code: str = Field(max_length=80)
    default_locale: str = Field(default="en", max_length=10)
    fallback_locale: str = Field(default="en", max_length=10)
    settings_json: Optional[Dict[str, Any]] = None
    is_active: bool = True


class TenantCreate(TenantBase):
    plan_id: Optional[int] = None


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    plan_id: Optional[int] = None
    default_locale: Optional[str] = Field(None, max_length=10)
    fallback_locale: Optional[str] = Field(None, max_length=10)
    settings_json: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class TenantResponse(TenantBase, TimestampResponse):
    id: int
    plan_id: Optional[int] = None
    
    class Config:
        from_attributes = True


# Locale schemas
class LocaleBase(BaseModel):
    code: str = Field(max_length=10)
    name: str = Field(max_length=100)
    native_name: str = Field(max_length=100)


class LocaleCreate(LocaleBase):
    pass


class LocaleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    native_name: Optional[str] = Field(None, max_length=100)


class LocaleResponse(LocaleBase):
    class Config:
        from_attributes = True


# AdminUser schemas
class AdminUserBase(BaseModel):
    email: str = Field(max_length=190)
    full_name: str = Field(max_length=180)
    role: UserRole = UserRole.EDITOR
    # service_access: Removed - restaurant-only system
    is_active: bool = True


class AdminUserCreate(AdminUserBase):
    password: str = Field(min_length=8)
    tenant_id: int
    # service_access: Removed - restaurant-only system


class AdminUserUpdate(BaseModel):
    email: Optional[str] = Field(None, max_length=190)
    full_name: Optional[str] = Field(None, max_length=180)
    role: Optional[UserRole] = None
    # service_access: Removed - restaurant-only system
    is_active: Optional[bool] = None


class AdminUserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class AdminUserResponse(AdminUserBase, TimestampResponse):
    id: int
    tenant_id: int
    
    class Config:
        from_attributes = True


# Property schemas
class PropertyBase(BaseModel):
    property_name: str = Field(max_length=255)
    code: str = Field(max_length=100)
    
    # Basic info
    slogan: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = Field(None, max_length=255)
    banner_images: Optional[List[str]] = None
    intro_video_url: Optional[str] = Field(None, max_length=255)
    vr360_url: Optional[str] = Field(None, max_length=255)
    
    # Contact & Location
    address: Optional[str] = Field(None, max_length=255)
    district: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    phone_number: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = Field(None, max_length=100)
    website_url: Optional[str] = Field(None, max_length=255)
    zalo_oa_id: Optional[str] = Field(None, max_length=50)
    facebook_url: Optional[str] = Field(None, max_length=255)
    youtube_url: Optional[str] = Field(None, max_length=255)
    tiktok_url: Optional[str] = Field(None, max_length=255)
    instagram_url: Optional[str] = Field(None, max_length=255)
    google_map_url: Optional[str] = Field(None, max_length=512)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Branding
    primary_color: Optional[str] = Field(None, max_length=255)  # Support CSS gradients
    secondary_color: Optional[str] = Field(None, max_length=255)
    
    # Legal
    copyright_text: Optional[str] = Field(None, max_length=255)
    terms_url: Optional[str] = Field(None, max_length=255)
    privacy_url: Optional[str] = Field(None, max_length=255)
    
    # Settings
    timezone: Optional[str] = Field(None, max_length=60)
    default_locale: str = Field(max_length=10)
    settings_json: Optional[Dict[str, Any]] = None
    is_active: bool = True


class PropertyCreate(PropertyBase):
    tenant_id: Optional[int] = None  # Will be set by endpoint


class PropertyUpdate(BaseModel):
    property_name: Optional[str] = Field(None, max_length=255)
    code: Optional[str] = Field(None, max_length=100)
    slogan: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = Field(None, max_length=255)
    banner_images: Optional[List[str]] = None
    intro_video_url: Optional[str] = Field(None, max_length=255)
    vr360_url: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=255)
    district: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    phone_number: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = Field(None, max_length=100)
    website_url: Optional[str] = Field(None, max_length=255)
    zalo_oa_id: Optional[str] = Field(None, max_length=50)
    facebook_url: Optional[str] = Field(None, max_length=255)
    youtube_url: Optional[str] = Field(None, max_length=255)
    tiktok_url: Optional[str] = Field(None, max_length=255)
    instagram_url: Optional[str] = Field(None, max_length=255)
    google_map_url: Optional[str] = Field(None, max_length=512)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    primary_color: Optional[str] = Field(None, max_length=255)  # Support CSS gradients
    secondary_color: Optional[str] = Field(None, max_length=255)
    copyright_text: Optional[str] = Field(None, max_length=255)
    terms_url: Optional[str] = Field(None, max_length=255)
    privacy_url: Optional[str] = Field(None, max_length=255)
    timezone: Optional[str] = Field(None, max_length=60)
    default_locale: Optional[str] = Field(None, max_length=10)
    settings_json: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class PropertyResponse(PropertyBase, TimestampResponse):
    id: int
    tenant_id: int

    class Config:
        from_attributes = True


# Property Translation schemas
class PropertyTranslationBase(BaseModel):
    locale: str = Field(max_length=10)
    property_name: Optional[str] = Field(None, max_length=255)
    slogan: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = Field(None, max_length=255)
    district: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    copyright_text: Optional[str] = Field(None, max_length=255)


class PropertyTranslationCreate(PropertyTranslationBase):
    property_id: Optional[int] = None  # Optional because it can come from URL path


class PropertyTranslationUpdate(BaseModel):
    property_name: Optional[str] = Field(None, max_length=255)
    slogan: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = Field(None, max_length=255)
    district: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    copyright_text: Optional[str] = Field(None, max_length=255)


class PropertyTranslationResponse(PropertyTranslationBase, TimestampResponse):
    id: int
    property_id: int

    class Config:
        from_attributes = True
