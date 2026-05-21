"""
Restaurant Management System Models

Database models for restaurant management including:
- Settings and branding
- Branches
- Menu (categories and items)
- Events
- Careers
- Promotions
"""
from datetime import datetime, date
from typing import Optional, List
from enum import Enum
from sqlmodel import Field, SQLModel, JSON, Column, Relationship
from sqlalchemy import Index


# ==========================================
# Enums
# ==========================================

class MenuItemStatus(str, Enum):
    """Menu item availability status"""
    AVAILABLE = "available"
    SOLD_OUT = "sold_out"
    SEASONAL = "seasonal"
    DISCONTINUED = "discontinued"


class EventStatus(str, Enum):
    """Event status"""
    UPCOMING = "upcoming"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CareerStatus(str, Enum):
    """Career/job posting status"""
    OPEN = "open"
    CLOSED = "closed"
    ON_HOLD = "on_hold"


class PromotionType(str, Enum):
    """Promotion discount type"""
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    BUY_ONE_GET_ONE = "buy_one_get_one"
    GIFT = "gift"


# ==========================================
# Restaurant Settings
# ==========================================

class CafeSettings(SQLModel, table=True):
    """
    Restaurant general settings - branding, contact, business hours
    """
    __tablename__ = "restaurant_settings"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    
    # Branding
    restaurant_name: str
    slogan: Optional[str] = None
    primary_color: str = "#6f4e37"  # Coffee brown
    secondary_color: str = "#d4a574"  # Light coffee
    background_color: str = "#ffffff"  # White background
    
    # Contact
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    phone_number: Optional[str] = None  # Alternative phone/Zalo
    
    # Booking & Messaging
    booking_url: Optional[str] = None
    messenger_url: Optional[str] = None
    
    # Social media
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    youtube_url: Optional[str] = None
    tiktok_url: Optional[str] = None
    
    # Media
    logo_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    favicon_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    cover_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    meta_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    
    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    
    # Business hours and additional settings
    business_hours: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    settings_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CafePageSettings(SQLModel, table=True):
    """
    Per-page settings (VR360 links, display control)
    """
    __tablename__ = "restaurant_page_settings"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    
    page_code: str = Field(index=True)  # e.g., 'menu', 'events', 'about'
    is_displaying: bool = True
    vr360_link: Optional[str] = None
    vr_title: Optional[str] = None
    settings_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class VR360Scene(SQLModel, table=True):
    """
    Tenant-scoped VR360 scene metadata synced from the tour export.
    """
    __tablename__ = "vr360_scenes"

    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    property_id: Optional[int] = Field(default=None, index=True)

    scene_id: str = Field(index=True)
    scene_name: str
    scene_subtitle: Optional[str] = None
    panorama_url: Optional[str] = None
    display_order: int = 0
    is_active: bool = True

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ==========================================
# Restaurant Branches
# ==========================================

class CafeBranch(SQLModel, table=True):
    """
    Restaurant branches/locations
    """
    __tablename__ = "restaurant_branches"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    code: str = Field(unique=True, index=True)
    name: Optional[str] = None
    address: Optional[str] = None
    opening_hours: Optional[str] = None
    
    # Contact
    phone: Optional[str] = None
    email: Optional[str] = None
    
    # Location
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_maps_url: Optional[str] = None
    
    # Media
    primary_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    vr360_link: Optional[str] = None
    
    # Status
    is_active: bool = True
    is_primary: bool = False
    display_order: int = 0
    
    # Additional attributes
    attributes_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafeBranchTranslation"] = Relationship(back_populates="branch")
    media: List["CafeBranchMedia"] = Relationship(back_populates="branch")


class CafeBranchTranslation(SQLModel, table=True):
    """
    Branch translations
    """
    __tablename__ = "restaurant_branch_translations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    branch_id: int = Field(foreign_key="restaurant_branches.id", index=True)
    locale: str = Field(index=True)
    
    name: str
    address: Optional[str] = None
    description: Optional[str] = None
    amenities_text: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    branch: Optional[CafeBranch] = Relationship(back_populates="translations")


