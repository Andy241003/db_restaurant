"""
Restaurant Branches API endpoints.

Handles restaurant branch management with multi-language support
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.db import get_db
from app.api.deps import CurrentUser, SessionDep
from app.models.activity_log import ActivityType
from app.models.restaurant import (
    CafeBranch, 
    CafeBranchTranslation, 
    CafeBranchMedia
)
from app.utils.activity_logger import log_user_activity

router = APIRouter()


def _get_primary_branch_translation(translations: List["BranchTranslationSchema"]) -> Optional["BranchTranslationSchema"]:
    for locale in ["vi", "en"]:
        for translation in translations:
            if translation.locale == locale and translation.name:
                return translation

    return next((translation for translation in translations if translation.name), None)


def _get_primary_opening_hours(attributes_json: Optional[dict]) -> Optional[str]:
    if not attributes_json:
        return None

    opening_hours_by_locale = attributes_json.get("opening_hours_by_locale")
    if isinstance(opening_hours_by_locale, dict):
        for locale in ["vi", "en"]:
            value = opening_hours_by_locale.get(locale)
            if isinstance(value, str) and value.strip():
                return value.strip()

        for value in opening_hours_by_locale.values():
            if isinstance(value, str) and value.strip():
                return value.strip()

    for key in ["opening_hours_vi", "opening_hours", "hours"]:
        value = attributes_json.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return None


# ==========================================
# Pydantic Schemas
# ==========================================

class BranchTranslationSchema(BaseModel):
    """Branch translation schema"""
    locale: str
    name: str
    address: Optional[str] = None
    description: Optional[str] = None
    amenities_text: Optional[str] = None


class BranchMediaSchema(BaseModel):
    """Branch media schema"""
    media_id: int
    is_primary: bool = False
    sort_order: int = 0


class CafeBranchResponse(BaseModel):
    """Restaurant Branch Response"""
    id: int
    tenant_id: int
    code: str
    name: Optional[str] = None
    address: Optional[str] = None
    opening_hours: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_maps_url: Optional[str] = None
    primary_image_media_id: Optional[int] = None
    vr360_link: Optional[str] = None
    is_active: bool = True
    is_primary: bool = False
    display_order: int = 0
    attributes_json: Optional[dict] = None
    translations: List[BranchTranslationSchema] = []
    media: List[BranchMediaSchema] = []


class CafeBranchCreate(BaseModel):
    """Restaurant Branch Create"""
    code: str
    opening_hours: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_maps_url: Optional[str] = None
    primary_image_media_id: Optional[int] = None
    vr360_link: Optional[str] = None
    is_active: bool = True
    is_primary: bool = False
    display_order: int = 0
    attributes_json: Optional[dict] = None
    translations: List[BranchTranslationSchema]
    media_ids: Optional[List[int]] = None


class CafeBranchUpdate(BaseModel):
    """Restaurant Branch Update"""
    code: Optional[str] = None
    opening_hours: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_maps_url: Optional[str] = None
    primary_image_media_id: Optional[int] = None
    vr360_link: Optional[str] = None
    is_active: Optional[bool] = None
    is_primary: Optional[bool] = None
    display_order: Optional[int] = None
    attributes_json: Optional[dict] = None
    translations: Optional[List[BranchTranslationSchema]] = None
    media_ids: Optional[List[int]] = None


# ==========================================
# Helper Functions
# ==========================================

def get_branch_with_relations(branch_id: int, db: Session) -> dict:
    """Get branch with all relations"""
    statement = (
        select(CafeBranch)
        .where(CafeBranch.id == branch_id)
        .options(
            selectinload(CafeBranch.translations),
            selectinload(CafeBranch.media),
        )
    )
    branch = db.exec(statement).first()
    if not branch:
        return None
    
    return {
        **branch.model_dump(),
        "translations": [
            BranchTranslationSchema(
                locale=t.locale,
                name=t.name,
                address=t.address,
                description=t.description,
                amenities_text=t.amenities_text
            ) for t in branch.translations
        ],
        "media": [
            BranchMediaSchema(
                media_id=m.media_id,
                is_primary=m.is_primary,
                sort_order=m.sort_order
            ) for m in sorted(branch.media, key=lambda media_row: media_row.sort_order)
        ]
    }


# ==========================================
# API Endpoints
# ==========================================

@router.get("/", response_model=List[CafeBranchResponse])
def get_branches(
    current_user: CurrentUser,
    db: SessionDep,
    is_active: Optional[bool] = None
):
    """
    Get all branches for current tenant with translations and media in single query
    """
    statement = select(CafeBranch).where(
        CafeBranch.tenant_id == current_user.tenant_id
    )
    
    if is_active is not None:
        statement = statement.where(CafeBranch.is_active == is_active)
    
    # Use selectinload to avoid duplicate branch rows when loading collections
    statement = statement.options(
        selectinload(CafeBranch.translations),
        selectinload(CafeBranch.media)
    )
    statement = statement.order_by(CafeBranch.display_order)
    branches = db.exec(statement).all()
    
    result = []
    for branch in branches:
        result.append(CafeBranchResponse(
            id=branch.id,
            tenant_id=branch.tenant_id,
            code=branch.code,
            name=branch.name,
            address=branch.address,
            opening_hours=branch.opening_hours,
            phone=branch.phone,
            email=branch.email,
            latitude=branch.latitude,
            longitude=branch.longitude,
            google_maps_url=branch.google_maps_url,
            primary_image_media_id=branch.primary_image_media_id,
            vr360_link=branch.vr360_link,
            is_active=branch.is_active,
            is_primary=branch.is_primary,
            display_order=branch.display_order,
            attributes_json=branch.attributes_json,
            translations=[
                BranchTranslationSchema(
                    locale=t.locale,
                    name=t.name,
                    address=t.address,
                    description=t.description,
                    amenities_text=t.amenities_text
                ) for t in branch.translations
            ],
            media=[
                BranchMediaSchema(
                    media_id=m.media_id,
                    is_primary=m.is_primary,
                    sort_order=m.sort_order
                ) for m in branch.media
            ]
        ))
    
    return result


@router.get("/{branch_id}", response_model=CafeBranchResponse)
def get_branch(
    branch_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Get specific branch by ID
    """
    branch = db.exec(
        select(CafeBranch).where(CafeBranch.id == branch_id)
    ).first()
    
    if not branch or branch.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    branch_data = get_branch_with_relations(branch_id, db)
    return CafeBranchResponse(**branch_data)


