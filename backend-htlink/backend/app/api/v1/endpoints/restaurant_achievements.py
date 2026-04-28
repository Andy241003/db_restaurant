"""
Restaurant Achievements API endpoints.

Handles restaurant achievements with multi-language support.
"""
from typing import Optional, List
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from app.api.deps import CurrentUser, SessionDep
from app.models.activity_log import ActivityType
from app.models.restaurant import (
    CafeAchievement,
    CafeAchievementTranslation,
    CafeAchievementMedia,
)
from app.utils.activity_logger import log_user_activity

router = APIRouter()


class AchievementTranslationSchema(BaseModel):
    locale: str
    title: str
    description: Optional[str] = None


class AchievementMediaSchema(BaseModel):
    media_id: int
    is_primary: bool = False
    sort_order: int = 0


class CafeAchievementResponse(BaseModel):
    id: int
    tenant_id: int
    code: str
    achievement_type: Optional[str] = None
    issuer: Optional[str] = None
    awarded_at: Optional[date] = None
    location_text: Optional[str] = None
    reference_url: Optional[str] = None
    primary_image_media_id: Optional[int] = None
    is_active: bool = True
    is_featured: bool = False
    display_order: int = 0
    attributes_json: Optional[dict] = None
    translations: List[AchievementTranslationSchema] = []
    media: List[AchievementMediaSchema] = []


class CafeAchievementCreate(BaseModel):
    code: str
    achievement_type: Optional[str] = None
    issuer: Optional[str] = None
    awarded_at: Optional[date] = None
    location_text: Optional[str] = None
    reference_url: Optional[str] = None
    primary_image_media_id: Optional[int] = None
    is_active: bool = True
    is_featured: bool = False
    display_order: int = 0
    attributes_json: Optional[dict] = None
    translations: List[AchievementTranslationSchema]
    media_ids: Optional[List[int]] = None


class CafeAchievementUpdate(BaseModel):
    code: Optional[str] = None
    achievement_type: Optional[str] = None
    issuer: Optional[str] = None
    awarded_at: Optional[date] = None
    location_text: Optional[str] = None
    reference_url: Optional[str] = None
    primary_image_media_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    display_order: Optional[int] = None
    attributes_json: Optional[dict] = None
    translations: Optional[List[AchievementTranslationSchema]] = None
    media_ids: Optional[List[int]] = None


def get_achievement_with_relations(achievement_id: int, db: Session) -> Optional[dict]:
    statement = (
        select(CafeAchievement)
        .where(CafeAchievement.id == achievement_id)
        .options(
            selectinload(CafeAchievement.translations),
            selectinload(CafeAchievement.media),
        )
    )
    achievement = db.exec(statement).first()
    if not achievement:
        return None

    return {
        **achievement.model_dump(),
        "translations": [
            AchievementTranslationSchema(
                locale=t.locale,
                title=t.title,
                description=t.description,
            )
            for t in achievement.translations
        ],
        "media": [
            AchievementMediaSchema(
                media_id=m.media_id,
                is_primary=m.is_primary,
                sort_order=m.sort_order,
            )
            for m in sorted(achievement.media, key=lambda media_row: media_row.sort_order)
        ],
    }


@router.get("/", response_model=List[CafeAchievementResponse])
def get_achievements(
    current_user: CurrentUser,
    db: SessionDep,
    is_active: Optional[bool] = None,
    is_featured: Optional[bool] = None,
    achievement_type: Optional[str] = None,
):
    """Get all achievements."""
    statement = select(CafeAchievement).where(
        CafeAchievement.tenant_id == current_user.tenant_id
    )

    if is_active is not None:
        statement = statement.where(CafeAchievement.is_active == is_active)

    if is_featured is not None:
        statement = statement.where(CafeAchievement.is_featured == is_featured)

    if achievement_type:
        statement = statement.where(CafeAchievement.achievement_type == achievement_type)

    statement = statement.options(
        selectinload(CafeAchievement.translations),
        selectinload(CafeAchievement.media),
    )
    statement = statement.order_by(CafeAchievement.display_order, CafeAchievement.awarded_at.desc())
    achievements = db.exec(statement).all()

    return [
        CafeAchievementResponse(
            id=achievement.id,
            tenant_id=achievement.tenant_id,
            code=achievement.code,
            achievement_type=achievement.achievement_type,
            issuer=achievement.issuer,
            awarded_at=achievement.awarded_at,
            location_text=achievement.location_text,
            reference_url=achievement.reference_url,
            primary_image_media_id=achievement.primary_image_media_id,
            is_active=achievement.is_active,
            is_featured=achievement.is_featured,
            display_order=achievement.display_order,
            attributes_json=achievement.attributes_json,
            translations=[
                AchievementTranslationSchema(
                    locale=t.locale,
                    title=t.title,
                    description=t.description,
                )
                for t in achievement.translations
            ],
            media=[
                AchievementMediaSchema(
                    media_id=m.media_id,
                    is_primary=m.is_primary,
                    sort_order=m.sort_order,
                )
                for m in sorted(achievement.media, key=lambda media_row: media_row.sort_order)
            ],
        )
        for achievement in achievements
    ]