class CafeBranchMedia(SQLModel, table=True):
    """
    Branch media (photos)
    """
    __tablename__ = "restaurant_branch_media"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    branch_id: int = Field(foreign_key="restaurant_branches.id", index=True)
    media_id: int = Field(foreign_key="media_files.id", index=True)
    
    is_primary: bool = False
    sort_order: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    branch: Optional[CafeBranch] = Relationship(back_populates="media")


# ==========================================
# Restaurant Menu
# ==========================================

class CafeMenuCategory(SQLModel, table=True):
    """
    Menu categories (e.g., Coffee, Tea, Desserts)
    """
    __tablename__ = "restaurant_menu_categories"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    code: str = Field(unique=True, index=True)
    icon_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    display_order: int = 0
    is_active: bool = True
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafeMenuCategoryTranslation"] = Relationship(back_populates="category")


class CafeMenuCategoryTranslation(SQLModel, table=True):
    """
    Menu category translations
    """
    __tablename__ = "restaurant_menu_category_translations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = Field(foreign_key="restaurant_menu_categories.id", index=True)
    locale: str = Field(index=True)
    
    name: str
    description: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    category: Optional[CafeMenuCategory] = Relationship(back_populates="translations")


class CafeMenuItem(SQLModel, table=True):
    """
    Menu items (dishes, drinks)
    """
    __tablename__ = "restaurant_menu_items"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    category_id: int = Field(foreign_key="restaurant_menu_categories.id", index=True)
    code: str = Field(unique=True, index=True)
    
    # Pricing
    price: Optional[float] = None
    original_price: Optional[float] = None
    
    # Status
    status: str = "available"  # MenuItemStatus enum
    
    # Variants (e.g., Small/Medium/Large)
    sizes: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Tags (e.g., vegetarian, gluten-free)
    tags: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    # Nutrition
    calories: Optional[int] = None
    
    # Media
    primary_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    
    # Highlights
    is_bestseller: bool = False
    is_new: bool = False
    is_seasonal: bool = False
    
    display_order: int = 0
    attributes_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafeMenuItemTranslation"] = Relationship(back_populates="item")
    media: List["CafeMenuItemMedia"] = Relationship(back_populates="item")


class CafeMenuItemTranslation(SQLModel, table=True):
    """
    Menu item translations
    """
    __tablename__ = "restaurant_menu_item_translations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="restaurant_menu_items.id", index=True)
    locale: str = Field(index=True)
    
    name: str
    description: Optional[str] = None
    ingredients: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    item: Optional[CafeMenuItem] = Relationship(back_populates="translations")


class CafeMenuItemMedia(SQLModel, table=True):
    """
    Menu item media (photos)
    """
    __tablename__ = "restaurant_menu_item_media"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="restaurant_menu_items.id", index=True)
    media_id: int = Field(foreign_key="media_files.id", index=True)
    
    is_primary: bool = False
    sort_order: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    item: Optional[CafeMenuItem] = Relationship(back_populates="media")


# ==========================================
# Restaurant Events
# ==========================================

class CafeEvent(SQLModel, table=True):
    """
    Restaurant events (workshops, tastings, music nights)
    """
    __tablename__ = "restaurant_events"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    code: str = Field(unique=True, index=True)
    
    # Timing
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    
    # Location
    branch_id: Optional[int] = Field(default=None, foreign_key="restaurant_branches.id")
    location_text: Optional[str] = None
    
    # Registration
    registration_url: Optional[str] = None
    max_participants: Optional[int] = None
    
    # Media
    primary_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    
    # Status
    status: str = "upcoming"  # EventStatus enum
    is_featured: bool = False
    display_order: int = 0
    
    attributes_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafeEventTranslation"] = Relationship(back_populates="event")
    media: List["CafeEventMedia"] = Relationship(back_populates="event")


