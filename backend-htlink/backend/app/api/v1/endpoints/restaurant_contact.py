"""
Restaurant Contact API endpoints.

Handles restaurant contact information separately from general settings
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel

from app.core.db import get_db
from app.api.deps import CurrentUser, SessionDep
from app.models.restaurant import CafeSettings
from app.utils.vr360 import _get_normalized_sections_bucket

router = APIRouter()


# ==========================================
# Pydantic Schemas
# ==========================================

class CafeContactResponse(BaseModel):
    """Restaurant Contact Response"""
    is_displaying: bool = True
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    twitter_url: Optional[str] = None
    youtube_url: Optional[str] = None
    vr360_link: Optional[str] = None
    vr_title: Optional[str] = None
    map_coordinates: Optional[str] = None
    address_translations: Optional[Dict[str, Any]] = None


class CafeContactUpdate(BaseModel):
    """Restaurant Contact Update"""
    is_displaying: Optional[bool] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    twitter_url: Optional[str] = None
    youtube_url: Optional[str] = None
    vr360_link: Optional[str] = None
    vr_title: Optional[str] = None
    map_coordinates: Optional[str] = None
    address_translations: Optional[Dict[str, Any]] = None


# ==========================================
# API Endpoints
# ==========================================

def get_restaurant_settings_record(db: SessionDep, tenant_id: int) -> Optional[CafeSettings]:
    return db.exec(
        select(CafeSettings).where(CafeSettings.tenant_id == tenant_id).limit(1)
    ).first()

@router.get("/", response_model=CafeContactResponse)
def get_restaurant_contact(
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Get restaurant contact information for current tenant
    Contact data is stored in the restaurant settings table but accessed separately.
    """
    settings = get_restaurant_settings_record(db, current_user.tenant_id)
    
    if not settings:
        # Return default empty contact if settings don't exist
        return CafeContactResponse(
            is_displaying=True,
            address_translations={}
        )
    
    # Extract contact info from settings_json
    settings_json = settings.settings_json or {}
    
    # Get address translations from settings_json
    address_translations = {}
    for key, value in settings_json.items():
        # Check if key is a locale code (2-5 letter codes)
        if isinstance(key, str) and len(key) <= 5 and key.islower():
            if isinstance(value, dict) and ('address' in value or 'working_hours' in value or 'description' in value):
                address_translations[key] = {
                    'address': value.get('address', ''),
                    'working_hours': value.get('working_hours', ''),
                    'description': value.get('description', '')
                }
    
    return CafeContactResponse(
        is_displaying=settings_json.get('contact_is_displaying', True),
        phone=settings.phone,
        email=settings.email,
        website=settings.website,
        facebook_url=settings.facebook_url,
        instagram_url=settings.instagram_url,
        twitter_url=settings_json.get('twitter_url'),
        youtube_url=settings.youtube_url,
        vr360_link=settings_json.get('vr360_link'),
        vr_title=settings_json.get('vr_title'),
        map_coordinates=settings_json.get('map_coordinates'),
        address_translations=address_translations
    )


@router.post("/", response_model=CafeContactResponse)
def update_restaurant_contact(
    contact_data: CafeContactUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Update restaurant contact information
    Contact data is stored in the restaurant settings table.
    """
    # Get or create settings
    settings = get_restaurant_settings_record(db, current_user.tenant_id)
    
    if not settings:
        # Create new settings if doesn't exist
        settings = CafeSettings(
            tenant_id=current_user.tenant_id,
            restaurant_name="My Restaurant",
            primary_color="#6f4e37",
            settings_json={}
        )
        db.add(settings)
    
    # Get current settings_json
    settings_json = settings.settings_json or {}
    
    # Update contact fields from request
    update_dict = contact_data.model_dump(exclude_unset=True)
    
    # Update direct fields in the restaurant settings table
    if 'phone' in update_dict:
        settings.phone = update_dict['phone']
    if 'email' in update_dict:
        settings.email = update_dict['email']
    if 'website' in update_dict:
        settings.website = update_dict['website']
    if 'facebook_url' in update_dict:
        settings.facebook_url = update_dict['facebook_url']
    if 'instagram_url' in update_dict:
        settings.instagram_url = update_dict['instagram_url']
    if 'youtube_url' in update_dict:
        settings.youtube_url = update_dict['youtube_url']
    
    # Update fields stored in settings_json
    if 'is_displaying' in update_dict:
        settings_json['contact_is_displaying'] = update_dict['is_displaying']
    if 'twitter_url' in update_dict:
        settings_json['twitter_url'] = update_dict['twitter_url']
    if 'vr360_link' in update_dict:
        settings_json['vr360_link'] = update_dict['vr360_link']
    if 'vr_title' in update_dict:
        settings_json['vr_title'] = update_dict['vr_title']
    if 'map_coordinates' in update_dict:
        settings_json['map_coordinates'] = update_dict['map_coordinates']
    
    # Update address translations in settings_json
    if 'address_translations' in update_dict and update_dict['address_translations']:
        for locale, translation_data in update_dict['address_translations'].items():
            settings_json[locale] = {
                'address': translation_data.get('address', ''),
                'working_hours': translation_data.get('working_hours', ''),
                'description': translation_data.get('description', '')
            }

    sections_bucket = _get_normalized_sections_bucket(settings_json)
    contact_section = sections_bucket.get('contact')
    if not isinstance(contact_section, dict):
        contact_section = {}
    if 'vr360_link' in update_dict:
        contact_section['vr360_link'] = update_dict['vr360_link']
    if 'vr_title' in update_dict:
        contact_section['vr_title'] = update_dict['vr_title']
    if contact_section:
        sections_bucket['contact'] = contact_section
    
    # Save updated settings_json
    settings.settings_json = settings_json
    flag_modified(settings, 'settings_json')
    
    db.add(settings)
    db.commit()
    db.refresh(settings)
    
    # Return updated contact data
    return get_restaurant_contact(current_user, db)