@router.get("/{achievement_id}", response_model=CafeAchievementResponse)
def get_achievement(
    achievement_id: int,
    current_user: CurrentUser,
    db: SessionDep,
):
    """Get a specific achievement."""
    achievement = db.exec(
        select(CafeAchievement).where(CafeAchievement.id == achievement_id)
    ).first()

    if not achievement or achievement.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Achievement not found")

    achievement_data = get_achievement_with_relations(achievement_id, db)
    return CafeAchievementResponse(**achievement_data)


@router.post("/", response_model=CafeAchievementResponse)
def create_achievement(
    achievement_data: CafeAchievementCreate,
    current_user: CurrentUser,
    db: SessionDep,
):
    """Create a new achievement."""
    existing = db.exec(
        select(CafeAchievement).where(
            CafeAchievement.tenant_id == current_user.tenant_id,
            CafeAchievement.code == achievement_data.code,
        )
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Achievement code already exists")

    new_achievement = CafeAchievement(
        tenant_id=current_user.tenant_id,
        **achievement_data.model_dump(exclude={"translations", "media_ids"}),
    )

    db.add(new_achievement)
    db.commit()
    db.refresh(new_achievement)

    for trans in achievement_data.translations:
        db.add(
            CafeAchievementTranslation(
                achievement_id=new_achievement.id,
                locale=trans.locale,
                title=trans.title,
                description=trans.description,
            )
        )

    if achievement_data.media_ids:
        for idx, media_id in enumerate(achievement_data.media_ids):
            db.add(
                CafeAchievementMedia(
                    achievement_id=new_achievement.id,
                    media_id=media_id,
                    sort_order=idx,
                )
            )

    db.commit()

    achievement_title = next(
        (trans.title for trans in achievement_data.translations if trans.title),
        new_achievement.code,
    )
    log_user_activity(
        db,
        current_user,
        ActivityType.CREATE_POST,
        f'Achievement "{achievement_title}" created',
        resource_type="restaurant_achievement",
        resource_id=new_achievement.id,
        extra_details={"title": achievement_title, "code": new_achievement.code},
    )

    achievement_full = get_achievement_with_relations(new_achievement.id, db)
    return CafeAchievementResponse(**achievement_full)


@router.put("/{achievement_id}", response_model=CafeAchievementResponse)
def update_achievement(
    achievement_id: int,
    achievement_data: CafeAchievementUpdate,
    current_user: CurrentUser,
    db: SessionDep,
):
    """Update an achievement."""
    achievement = db.get(CafeAchievement, achievement_id)

    if not achievement or achievement.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Achievement not found")

    for key, value in achievement_data.model_dump(
        exclude_unset=True,
        exclude={"translations", "media_ids"},
    ).items():
        if value is not None:
            setattr(achievement, key, value)
            if key == "attributes_json":
                flag_modified(achievement, key)

    db.add(achievement)

    if achievement_data.translations is not None:
        for existing_trans in db.exec(
            select(CafeAchievementTranslation).where(
                CafeAchievementTranslation.achievement_id == achievement_id
            )
        ).all():
            db.delete(existing_trans)

        db.flush()

        for trans in achievement_data.translations:
            db.add(
                CafeAchievementTranslation(
                    achievement_id=achievement_id,
                    locale=trans.locale,
                    title=trans.title,
                    description=trans.description,
                )
            )

    if achievement_data.media_ids is not None:
        for existing_media in db.exec(
            select(CafeAchievementMedia).where(
                CafeAchievementMedia.achievement_id == achievement_id
            )
        ).all():
            db.delete(existing_media)

        db.flush()

        for idx, media_id in enumerate(achievement_data.media_ids):
            db.add(
                CafeAchievementMedia(
                    achievement_id=achievement_id,
                    media_id=media_id,
                    sort_order=idx,
                )
            )

    db.commit()

    achievement_title = next(
        (trans.title for trans in (achievement_data.translations or []) if trans.title),
        achievement.code,
    )
    log_user_activity(
        db,
        current_user,
        ActivityType.UPDATE_POST,
        f'Achievement "{achievement_title}" updated',
        resource_type="restaurant_achievement",
        resource_id=achievement_id,
        extra_details={"title": achievement_title, "code": achievement.code},
    )

    achievement_full = get_achievement_with_relations(achievement_id, db)
    return CafeAchievementResponse(**achievement_full)


@router.delete("/{achievement_id}")
def delete_achievement(
    achievement_id: int,
    current_user: CurrentUser,
    db: SessionDep,
):
    """Delete an achievement."""
    achievement = db.get(CafeAchievement, achievement_id)

    if not achievement or achievement.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Achievement not found")

    achievement_title = achievement.code

    for existing_trans in db.exec(
        select(CafeAchievementTranslation).where(
            CafeAchievementTranslation.achievement_id == achievement_id
        )
    ).all():
        db.delete(existing_trans)

    for existing_media in db.exec(
        select(CafeAchievementMedia).where(
            CafeAchievementMedia.achievement_id == achievement_id
        )
    ).all():
        db.delete(existing_media)

    db.flush()
    db.delete(achievement)
    db.commit()

    log_user_activity(
        db,
        current_user,
        ActivityType.DELETE_POST,
        f'Achievement "{achievement_title}" deleted',
        resource_type="restaurant_achievement",
        resource_id=achievement_id,
        extra_details={"title": achievement_title, "code": achievement.code},
    )

    return {"success": True, "message": "Achievement deleted"}