class CafeEventTranslation(SQLModel, table=True):
    """
    Event translations
    """
    __tablename__ = "restaurant_event_translations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="restaurant_events.id", index=True)
    locale: str = Field(index=True)
    
    title: str
    description: Optional[str] = None
    details: Optional[str] = None  # Rich text
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    event: Optional[CafeEvent] = Relationship(back_populates="translations")


class CafeEventMedia(SQLModel, table=True):
    """
    Event media (photos)
    """
    __tablename__ = "restaurant_event_media"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="restaurant_events.id", index=True)
    media_id: int = Field(foreign_key="media_files.id", index=True)
    
    is_primary: bool = False
    sort_order: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    event: Optional[CafeEvent] = Relationship(back_populates="media")


# ==========================================
# Restaurant Careers
# ==========================================

class CafeCareer(SQLModel, table=True):
    """
    Career/job postings
    """
    __tablename__ = "restaurant_careers"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    code: str = Field(unique=True, index=True)
    
    # Job details
    job_type: Optional[str] = None  # Full-time, Part-time, Internship
    experience_required: Optional[str] = None
    
    # Salary
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_text: Optional[str] = None  # "Negotiable"
    
    # Application
    deadline: Optional[date] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    application_url: Optional[str] = None
    
    # Location
    branch_id: Optional[int] = Field(default=None, foreign_key="restaurant_branches.id")
    
    # Media
    primary_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    
    # Status
    status: str = "open"  # CareerStatus enum
    display_order: int = 0
    is_urgent: bool = False
    
    attributes_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafeCareerTranslation"] = Relationship(back_populates="career")
    media: List["CafeCareerMedia"] = Relationship(back_populates="career")


class CafeCareerTranslation(SQLModel, table=True):
    """
    Career posting translations
    """
    __tablename__ = "restaurant_career_translations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    career_id: int = Field(foreign_key="restaurant_careers.id", index=True)
    locale: str = Field(index=True)
    
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    benefits: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    career: Optional[CafeCareer] = Relationship(back_populates="translations")


class CafeCareerMedia(SQLModel, table=True):
    """
    Career media (photos)
    """
    __tablename__ = "restaurant_career_media"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    career_id: int = Field(foreign_key="restaurant_careers.id", index=True)
    media_id: int = Field(foreign_key="media_files.id", index=True)
    
    is_primary: bool = False
    sort_order: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    career: Optional[CafeCareer] = Relationship(back_populates="media")


# ==========================================
# Restaurant Promotions
# ==========================================

class CafePromotion(SQLModel, table=True):
    """
    Promotions and special offers
    """
    __tablename__ = "restaurant_promotions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    code: str = Field(unique=True, index=True)
    
    # Discount
    promotion_type: str = "percentage"  # PromotionType enum
    discount_value: Optional[float] = None
    
    # Validity
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    
    # Applicability
    applicable_menu_items: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    applicable_categories: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    applicable_branches: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    min_purchase_amount: Optional[float] = None
    
    # Media
    primary_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    
    # Status
    is_active: bool = True
    is_featured: bool = False
    display_order: int = 0
    
    attributes_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafePromotionTranslation"] = Relationship(back_populates="promotion")
    media: List["CafePromotionMedia"] = Relationship(back_populates="promotion")


class CafePromotionTranslation(SQLModel, table=True):
    """
    Promotion translations
    """
    __tablename__ = "restaurant_promotion_translations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    promotion_id: int = Field(foreign_key="restaurant_promotions.id", index=True)
    locale: str = Field(index=True)
    
    title: str
    description: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    promotion: Optional[CafePromotion] = Relationship(back_populates="translations")


class CafePromotionMedia(SQLModel, table=True):
    """
    Promotion media (photos)
    """
    __tablename__ = "restaurant_promotion_media"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    promotion_id: int = Field(foreign_key="restaurant_promotions.id", index=True)
    media_id: int = Field(foreign_key="media_files.id", index=True)
    
    is_primary: bool = False
    sort_order: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    promotion: Optional[CafePromotion] = Relationship(back_populates="media")


