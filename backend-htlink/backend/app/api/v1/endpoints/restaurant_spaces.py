"""
Restaurant Spaces API endpoints.

Handles restaurant spaces/areas management with multi-language support
"""
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.db import get_db
from app.api.deps import CurrentUser, SessionDep
from app.models.activity_log import ActivityType
from app.models.restaurant import (
    CafeSpace,
    CafeSpaceTranslation,
    CafeSpaceMedia
)
from app.utils.activity_logger import log_user_activity

router = APIRouter()


# ==========================================
# Pydantic Schemas
# ==========================================

class SpaceTranslationSchema(BaseModel):
    """Space translation schema"""
    locale: str
    name: str
    description: Optional[str] = None


class SpaceMediaSchema(BaseModel):
    """Space media schema"""
    media_id: int
    is_primary: bool = False
    sort_order: int = 0


class CafeSpaceResponse(BaseModel):
    """Restaurant Space Response"""
    id: int
    tenant_id: int
    code: str
    primary_image_media_id: Optional[int] = None
    amenities_json: Optional[Any] = None
    capacity: Optional[int] = None
    area_size: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    attributes_json: Optional[Any] = None
    translations: List[SpaceTranslationSchema] = []
    media: List[SpaceMediaSchema] = []


class CafeSpaceCreate(BaseModel):
    """Restaurant Space Create"""
    code: str
    primary_image_media_id: Optional[int] = None
    amenities_json: Optional[Any] = None
    capacity: Optional[int] = None
    area_size: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    attributes_json: Optional[Any] = None
    translations: List[SpaceTranslationSchema]
    media_ids: Optional[List[int]] = None


class CafeSpaceUpdate(BaseModel):
    """Restaurant Space Update"""
    code: Optional[str] = None
    primary_image_media_id: Optional[int] = None
    amenities_json: Optional[Any] = None
    capacity: Optional[int] = None
    area_size: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    attributes_json: Optional[Any] = None
    translations: Optional[List[SpaceTranslationSchema]] = None
    media_ids: Optional[List[int]] = None


# ==========================================
# Helper Functions
# ==========================================

def get_space_with_relations(space_id: int, db: Session) -> dict:
    """Get space with all relations"""
    statement = (
        select(CafeSpace)
        .where(CafeSpace.id == space_id)
        .options(
            selectinload(CafeSpace.translations),
            selectinload(CafeSpace.media),
        )
    )
    space = db.exec(statement).first()
    if not space:
        return None
    
    return {
        **space.model_dump(),
        "translations": [
            SpaceTranslationSchema(
                locale=t.locale,
                name=t.name,
                description=t.description
            ) for t in space.translations
        ],
        "media": [
            SpaceMediaSchema(
                media_id=m.media_id,
                is_primary=m.is_primary,
                sort_order=m.sort_order
            ) for m in sorted(space.media, key=lambda media_row: media_row.sort_order)
        ]
    }


# ==========================================
# API Endpoints
# ==========================================

@router.get("/", response_model=List[CafeSpaceResponse])
def get_spaces(
    current_user: CurrentUser,
    db: SessionDep,
    is_active: Optional[bool] = None
):
    """Get all spaces"""
    statement = select(CafeSpace).where(
        CafeSpace.tenant_id == current_user.tenant_id
    )
    
    if is_active is not None:
        statement = statement.where(CafeSpace.is_active == is_active)
    
    statement = statement.options(
        selectinload(CafeSpace.translations),
        selectinload(CafeSpace.media),
    )
    statement = statement.order_by(CafeSpace.display_order)
    spaces = db.exec(statement).all()

    return [
        CafeSpaceResponse(
            id=space.id,
            tenant_id=space.tenant_id,
            code=space.code,
            primary_image_media_id=space.primary_image_media_id,
            amenities_json=space.amenities_json,
            capacity=space.capacity,
            area_size=space.area_size,
            is_active=space.is_active,
            display_order=space.display_order,
            attributes_json=space.attributes_json,
            translations=[
                SpaceTranslationSchema(
                    locale=t.locale,
                    name=t.name,
                    description=t.description,
                ) for t in space.translations
            ],
            media=[
                SpaceMediaSchema(
                    media_id=m.media_id,
                    is_primary=m.is_primary,
                    sort_order=m.sort_order,
                ) for m in sorted(space.media, key=lambda media_row: media_row.sort_order)
            ],
        )
        for space in spaces
    ]


