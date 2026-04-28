"""
Restaurant Careers API endpoints.

Handles restaurant career/job postings with multi-language support
"""
from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.db import get_db
from app.api.deps import CurrentUser, SessionDep
from app.models.activity_log import ActivityType
from app.models.restaurant import (
    CafeCareer,
    CafeCareerMedia,
    CafeCareerTranslation,
    CareerStatus
)
from app.utils.activity_logger import log_user_activity

router = APIRouter()


# ==========================================
# Pydantic Schemas
# ==========================================

class CareerTranslationSchema(BaseModel):
    """Career translation schema"""
    locale: str
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    benefits: Optional[str] = None


class CafeCareerResponse(BaseModel):
    """Restaurant Career Response"""
    id: int
    tenant_id: int
    code: str
    job_type: Optional[str] = None
    experience_required: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_text: Optional[str] = None
    deadline: Optional[date] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    application_url: Optional[str] = None
    branch_id: Optional[int] = None
    primary_image_media_id: Optional[int] = None
    status: str = "open"
    display_order: int = 0
    is_urgent: bool = False
    attributes_json: Optional[dict] = None
    translations: List[CareerTranslationSchema] = []
    media_ids: List[int] = []


class CafeCareerCreate(BaseModel):
    """Restaurant Career Create"""
    code: str
    job_type: Optional[str] = None
    experience_required: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_text: Optional[str] = None
    deadline: Optional[date] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    application_url: Optional[str] = None
    branch_id: Optional[int] = None
    primary_image_media_id: Optional[int] = None
    status: str = "open"
    display_order: int = 0
    is_urgent: bool = False
    attributes_json: Optional[dict] = None
    translations: List[CareerTranslationSchema]
    media_ids: Optional[List[int]] = None


class CafeCareerUpdate(BaseModel):
    """Restaurant Career Update"""
    code: Optional[str] = None
    job_type: Optional[str] = None
    experience_required: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_text: Optional[str] = None
    deadline: Optional[date] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    application_url: Optional[str] = None
    branch_id: Optional[int] = None
    primary_image_media_id: Optional[int] = None
    status: Optional[str] = None
    display_order: Optional[int] = None
    is_urgent: Optional[bool] = None
    attributes_json: Optional[dict] = None
    translations: Optional[List[CareerTranslationSchema]] = None
    media_ids: Optional[List[int]] = None


# ==========================================
# Helper Functions
# ==========================================

def get_career_with_translations(career_id: int, db: Session) -> dict:
    """Get career with translations"""
    statement = (
        select(CafeCareer)
        .where(CafeCareer.id == career_id)
        .options(
            selectinload(CafeCareer.translations),
            selectinload(CafeCareer.media),
        )
    )
    career = db.exec(statement).first()
    if not career:
        return None
    
    return {
        "id": career.id,
        "tenant_id": career.tenant_id,
        "code": career.code,
        "job_type": career.job_type,
        "experience_required": career.experience_required,
        "salary_min": career.salary_min,
        "salary_max": career.salary_max,
        "salary_text": career.salary_text,
        "deadline": career.deadline,
        "contact_email": career.contact_email,
        "contact_phone": career.contact_phone,
        "application_url": career.application_url,
        "branch_id": career.branch_id,
        "primary_image_media_id": career.primary_image_media_id,
        "status": career.status,
        "display_order": career.display_order,
        "is_urgent": career.is_urgent,
        "attributes_json": career.attributes_json,
        "translations": [
            CareerTranslationSchema(
                locale=t.locale,
                title=t.title,
                description=t.description,
                requirements=t.requirements,
                benefits=t.benefits
            ) for t in career.translations
        ],
        "media_ids": [m.media_id for m in sorted(career.media, key=lambda media_row: media_row.sort_order)]
    }


# ==========================================
# API Endpoints
# ==========================================

@router.get("/", response_model=List[CafeCareerResponse])
def get_careers(
    current_user: CurrentUser,
    db: SessionDep,
    status: Optional[str] = None,
    is_urgent: Optional[bool] = None
):
    """Get all career postings"""
    statement = select(CafeCareer).where(
        CafeCareer.tenant_id == current_user.tenant_id
    )
    
    if status:
        statement = statement.where(CafeCareer.status == status)
    
    if is_urgent is not None:
        statement = statement.where(CafeCareer.is_urgent == is_urgent)
    
    statement = statement.options(
        selectinload(CafeCareer.translations),
        selectinload(CafeCareer.media),
    )
    statement = statement.order_by(CafeCareer.display_order)
    careers = db.exec(statement).all()

    return [
        CafeCareerResponse(**{
            "id": career.id,
            "tenant_id": career.tenant_id,
            "code": career.code,
            "job_type": career.job_type,
            "experience_required": career.experience_required,
            "salary_min": career.salary_min,
            "salary_max": career.salary_max,
            "salary_text": career.salary_text,
            "deadline": career.deadline,
            "contact_email": career.contact_email,
            "contact_phone": career.contact_phone,
            "application_url": career.application_url,
            "branch_id": career.branch_id,
            "primary_image_media_id": career.primary_image_media_id,
            "status": career.status,
            "display_order": career.display_order,
            "is_urgent": career.is_urgent,
            "attributes_json": career.attributes_json,
            "translations": [
                CareerTranslationSchema(
                    locale=t.locale,
                    title=t.title,
                    description=t.description,
                    requirements=t.requirements,
                    benefits=t.benefits,
                ) for t in career.translations
            ],
            "media_ids": [m.media_id for m in sorted(career.media, key=lambda media_row: media_row.sort_order)],
        })
        for career in careers
    ]