# ==========================================
# Restaurant Achievements
# ==========================================

class CafeAchievement(SQLModel, table=True):
    """
    Restaurant achievements (awards, certifications, milestones)
    """
    __tablename__ = "restaurant_achievements"

    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    code: str = Field(unique=True, index=True)

    achievement_type: Optional[str] = Field(default=None, index=True)
    issuer: Optional[str] = None
    awarded_at: Optional[date] = None
    location_text: Optional[str] = None
    reference_url: Optional[str] = None

    primary_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")

    is_active: bool = True
    is_featured: bool = False
    display_order: int = 0

    attributes_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafeAchievementTranslation"] = Relationship(back_populates="achievement")
    media: List["CafeAchievementMedia"] = Relationship(back_populates="achievement")


class CafeAchievementTranslation(SQLModel, table=True):
    """
    Achievement translations
    """
    __tablename__ = "restaurant_achievement_translations"

    id: Optional[int] = Field(default=None, primary_key=True)
    achievement_id: int = Field(foreign_key="restaurant_achievements.id", index=True)
    locale: str = Field(index=True)

    title: str
    description: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)

    achievement: Optional[CafeAchievement] = Relationship(back_populates="translations")


class CafeAchievementMedia(SQLModel, table=True):
    """
    Achievement media (photos/certificates)
    """
    __tablename__ = "restaurant_achievement_media"

    id: Optional[int] = Field(default=None, primary_key=True)
    achievement_id: int = Field(foreign_key="restaurant_achievements.id", index=True)
    media_id: int = Field(foreign_key="media_files.id", index=True)

    is_primary: bool = False
    sort_order: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow)

    achievement: Optional[CafeAchievement] = Relationship(back_populates="media")


# ==========================================
# Restaurant Spaces
# ==========================================

class CafeSpace(SQLModel, table=True):
    """
    Restaurant spaces / areas
    """
    __tablename__ = "restaurant_spaces"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    code: str = Field(index=True)
    
    primary_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    amenities_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    capacity: Optional[int] = None
    area_size: Optional[str] = None
    
    is_active: bool = True
    display_order: int = 0
    attributes_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafeSpaceTranslation"] = Relationship(back_populates="space")
    media: List["CafeSpaceMedia"] = Relationship(back_populates="space")


class CafeSpaceTranslation(SQLModel, table=True):
    """
    Space translations
    """
    __tablename__ = "restaurant_space_translations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    space_id: int = Field(foreign_key="restaurant_spaces.id", index=True)
    locale: str = Field(index=True)
    
    name: str
    description: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    space: Optional[CafeSpace] = Relationship(back_populates="translations")


class CafeSpaceMedia(SQLModel, table=True):
    """
    Space media (photos)
    """
    __tablename__ = "restaurant_space_media"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    space_id: int = Field(foreign_key="restaurant_spaces.id", index=True)
    media_id: int = Field(foreign_key="media_files.id", index=True)
    
    is_primary: bool = False
    sort_order: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    space: Optional[CafeSpace] = Relationship(back_populates="media")


# ==========================================
# Restaurant Services
# ==========================================

class CafeService(SQLModel, table=True):
    """
    Restaurant services (spa, concierge, etc.)
    """
    __tablename__ = "restaurant_services"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    
    code: str = Field(index=True)  # Internal identifier (e.g., SV01, SPA-001)
    service_type: str = Field(index=True)  # room_service, laundry, concierge, airport_transfer, spa_service, tour_booking, car_rental, babysitting, other
    
    availability: Optional[str] = None  # e.g., "24/7", "9:00 AM - 10:00 PM", "09:00-21:00"
    price_information: Optional[str] = None  # e.g., "Starting from $50", "Free", "Upon request", numbers
    
    # Links
    vr360_tour_url: Optional[str] = None  # VR360 tour link
    booking_url: Optional[str] = None  # Direct booking/reservation URL
    
    # Media
    primary_image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    
    # Status
    is_active: bool = True
    display_order: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafeServiceTranslation"] = Relationship(back_populates="service")
    media: List["CafeServiceMedia"] = Relationship(back_populates="service")


