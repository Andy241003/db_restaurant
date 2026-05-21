"""
Restaurant Settings API endpoints

Handles restaurant settings, contact, branding, and page configurations.
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from sqlmodel import select
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel

from app.api.deps import CurrentUser, SessionDep
from app.models.restaurant import CafeSettings, CafePageSettings
from app.utils.vr360 import _get_normalized_sections_bucket

router = APIRouter()

VR360_SETTINGS_KEY_MAP = {
    'menu': ('menu_vr360_link', 'menu_vr_title'),
    'events': ('events_vr360_link', 'events_vr_title'),
    'careers': ('careers_vr360_link', 'careers_vr_title'),
    'promotions': ('promotions_vr360_link', 'promotions_vr_title'),
    'branches': ('branches_vr360_link', 'branches_vr_title'),
    'achievements': ('achievements_vr360_link', 'achievements_vr_title'),
    'spaces': ('spaces_vr360_link', 'spaces_vr_title'),
    'contact': ('vr360_link', 'vr_title'),
}


# ==========================================
# Pydantic Schemas
# ==========================================

class CafeSettingsResponse(BaseModel):
    """Restaurant Settings Response"""
    id: Optional[int] = None
    tenant_id: Optional[int] = None
    restaurant_name: str
    slogan: Optional[str] = None
    primary_color: str = "#6f4e37"
    secondary_color: str = "#d4a574"
    background_color: str = "#ffffff"
    booking_url: Optional[str] = None
    messenger_url: Optional[str] = None
    phone_number: Optional[str] = None
    logo_media_id: Optional[int] = None
    favicon_media_id: Optional[int] = None
    cover_image_media_id: Optional[int] = None
    meta_image_media_id: Optional[int] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    business_hours: Optional[Dict[str, Any]] = None
    settings_json: Optional[Dict[str, Any]] = None


class CafeSettingsUpdate(BaseModel):
    """Restaurant Settings Update"""
    restaurant_name: Optional[str] = None
    slogan: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    background_color: Optional[str] = None
    logo_media_id: Optional[int] = None
    favicon_media_id: Optional[int] = None
    booking_url: Optional[str] = None
    messenger_url: Optional[str] = None
    phone_number: Optional[str] = None
    cover_image_media_id: Optional[int] = None
    meta_image_media_id: Optional[int] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    business_hours: Optional[Dict[str, Any]] = None
    settings_json: Optional[Dict[str, Any]] = None


class CafePageSettingsResponse(BaseModel):
    """Restaurant Page Settings Response"""
    id: Optional[int] = None
    tenant_id: Optional[int] = None
    page_code: str
    is_displaying: bool = True
    vr360_link: Optional[str] = None
    vr_title: Optional[str] = None
    settings_json: Optional[Dict[str, Any]] = None


class CafePageSettingsUpdate(BaseModel):
    """Restaurant Page Settings Update"""
    page_code: str
    is_displaying: Optional[bool] = None
    vr360_link: Optional[str] = None
    vr_title: Optional[str] = None
    settings_json: Optional[Dict[str, Any]] = None


# ==========================================
# Helper Functions
# ==========================================

def get_restaurant_settings_record(db: SessionDep, tenant_id: int) -> Optional[CafeSettings]:
    return db.exec(
        select(CafeSettings).where(CafeSettings.tenant_id == tenant_id).limit(1)
    ).first()


def to_restaurant_settings_response(
    settings: CafeSettings | CafeSettingsResponse,
    tenant_id: int,
) -> CafeSettingsResponse:
    payload = settings.model_dump()
    payload["tenant_id"] = tenant_id
    return CafeSettingsResponse(**payload)


def to_page_settings_response(
    page_settings: CafePageSettings | CafePageSettingsResponse,
    tenant_id: int,
) -> CafePageSettingsResponse:
    payload = page_settings.model_dump()
    payload["tenant_id"] = tenant_id
    return CafePageSettingsResponse(**payload)


def get_page_settings_record(db: SessionDep, tenant_id: int, page_code: str) -> Optional[CafePageSettings]:
    return db.exec(
        select(CafePageSettings).where(
            CafePageSettings.tenant_id == tenant_id,
            CafePageSettings.page_code == page_code,
        )
    ).first()


# ==========================================
# API Endpoints
# ==========================================

@router.get("/", response_model=CafeSettingsResponse)
def get_restaurant_settings(
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Get restaurant settings for current tenant
    """
    settings = get_restaurant_settings_record(db, current_user.tenant_id)

    if not settings:
        return CafeSettingsResponse(
            tenant_id=current_user.tenant_id,
            restaurant_name="My Restaurant",
            primary_color="#6f4e37",
            secondary_color="#d4a574",
            background_color="#ffffff"
        )

    return to_restaurant_settings_response(settings, current_user.tenant_id)


