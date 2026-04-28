"""
Restaurant Content Sections API endpoints.

Handles content sections for Home/About pages with multi-language support
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
    CafeContentSection,
    CafeContentSectionTranslation
)
from app.utils.activity_logger import log_user_activity

router = APIRouter()


# ==========================================
# Pydantic Schemas
# ==========================================

class ContentSectionTranslationSchema(BaseModel):
    """Content section translation schema"""
    locale: str
    title: str
    description: Optional[str] = None
    content: Optional[str] = None


class CafeContentSectionResponse(BaseModel):
    """Restaurant Content Section Response"""
    id: int
    tenant_id: int
    section_type: str
    page_code: str
    icon: Optional[str] = None
    image_media_id: Optional[int] = None
    is_active: bool = True
    display_order: int = 0
    attributes_json: Optional[dict] = None
    translations: List[ContentSectionTranslationSchema] = []


class CafeContentSectionCreate(BaseModel):
    """Restaurant Content Section Create"""
    section_type: str
    page_code: str
    icon: Optional[str] = None
    image_media_id: Optional[int] = None
    is_active: bool = True
    display_order: int = 0
    attributes_json: Optional[dict] = None
    translations: List[ContentSectionTranslationSchema]


class CafeContentSectionUpdate(BaseModel):
    """Restaurant Content Section Update"""
    section_type: Optional[str] = None
    page_code: Optional[str] = None
    icon: Optional[str] = None
    image_media_id: Optional[int] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    attributes_json: Optional[dict] = None
    translations: Optional[List[ContentSectionTranslationSchema]] = None


# ==========================================
# Helper Functions
# ==========================================

def get_section_with_relations(section_id: int, db: Session) -> dict:
    """Get content section with all relations"""
    statement = (
        select(CafeContentSection)
        .where(CafeContentSection.id == section_id)
        .options(selectinload(CafeContentSection.translations))
    )
    section = db.exec(statement).first()
    if not section:
        return None
    
    return {
        **section.model_dump(),
        "translations": [
            ContentSectionTranslationSchema(
                locale=t.locale,
                title=t.title,
                description=t.description,
                content=t.content
            ) for t in section.translations
        ]
    }


# ==========================================
# API Endpoints
# ==========================================

@router.get("/", response_model=List[CafeContentSectionResponse])
def get_content_sections(
    current_user: CurrentUser,
    db: SessionDep,
    page_code: Optional[str] = None,
    section_type: Optional[str] = None,
    is_active: Optional[bool] = None
):
    """Get all content sections"""
    statement = select(CafeContentSection).where(
        CafeContentSection.tenant_id == current_user.tenant_id
    )
    
    if page_code:
        statement = statement.where(CafeContentSection.page_code == page_code)
    
    if section_type:
        statement = statement.where(CafeContentSection.section_type == section_type)
    
    if is_active is not None:
        statement = statement.where(CafeContentSection.is_active == is_active)
    
    statement = statement.options(selectinload(CafeContentSection.translations))
    statement = statement.order_by(CafeContentSection.page_code, CafeContentSection.display_order)
    sections = db.exec(statement).all()

    return [
        CafeContentSectionResponse(
            id=section.id,
            tenant_id=section.tenant_id,
            section_type=section.section_type,
            page_code=section.page_code,
            icon=section.icon,
            image_media_id=section.image_media_id,
            is_active=section.is_active,
            display_order=section.display_order,
            attributes_json=section.attributes_json,
            translations=[
                ContentSectionTranslationSchema(
                    locale=t.locale,
                    title=t.title,
                    description=t.description,
                    content=t.content,
                ) for t in section.translations
            ],
        )
        for section in sections
    ]


@router.get("/{section_id}", response_model=CafeContentSectionResponse)
def get_content_section(
    section_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Get specific content section"""
    section = db.exec(
        select(CafeContentSection).where(CafeContentSection.id == section_id)
    ).first()
    
    if not section or section.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Content section not found")
    
    section_data = get_section_with_relations(section_id, db)
    return CafeContentSectionResponse(**section_data)