class CafeServiceTranslation(SQLModel, table=True):
    """
    Service translations
    """
    __tablename__ = "restaurant_service_translations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    service_id: int = Field(foreign_key="restaurant_services.id", index=True)
    locale: str = Field(index=True)
    
    name: str  # Service name
    description: Optional[str] = None  # Service description/details
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    service: Optional[CafeService] = Relationship(back_populates="translations")


class CafeServiceMedia(SQLModel, table=True):
    """
    Service media (photos/gallery)
    """
    __tablename__ = "restaurant_service_media"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    service_id: int = Field(foreign_key="restaurant_services.id", index=True)
    media_id: int = Field(foreign_key="media_files.id", index=True)
    
    sort_order: int = 0
    is_primary: bool = False
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    service: Optional[CafeService] = Relationship(back_populates="media")


# ==========================================
# Restaurant Content Sections (Home/About)
# ==========================================

class CafeContentSection(SQLModel, table=True):
    """
    Content sections for Home/About pages (features, values, etc.)
    """
    __tablename__ = "restaurant_content_sections"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenants.id", index=True)
    section_type: str = Field(index=True)  # 'feature', 'value', 'service', etc.
    page_code: str = Field(index=True)  # 'home', 'about'
    
    icon: Optional[str] = None
    image_media_id: Optional[int] = Field(default=None, foreign_key="media_files.id")
    
    is_active: bool = True
    display_order: int = 0
    attributes_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    translations: List["CafeContentSectionTranslation"] = Relationship(back_populates="section")


class CafeContentSectionTranslation(SQLModel, table=True):
    """
    Content section translations
    """
    __tablename__ = "restaurant_content_section_translations"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    section_id: int = Field(foreign_key="restaurant_content_sections.id", index=True)
    locale: str = Field(index=True)
    
    title: str
    description: Optional[str] = None
    content: Optional[str] = None  # longtext for rich content
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

    section: Optional[CafeContentSection] = Relationship(back_populates="translations")


# Backward-compatible aliases while the codebase finishes migrating to restaurant naming.
RestaurantSettings = CafeSettings
RestaurantPageSettings = CafePageSettings
RestaurantBranch = CafeBranch
RestaurantBranchTranslation = CafeBranchTranslation
RestaurantBranchMedia = CafeBranchMedia
RestaurantMenuCategory = CafeMenuCategory
RestaurantMenuCategoryTranslation = CafeMenuCategoryTranslation
RestaurantMenuItem = CafeMenuItem
RestaurantMenuItemTranslation = CafeMenuItemTranslation
RestaurantMenuItemMedia = CafeMenuItemMedia
RestaurantEvent = CafeEvent
RestaurantEventTranslation = CafeEventTranslation
RestaurantEventMedia = CafeEventMedia
RestaurantCareer = CafeCareer
RestaurantCareerTranslation = CafeCareerTranslation
RestaurantCareerMedia = CafeCareerMedia
RestaurantPromotion = CafePromotion
RestaurantPromotionTranslation = CafePromotionTranslation
RestaurantPromotionMedia = CafePromotionMedia
RestaurantAchievement = CafeAchievement
RestaurantAchievementTranslation = CafeAchievementTranslation
RestaurantAchievementMedia = CafeAchievementMedia
RestaurantSpace = CafeSpace
RestaurantSpaceTranslation = CafeSpaceTranslation
RestaurantSpaceMedia = CafeSpaceMedia
RestaurantService = CafeService
RestaurantServiceTranslation = CafeServiceTranslation
RestaurantServiceMedia = CafeServiceMedia
RestaurantContentSection = CafeContentSection
RestaurantContentSectionTranslation = CafeContentSectionTranslation