@router.get("/{career_id}", response_model=CafeCareerResponse)
def get_career(
    career_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Get specific career posting"""
    career = db.exec(
        select(CafeCareer).where(CafeCareer.id == career_id)
    ).first()
    
    if not career or career.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Career posting not found")
    
    career_data = get_career_with_translations(career_id, db)
    return CafeCareerResponse(**career_data)


@router.post("/", response_model=CafeCareerResponse)
def create_career(
    career_data: CafeCareerCreate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Create new career posting"""
    existing = db.exec(
        select(CafeCareer).where(
            CafeCareer.tenant_id == current_user.tenant_id,
            CafeCareer.code == career_data.code
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Career code already exists")
    
    new_career = CafeCareer(
        tenant_id=current_user.tenant_id,
        **career_data.model_dump(exclude={'translations', 'media_ids'})
    )
    
    # Convert empty strings to None for optional string fields
    for key, value in career_data.model_dump(exclude={'translations', 'media_ids'}).items():
        if isinstance(value, str) and value.strip() == "":
            setattr(new_career, key, None)
    
    db.add(new_career)
    db.commit()
    db.refresh(new_career)
    
    # Add translations
    for trans in career_data.translations:
        translation = CafeCareerTranslation(
            career_id=new_career.id,
            locale=trans.locale,
            title=trans.title,
            description=trans.description,
            requirements=trans.requirements,
            benefits=trans.benefits
        )
        db.add(translation)
    
    # Add media
    if career_data.media_ids:
        for idx, media_id in enumerate(career_data.media_ids):
            career_media = CafeCareerMedia(
                career_id=new_career.id,
                media_id=media_id,
                is_primary=(media_id == career_data.primary_image_media_id),
                sort_order=idx
            )
            db.add(career_media)
    
    db.commit()
    
    career_title = next((trans.title for trans in career_data.translations if trans.title), new_career.code)
    log_user_activity(
        db,
        current_user,
        ActivityType.CREATE_POST,
        f'Career "{career_title}" created',
        resource_type="restaurant_career",
        resource_id=new_career.id,
        extra_details={"title": career_title, "code": new_career.code},
    )

    career_full = get_career_with_translations(new_career.id, db)
    return CafeCareerResponse(**career_full)


@router.put("/{career_id}", response_model=CafeCareerResponse)
def update_career(
    career_id: int,
    career_data: CafeCareerUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Update career posting"""
    career = db.get(CafeCareer, career_id)
    
    if not career or career.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Career posting not found")
    
    for key, value in career_data.model_dump(
        exclude_unset=True,
        exclude={'translations', 'media_ids'}
    ).items():
        if value is not None:
            # Convert empty strings to None for optional string fields
            if isinstance(value, str) and value.strip() == "":
                value = None
            setattr(career, key, value)
            if key == 'attributes_json':
                flag_modified(career, key)
    
    db.add(career)
    
    if career_data.translations is not None:
        for existing_trans in db.exec(
            select(CafeCareerTranslation).where(CafeCareerTranslation.career_id == career_id)
        ).all():
            db.delete(existing_trans)

        db.flush()
        
        for trans in career_data.translations:
            translation = CafeCareerTranslation(
                career_id=career_id,
                locale=trans.locale,
                title=trans.title,
                description=trans.description,
                requirements=trans.requirements,
                benefits=trans.benefits
            )
            db.add(translation)
    
    if career_data.media_ids is not None:
        # Delete existing media
        for existing_media in db.exec(
            select(CafeCareerMedia).where(CafeCareerMedia.career_id == career_id)
        ).all():
            db.delete(existing_media)

        db.flush()
        
        # Add new media
        for idx, media_id in enumerate(career_data.media_ids):
            career_media = CafeCareerMedia(
                career_id=career_id,
                media_id=media_id,
                is_primary=(media_id == career_data.primary_image_media_id),
                sort_order=idx
            )
            db.add(career_media)
    
    db.commit()
    
    career_title = next(
        (trans.title for trans in (career_data.translations or []) if trans.title),
        career.code,
    )
    log_user_activity(
        db,
        current_user,
        ActivityType.UPDATE_POST,
        f'Career "{career_title}" updated',
        resource_type="restaurant_career",
        resource_id=career_id,
        extra_details={"title": career_title, "code": career.code},
    )

    career_full = get_career_with_translations(career_id, db)
    return CafeCareerResponse(**career_full)


@router.delete("/{career_id}")
def delete_career(
    career_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Delete career posting"""
    career = db.get(CafeCareer, career_id)
    
    if not career or career.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Career posting not found")
    
    career_title = career.code

    for existing_trans in db.exec(
        select(CafeCareerTranslation).where(CafeCareerTranslation.career_id == career_id)
    ).all():
        db.delete(existing_trans)

    for existing_media in db.exec(
        select(CafeCareerMedia).where(CafeCareerMedia.career_id == career_id)
    ).all():
        db.delete(existing_media)

    db.flush()
    db.delete(career)
    db.commit()

    log_user_activity(
        db,
        current_user,
        ActivityType.DELETE_POST,
        f'Career "{career_title}" deleted',
        resource_type="restaurant_career",
        resource_id=career_id,
        extra_details={"title": career_title, "code": career.code},
    )
    
    return {"success": True, "message": "Career posting deleted"}