@router.post("/", response_model=CafeContentSectionResponse)
def create_content_section(
    section_data: CafeContentSectionCreate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Create new content section"""
    new_section = CafeContentSection(
        tenant_id=current_user.tenant_id,
        **section_data.model_dump(exclude={'translations'})
    )
    
    db.add(new_section)
    db.commit()
    db.refresh(new_section)
    
    # Add translations
    for trans in section_data.translations:
        translation = CafeContentSectionTranslation(
            section_id=new_section.id,
            locale=trans.locale,
            title=trans.title,
            description=trans.description,
            content=trans.content
        )
        db.add(translation)
    
    db.commit()
    
    section_title = next((trans.title for trans in section_data.translations if trans.title), new_section.section_type)
    log_user_activity(
        db,
        current_user,
        ActivityType.CREATE_POST,
        f'Content section "{section_title}" created',
        resource_type="restaurant_content_section",
        resource_id=new_section.id,
        extra_details={"title": section_title, "page_code": new_section.page_code},
    )

    section_full = get_section_with_relations(new_section.id, db)
    return CafeContentSectionResponse(**section_full)


@router.put("/{section_id}", response_model=CafeContentSectionResponse)
def update_content_section(
    section_id: int,
    section_data: CafeContentSectionUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Update content section"""
    section = db.get(CafeContentSection, section_id)
    
    if not section or section.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Content section not found")
    
    for key, value in section_data.model_dump(
        exclude_unset=True,
        exclude={'translations'}
    ).items():
        if value is not None:
            setattr(section, key, value)
            if key == 'attributes_json':
                flag_modified(section, key)
    
    db.add(section)
    
    if section_data.translations is not None:
        # Delete all existing translations for this section
        delete_stmt = select(CafeContentSectionTranslation).where(
            CafeContentSectionTranslation.section_id == section_id
        )
        existing_translations = db.exec(delete_stmt).all()
        for trans in existing_translations:
            db.delete(trans)
        
        # Commit the deletes to avoid unique constraint conflicts
        db.commit()
        
        # Insert all translations fresh
        for trans_data in section_data.translations:
            translation = CafeContentSectionTranslation(
                section_id=section_id,
                locale=trans_data.locale,
                title=trans_data.title,
                description=trans_data.description,
                content=trans_data.content
            )
            db.add(translation)
    
    db.commit()
    
    section_title = next(
        (trans.title for trans in (section_data.translations or []) if trans.title),
        section.section_type,
    )
    log_user_activity(
        db,
        current_user,
        ActivityType.UPDATE_POST,
        f'Content section "{section_title}" updated',
        resource_type="restaurant_content_section",
        resource_id=section_id,
        extra_details={"title": section_title, "page_code": section.page_code},
    )

    section_full = get_section_with_relations(section_id, db)
    return CafeContentSectionResponse(**section_full)


@router.delete("/{section_id}")
def delete_content_section(
    section_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Delete content section"""
    section = db.get(CafeContentSection, section_id)
    
    if not section or section.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Content section not found")
    
    section_title = section.section_type

    for existing_trans in db.exec(
        select(CafeContentSectionTranslation).where(
            CafeContentSectionTranslation.section_id == section_id
        )
    ).all():
        db.delete(existing_trans)

    db.flush()
    db.delete(section)
    db.commit()

    log_user_activity(
        db,
        current_user,
        ActivityType.DELETE_POST,
        f'Content section "{section_title}" deleted',
        resource_type="restaurant_content_section",
        resource_id=section_id,
        extra_details={"title": section_title, "page_code": section.page_code},
    )
    
    return {"success": True, "message": "Content section deleted"}


@router.post("/reorder")
def reorder_content_sections(
    section_ids: List[int],
    current_user: CurrentUser,
    db: SessionDep
):
    """Reorder content sections"""
    for idx, section_id in enumerate(section_ids):
        section = db.get(CafeContentSection, section_id)
        if section and section.tenant_id == current_user.tenant_id:
            section.display_order = idx
            db.add(section)
    
    db.commit()
    return {"success": True, "message": "Content sections reordered"}