@router.get("/{space_id}", response_model=CafeSpaceResponse)
def get_space(
    space_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Get specific space"""
    space = db.exec(
        select(CafeSpace).where(CafeSpace.id == space_id)
    ).first()
    
    if not space or space.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Space not found")
    
    space_data = get_space_with_relations(space_id, db)
    return CafeSpaceResponse(**space_data)


@router.post("/", response_model=CafeSpaceResponse)
def create_space(
    space_data: CafeSpaceCreate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Create new space"""
    existing = db.exec(
        select(CafeSpace).where(
            CafeSpace.tenant_id == current_user.tenant_id,
            CafeSpace.code == space_data.code
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Space code already exists")
    
    new_space = CafeSpace(
        tenant_id=current_user.tenant_id,
        **space_data.model_dump(exclude={'translations', 'media_ids'})
    )
    
    db.add(new_space)
    db.commit()
    db.refresh(new_space)
    
    # Add translations
    for trans in space_data.translations:
        translation = CafeSpaceTranslation(
            space_id=new_space.id,
            locale=trans.locale,
            name=trans.name,
            description=trans.description
        )
        db.add(translation)
    
    # Add media
    if space_data.media_ids:
        for idx, media_id in enumerate(space_data.media_ids):
            space_media = CafeSpaceMedia(
                space_id=new_space.id,
                media_id=media_id,
                sort_order=idx
            )
            db.add(space_media)
    
    db.commit()
    
    space_name = next((trans.name for trans in space_data.translations if trans.name), new_space.code)
    log_user_activity(
        db,
        current_user,
        ActivityType.CREATE_PROPERTY,
        f'Space "{space_name}" created',
        resource_type="restaurant_space",
        resource_id=new_space.id,
        extra_details={"title": space_name, "code": new_space.code},
    )

    space_full = get_space_with_relations(new_space.id, db)
    return CafeSpaceResponse(**space_full)


@router.put("/{space_id}", response_model=CafeSpaceResponse)
def update_space(
    space_id: int,
    space_data: CafeSpaceUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Update space"""
    space = db.get(CafeSpace, space_id)
    
    if not space or space.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Space not found")
    
    for key, value in space_data.model_dump(
        exclude_unset=True,
        exclude={'translations', 'media_ids'}
    ).items():
        if value is not None:
            setattr(space, key, value)
            if key in ['amenities_json', 'attributes_json']:
                flag_modified(space, key)
    
    db.add(space)
    
    if space_data.translations is not None:
        for existing_trans in db.exec(
            select(CafeSpaceTranslation).where(CafeSpaceTranslation.space_id == space_id)
        ).all():
            db.delete(existing_trans)
        db.flush()
        
        for trans in space_data.translations:
            translation = CafeSpaceTranslation(
                space_id=space_id,
                locale=trans.locale,
                name=trans.name,
                description=trans.description
            )
            db.add(translation)
    
    if space_data.media_ids is not None:
        for existing_media in db.exec(
            select(CafeSpaceMedia).where(CafeSpaceMedia.space_id == space_id)
        ).all():
            db.delete(existing_media)
        db.flush()
        
        for idx, media_id in enumerate(space_data.media_ids):
            space_media = CafeSpaceMedia(
                space_id=space_id,
                media_id=media_id,
                sort_order=idx
            )
            db.add(space_media)
    
    db.commit()
    
    space_name = next(
        (trans.name for trans in (space_data.translations or []) if trans.name),
        space.code,
    )
    log_user_activity(
        db,
        current_user,
        ActivityType.UPDATE_PROPERTY,
        f'Space "{space_name}" updated',
        resource_type="restaurant_space",
        resource_id=space_id,
        extra_details={"title": space_name, "code": space.code},
    )

    space_full = get_space_with_relations(space_id, db)
    return CafeSpaceResponse(**space_full)


@router.delete("/{space_id}")
def delete_space(
    space_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Delete space"""
    space = db.get(CafeSpace, space_id)
    
    if not space or space.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Space not found")
    
    space_name = space.code

    for existing_trans in db.exec(
        select(CafeSpaceTranslation).where(CafeSpaceTranslation.space_id == space_id)
    ).all():
        db.delete(existing_trans)

    for existing_media in db.exec(
        select(CafeSpaceMedia).where(CafeSpaceMedia.space_id == space_id)
    ).all():
        db.delete(existing_media)

    db.flush()
    db.delete(space)
    db.commit()

    log_user_activity(
        db,
        current_user,
        ActivityType.DELETE_PROPERTY,
        f'Space "{space_name}" deleted',
        resource_type="restaurant_space",
        resource_id=space_id,
        extra_details={"title": space_name, "code": space.code},
    )
    
    return {"success": True, "message": "Space deleted"}


@router.post("/reorder")
def reorder_spaces(
    space_ids: List[int],
    current_user: CurrentUser,
    db: SessionDep
):
    """Reorder spaces"""
    for idx, space_id in enumerate(space_ids):
        space = db.get(CafeSpace, space_id)
        if space and space.tenant_id == current_user.tenant_id:
            space.display_order = idx
            db.add(space)
    
    db.commit()
    return {"success": True, "message": "Spaces reordered"}