@router.post("/", response_model=CafeSettingsResponse)
def create_or_update_restaurant_settings(
    settings_data: CafeSettingsUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Create or update restaurant settings
    """
    existing = get_restaurant_settings_record(db, current_user.tenant_id)

    if existing:
        incoming_payload = settings_data.model_dump(exclude_unset=True)
        for key, value in incoming_payload.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
                if key in ['business_hours', 'settings_json']:
                    flag_modified(existing, key)

        if isinstance(incoming_payload.get('settings_json'), dict):
            settings_json = existing.settings_json or {}
            sections_bucket = _get_normalized_sections_bucket(settings_json)
            for section_code, (legacy_link_key, legacy_title_key) in VR360_SETTINGS_KEY_MAP.items():
                section_state = sections_bucket.get(section_code)
                if not isinstance(section_state, dict):
                    section_state = {}
                if legacy_link_key in incoming_payload['settings_json']:
                    section_state['vr360_link'] = incoming_payload['settings_json'].get(legacy_link_key)
                if legacy_title_key in incoming_payload['settings_json']:
                    section_state['vr_title'] = incoming_payload['settings_json'].get(legacy_title_key)
                if f'{section_code}_target_id' in incoming_payload['settings_json']:
                    section_state['target_id'] = incoming_payload['settings_json'].get(f'{section_code}_target_id')
                if f'{section_code}_panorama_url' in incoming_payload['settings_json']:
                    section_state['panorama_url'] = incoming_payload['settings_json'].get(f'{section_code}_panorama_url')
                if f'{section_code}_title_translations' in incoming_payload['settings_json']:
                    section_state['title_translations'] = incoming_payload['settings_json'].get(f'{section_code}_title_translations')
                if section_state:
                    sections_bucket[section_code] = section_state
            existing.settings_json = settings_json
            flag_modified(existing, 'settings_json')

        db.add(existing)
        db.commit()
        db.refresh(existing)
        return to_restaurant_settings_response(existing, current_user.tenant_id)

    settings_dict = settings_data.model_dump(exclude_unset=True)
    if isinstance(settings_dict.get('settings_json'), dict):
        sections_bucket = _get_normalized_sections_bucket(settings_dict['settings_json'])
        for section_code, (legacy_link_key, legacy_title_key) in VR360_SETTINGS_KEY_MAP.items():
            section_state = sections_bucket.get(section_code)
            if not isinstance(section_state, dict):
                section_state = {}
            if legacy_link_key in settings_dict['settings_json']:
                section_state['vr360_link'] = settings_dict['settings_json'].get(legacy_link_key)
            if legacy_title_key in settings_dict['settings_json']:
                section_state['vr_title'] = settings_dict['settings_json'].get(legacy_title_key)
            if f'{section_code}_target_id' in settings_dict['settings_json']:
                section_state['target_id'] = settings_dict['settings_json'].get(f'{section_code}_target_id')
            if f'{section_code}_panorama_url' in settings_dict['settings_json']:
                section_state['panorama_url'] = settings_dict['settings_json'].get(f'{section_code}_panorama_url')
            if f'{section_code}_title_translations' in settings_dict['settings_json']:
                section_state['title_translations'] = settings_dict['settings_json'].get(f'{section_code}_title_translations')
            if section_state:
                sections_bucket[section_code] = section_state
    if 'restaurant_name' not in settings_dict or settings_dict.get('restaurant_name') is None:
        settings_dict['restaurant_name'] = 'My Restaurant'

    new_settings = CafeSettings(
        tenant_id=current_user.tenant_id,
        **settings_dict,
    )
    db.add(new_settings)
    db.commit()
    db.refresh(new_settings)
    return to_restaurant_settings_response(new_settings, current_user.tenant_id)


@router.get("/pages", response_model=list[CafePageSettingsResponse])
def get_restaurant_page_settings(
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Get all page settings for current tenant
    """
    statement = select(CafePageSettings).where(
        CafePageSettings.tenant_id == current_user.tenant_id
    )
    page_settings = db.exec(statement).all()
    return [
        to_page_settings_response(page, current_user.tenant_id)
        for page in page_settings
    ]


@router.get("/pages/{page_code}", response_model=CafePageSettingsResponse)
def get_page_setting(
    page_code: str,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Get specific page setting
    """
    page_setting = get_page_settings_record(db, current_user.tenant_id, page_code)

    if not page_setting:
        return CafePageSettingsResponse(
            tenant_id=current_user.tenant_id,
            page_code=page_code,
            is_displaying=True,
            vr360_link=None,
            vr_title=None,
            settings_json=None,
        )

    return to_page_settings_response(page_setting, current_user.tenant_id)


@router.post("/pages", response_model=CafePageSettingsResponse)
def create_or_update_page_setting(
    page_data: CafePageSettingsUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Create or update page setting
    """
    existing = get_page_settings_record(db, current_user.tenant_id, page_data.page_code)

    if existing:
        normalized_settings_json = existing.settings_json or {}
        sections_bucket = _get_normalized_sections_bucket(normalized_settings_json)
        section_state = sections_bucket.get(page_data.page_code)
        if not isinstance(section_state, dict):
            section_state = {}

        for key, value in page_data.model_dump(exclude_unset=True).items():
            if hasattr(existing, key) and key != 'page_code':
                setattr(existing, key, value)
                if key == 'settings_json':
                    flag_modified(existing, key)
            if key == 'vr360_link':
                section_state['vr360_link'] = value
            if key == 'vr_title':
                section_state['vr_title'] = value
            if key == 'settings_json' and isinstance(value, dict):
                for legacy_key, mapped_key in (
                    ('target_id', 'target_id'),
                    ('targetId', 'target_id'),
                    ('scene_id', 'target_id'),
                    ('sceneId', 'target_id'),
                    ('panorama_url', 'panorama_url'),
                    ('panoramaUrl', 'panorama_url'),
                    ('title_translations', 'title_translations'),
                    ('titleTranslations', 'title_translations'),
                ):
                    if legacy_key in value:
                        section_state[mapped_key] = value.get(legacy_key)

        if section_state:
            sections_bucket[page_data.page_code] = section_state
            existing.settings_json = normalized_settings_json
            flag_modified(existing, 'settings_json')

        db.add(existing)
        db.commit()
        db.refresh(existing)
        return to_page_settings_response(existing, current_user.tenant_id)

    new_settings_json = page_data.settings_json or {}
    sections_bucket = _get_normalized_sections_bucket(new_settings_json)
    section_state = sections_bucket.get(page_data.page_code)
    if not isinstance(section_state, dict):
        section_state = {}
    if page_data.vr360_link is not None:
        section_state['vr360_link'] = page_data.vr360_link
    if page_data.vr_title is not None:
        section_state['vr_title'] = page_data.vr_title
    if isinstance(page_data.settings_json, dict):
        for legacy_key, mapped_key in (
            ('target_id', 'target_id'),
            ('targetId', 'target_id'),
            ('scene_id', 'target_id'),
            ('sceneId', 'target_id'),
            ('panorama_url', 'panorama_url'),
            ('panoramaUrl', 'panorama_url'),
            ('title_translations', 'title_translations'),
            ('titleTranslations', 'title_translations'),
        ):
            if legacy_key in page_data.settings_json:
                section_state[mapped_key] = page_data.settings_json.get(legacy_key)
    if section_state:
        sections_bucket[page_data.page_code] = section_state

    new_page = CafePageSettings(
        tenant_id=current_user.tenant_id,
        **{
            **page_data.model_dump(exclude_unset=True),
            'settings_json': new_settings_json,
        },
    )
    db.add(new_page)
    db.commit()
    db.refresh(new_page)
    return to_page_settings_response(new_page, current_user.tenant_id)


@router.delete("/pages/{page_code}")
def delete_page_setting(
    page_code: str,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Delete page setting
    """
    page_setting = get_page_settings_record(db, current_user.tenant_id, page_code)

    if not page_setting:
        raise HTTPException(status_code=404, detail="Page setting not found")

    db.delete(page_setting)
    db.commit()

    return {"success": True, "message": "Page setting deleted"}




