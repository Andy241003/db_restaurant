"""
Restaurant Promotions API endpoints.

Handles restaurant promotions and special offers with multi-language support
"""
from typing import Optional, List, Any
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
    CafePromotion,
    CafePromotionTranslation,
    CafePromotionMedia,
    PromotionType
)
from app.utils.activity_logger import log_user_activity

router = APIRouter()


# ==========================================
# Pydantic Schemas
# ==========================================

class PromotionTranslationSchema(BaseModel):
    """Promotion translation schema"""
    locale: str
    title: str
    description: Optional[str] = None
    terms_and_conditions: Optional[str] = None


class PromotionMediaSchema(BaseModel):
    """Promotion media schema"""
    media_id: int
    is_primary: bool = False
    sort_order: int = 0


class CafePromotionResponse(BaseModel):
    """Restaurant Promotion Response"""
    id: int
    tenant_id: int
    code: str
    promotion_type: str = "percentage"
    discount_value: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    applicable_menu_items: Optional[Any] = None
    applicable_categories: Optional[Any] = None
    applicable_branches: Optional[Any] = None
    min_purchase_amount: Optional[float] = None
    primary_image_media_id: Optional[int] = None
    is_active: bool = True
    is_featured: bool = False
    display_order: int = 0
    attributes_json: Optional[Any] = None
    translations: List[PromotionTranslationSchema] = []
    media: List[PromotionMediaSchema] = []


class CafePromotionCreate(BaseModel):
    """Restaurant Promotion Create"""
    code: str
    promotion_type: str = "percentage"
    discount_value: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    applicable_menu_items: Optional[Any] = None
    applicable_categories: Optional[Any] = None
    applicable_branches: Optional[Any] = None
    min_purchase_amount: Optional[float] = None
    primary_image_media_id: Optional[int] = None
    is_active: bool = True
    is_featured: bool = False
    display_order: int = 0
    attributes_json: Optional[Any] = None
    translations: List[PromotionTranslationSchema]
    media_ids: Optional[List[int]] = None


class CafePromotionUpdate(BaseModel):
    """Restaurant Promotion Update"""
    code: Optional[str] = None
    promotion_type: Optional[str] = None
    discount_value: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    applicable_menu_items: Optional[Any] = None
    applicable_categories: Optional[Any] = None
    applicable_branches: Optional[Any] = None
    min_purchase_amount: Optional[float] = None
    primary_image_media_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    display_order: Optional[int] = None
    attributes_json: Optional[Any] = None
    translations: Optional[List[PromotionTranslationSchema]] = None
    media_ids: Optional[List[int]] = None


# ==========================================
# Helper Functions
# ==========================================

def get_promotion_with_relations(promotion_id: int, db: Session) -> dict:
    """Get promotion with all relations"""
    statement = (
        select(CafePromotion)
        .where(CafePromotion.id == promotion_id)
        .options(
            selectinload(CafePromotion.translations),
            selectinload(CafePromotion.media),
        )
    )
    promotion = db.exec(statement).first()
    if not promotion:
        return None
    
    return {
        **promotion.model_dump(),
        "translations": [
            PromotionTranslationSchema(
                locale=t.locale,
                title=t.title,
                description=t.description,
                terms_and_conditions=t.terms_and_conditions
            ) for t in promotion.translations
        ],
        "media": [
            PromotionMediaSchema(
                media_id=m.media_id,
                is_primary=m.is_primary,
                sort_order=m.sort_order
            ) for m in sorted(promotion.media, key=lambda media_row: media_row.sort_order)
        ]
    }


# ==========================================
# API Endpoints
# ==========================================

@router.get("/", response_model=List[CafePromotionResponse])
def get_promotions(
    current_user: CurrentUser,
    db: SessionDep,
    is_active: Optional[bool] = None,
    is_featured: Optional[bool] = None
):
    """Get all promotions"""
    statement = select(CafePromotion).where(
        CafePromotion.tenant_id == current_user.tenant_id
    )
    
    if is_active is not None:
        statement = statement.where(CafePromotion.is_active == is_active)
    
    if is_featured is not None:
        statement = statement.where(CafePromotion.is_featured == is_featured)
    
    statement = statement.options(
        selectinload(CafePromotion.translations),
        selectinload(CafePromotion.media),
    )
    statement = statement.order_by(CafePromotion.display_order)
    promotions = db.exec(statement).all()

    return [
        CafePromotionResponse(
            id=promotion.id,
            tenant_id=promotion.tenant_id,
            code=promotion.code,
            promotion_type=promotion.promotion_type,
            discount_value=promotion.discount_value,
            start_date=promotion.start_date,
            end_date=promotion.end_date,
            applicable_menu_items=promotion.applicable_menu_items,
            applicable_categories=promotion.applicable_categories,
            applicable_branches=promotion.applicable_branches,
            min_purchase_amount=promotion.min_purchase_amount,
            primary_image_media_id=promotion.primary_image_media_id,
            is_active=promotion.is_active,
            is_featured=promotion.is_featured,
            display_order=promotion.display_order,
            attributes_json=promotion.attributes_json,
            translations=[
                PromotionTranslationSchema(
                    locale=t.locale,
                    title=t.title,
                    description=t.description,
                    terms_and_conditions=t.terms_and_conditions,
                ) for t in promotion.translations
            ],
            media=[
                PromotionMediaSchema(
                    media_id=m.media_id,
                    is_primary=m.is_primary,
                    sort_order=m.sort_order,
                ) for m in sorted(promotion.media, key=lambda media_row: media_row.sort_order)
            ],
        )
        for promotion in promotions
    ]