@router.post("/", response_model=CafeBranchResponse)
def create_branch(
    branch_data: CafeBranchCreate,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Create new branch
    """
    # Check if code already exists
    existing = db.exec(
        select(CafeBranch).where(
            CafeBranch.tenant_id == current_user.tenant_id,
            CafeBranch.code == branch_data.code
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Branch code already exists")

    primary_translation = _get_primary_branch_translation(branch_data.translations)
    
    # Create branch
    new_branch = CafeBranch(
        tenant_id=current_user.tenant_id,
        code=branch_data.code,
        name=primary_translation.name if primary_translation else branch_data.code,
        address=primary_translation.address if primary_translation else None,
        opening_hours=branch_data.opening_hours or _get_primary_opening_hours(branch_data.attributes_json),
        phone=branch_data.phone,
        email=branch_data.email,
        latitude=branch_data.latitude,
        longitude=branch_data.longitude,
        google_maps_url=branch_data.google_maps_url,
        primary_image_media_id=branch_data.primary_image_media_id,
        vr360_link=branch_data.vr360_link,
        is_active=branch_data.is_active,
        is_primary=branch_data.is_primary,
        display_order=branch_data.display_order,
        attributes_json=branch_data.attributes_json
    )
    
    db.add(new_branch)
    db.commit()
    db.refresh(new_branch)
    
    # Add translations
    for trans in branch_data.translations:
            translation = CafeBranchTranslation(
                branch_id=new_branch.id,
                locale=trans.locale,
                name=trans.name,
                address=trans.address,
                description=trans.description,
                amenities_text=trans.amenities_text
            )
            db.add(translation)
    
    # Add media
    if branch_data.media_ids:
        for idx, media_id in enumerate(branch_data.media_ids):
            branch_media = CafeBranchMedia(
                branch_id=new_branch.id,
                media_id=media_id,
                sort_order=idx
            )
            db.add(branch_media)
    
    db.commit()
    
    branch_name = primary_translation.name if primary_translation else new_branch.code
    log_user_activity(
        db,
        current_user,
        ActivityType.CREATE_PROPERTY,
        f'Branch "{branch_name}" created',
        resource_type="restaurant_branch",
        resource_id=new_branch.id,
        extra_details={"title": branch_name, "code": new_branch.code},
    )

    # Return with relations
    branch_full = get_branch_with_relations(new_branch.id, db)
    return CafeBranchResponse(**branch_full)


@router.put("/{branch_id}", response_model=CafeBranchResponse)
def update_branch(
    branch_id: int,
    branch_data: CafeBranchUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Update existing branch
    """
    branch = db.get(CafeBranch, branch_id)
    
    if not branch or branch.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")

    update_data = branch_data.model_dump(exclude_unset=True, exclude={'translations', 'media_ids'})
    if branch_data.translations is not None:
        primary_translation = _get_primary_branch_translation(branch_data.translations)
        if primary_translation:
            update_data["name"] = primary_translation.name
            update_data["address"] = primary_translation.address

    if branch_data.attributes_json is not None and "opening_hours" not in update_data:
        derived_opening_hours = _get_primary_opening_hours(branch_data.attributes_json)
        if derived_opening_hours is not None:
            update_data["opening_hours"] = derived_opening_hours
    
    # Update branch fields
    for key, value in update_data.items():
        if value is not None:
            setattr(branch, key, value)
            if key == 'attributes_json':
                flag_modified(branch, key)
    
    db.add(branch)
    
    # Update translations
    if branch_data.translations is not None:
        # Delete existing translations
        db.exec(
            select(CafeBranchTranslation).where(
                CafeBranchTranslation.branch_id == branch_id
            )
        ).all()
        
        for existing_trans in db.exec(
            select(CafeBranchTranslation).where(CafeBranchTranslation.branch_id == branch_id)
        ).all():
            db.delete(existing_trans)
        db.flush()
        
        # Add new translations
        for trans in branch_data.translations:
            translation = CafeBranchTranslation(
                branch_id=branch_id,
                locale=trans.locale,
                name=trans.name,
                address=trans.address,
                description=trans.description,
                amenities_text=trans.amenities_text
            )
            db.add(translation)
    
    # Update media
    if branch_data.media_ids is not None:
        # Delete existing media
        for existing_media in db.exec(
            select(CafeBranchMedia).where(CafeBranchMedia.branch_id == branch_id)
        ).all():
            db.delete(existing_media)
        db.flush()
        
        # Add new media
        for idx, media_id in enumerate(branch_data.media_ids):
            branch_media = CafeBranchMedia(
                branch_id=branch_id,
                media_id=media_id,
                sort_order=idx
            )
            db.add(branch_media)
    
    db.commit()
    db.refresh(branch)

    branch_name = branch.name or branch.code
    log_user_activity(
        db,
        current_user,
        ActivityType.UPDATE_PROPERTY,
        f'Branch "{branch_name}" updated',
        resource_type="restaurant_branch",
        resource_id=branch_id,
        extra_details={"title": branch_name, "code": branch.code},
    )
    
    # Return with relations
    branch_full = get_branch_with_relations(branch_id, db)
    return CafeBranchResponse(**branch_full)


@router.delete("/{branch_id}")
def delete_branch(
    branch_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Delete branch
    """
    branch = db.get(CafeBranch, branch_id)
    
    if not branch or branch.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    branch_name = branch.name or branch.code

    for existing_trans in db.exec(
        select(CafeBranchTranslation).where(CafeBranchTranslation.branch_id == branch_id)
    ).all():
        db.delete(existing_trans)

    for existing_media in db.exec(
        select(CafeBranchMedia).where(CafeBranchMedia.branch_id == branch_id)
    ).all():
        db.delete(existing_media)

    db.flush()
    db.delete(branch)
    db.commit()

    log_user_activity(
        db,
        current_user,
        ActivityType.DELETE_PROPERTY,
        f'Branch "{branch_name}" deleted',
        resource_type="restaurant_branch",
        resource_id=branch_id,
        extra_details={"title": branch_name, "code": branch.code},
    )
    
    return {"success": True, "message": "Branch deleted"}


@router.post("/{branch_id}/reorder")
def reorder_branch(
    branch_id: int,
    new_order: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """
    Reorder branch display order
    """
    branch = db.get(CafeBranch, branch_id)
    
    if not branch or branch.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    branch.display_order = new_order
    db.add(branch)
    db.commit()
    
    return {"success": True, "message": "Branch reordered"}