@router.get("/{promotion_id}", response_model=CafePromotionResponse)
def get_promotion(
    promotion_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Get specific promotion"""
    promotion = db.exec(
        select(CafePromotion).where(CafePromotion.id == promotion_id)
    ).first()
    
    if not promotion or promotion.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    promo_data = get_promotion_with_relations(promotion_id, db)
    return CafePromotionResponse(**promo_data)


@router.post("/", response_model=CafePromotionResponse)
def create_promotion(
    promo_data: CafePromotionCreate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Create new promotion"""
    existing = db.exec(
        select(CafePromotion).where(
            CafePromotion.tenant_id == current_user.tenant_id,
            CafePromotion.code == promo_data.code
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Promotion code already exists")
    
    new_promo = CafePromotion(
        tenant_id=current_user.tenant_id,
        **promo_data.model_dump(exclude={'translations', 'media_ids'})
    )
    
    db.add(new_promo)
    db.commit()
    db.refresh(new_promo)
    
    # Add translations
    for trans in promo_data.translations:
        translation = CafePromotionTranslation(
            promotion_id=new_promo.id,
            locale=trans.locale,
            title=trans.title,
            description=trans.description,
            terms_and_conditions=trans.terms_and_conditions
        )
        db.add(translation)
    
    # Add media
    if promo_data.media_ids:
        for idx, media_id in enumerate(promo_data.media_ids):
            promo_media = CafePromotionMedia(
                promotion_id=new_promo.id,
                media_id=media_id,
                sort_order=idx
            )
            db.add(promo_media)
    
    db.commit()
    
    promo_title = next((trans.title for trans in promo_data.translations if trans.title), new_promo.code)
    log_user_activity(
        db,
        current_user,
        ActivityType.CREATE_POST,
        f'Promotion "{promo_title}" created',
        resource_type="restaurant_promotion",
        resource_id=new_promo.id,
        extra_details={"title": promo_title, "code": new_promo.code},
    )

    promo_full = get_promotion_with_relations(new_promo.id, db)
    return CafePromotionResponse(**promo_full)


@router.put("/{promotion_id}", response_model=CafePromotionResponse)
def update_promotion(
    promotion_id: int,
    promo_data: CafePromotionUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Update promotion"""
    promotion = db.get(CafePromotion, promotion_id)
    
    if not promotion or promotion.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    for key, value in promo_data.model_dump(
        exclude_unset=True,
        exclude={'translations', 'media_ids'}
    ).items():
        if value is not None:
            setattr(promotion, key, value)
            if key in ['applicable_menu_items', 'applicable_categories', 'applicable_branches', 'attributes_json']:
                flag_modified(promotion, key)
    
    db.add(promotion)
    
    if promo_data.translations is not None:
        for existing_trans in db.exec(
            select(CafePromotionTranslation).where(
                CafePromotionTranslation.promotion_id == promotion_id
            )
        ).all():
            db.delete(existing_trans)

        db.flush()


        for trans in promo_data.translations:
            translation = CafePromotionTranslation(
                promotion_id=promotion_id,
                locale=trans.locale,
                title=trans.title,
                description=trans.description,
                terms_and_conditions=trans.terms_and_conditions
            )
            db.add(translation)
    
    if promo_data.media_ids is not None:
        for existing_media in db.exec(
            select(CafePromotionMedia).where(CafePromotionMedia.promotion_id == promotion_id)
        ).all():
            db.delete(existing_media)

        db.flush()


        for idx, media_id in enumerate(promo_data.media_ids):
            promo_media = CafePromotionMedia(
                promotion_id=promotion_id,
                media_id=media_id,
                sort_order=idx
            )
            db.add(promo_media)
    
    db.commit()
    
    promo_title = next(
        (trans.title for trans in (promo_data.translations or []) if trans.title),
        promotion.code,
    )
    log_user_activity(
        db,
        current_user,
        ActivityType.UPDATE_POST,
        f'Promotion "{promo_title}" updated',
        resource_type="restaurant_promotion",
        resource_id=promotion_id,
        extra_details={"title": promo_title, "code": promotion.code},
    )

    promo_full = get_promotion_with_relations(promotion_id, db)
    return CafePromotionResponse(**promo_full)


@router.delete("/{promotion_id}")
def delete_promotion(
    promotion_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Delete promotion"""
    promotion = db.get(CafePromotion, promotion_id)
    
    if not promotion or promotion.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Promotion not found")
    
    promo_title = promotion.code

    for existing_trans in db.exec(
        select(CafePromotionTranslation).where(
            CafePromotionTranslation.promotion_id == promotion_id
        )
    ).all():
        db.delete(existing_trans)

    for existing_media in db.exec(
        select(CafePromotionMedia).where(
            CafePromotionMedia.promotion_id == promotion_id
        )
    ).all():
        db.delete(existing_media)

    db.flush()
    db.delete(promotion)
    db.commit()

    log_user_activity(
        db,
        current_user,
        ActivityType.DELETE_POST,
        f'Promotion "{promo_title}" deleted',
        resource_type="restaurant_promotion",
        resource_id=promotion_id,
        extra_details={"title": promo_title, "code": promotion.code},
    )
    
    return {"success": True, "message": "Promotion deleted"}




