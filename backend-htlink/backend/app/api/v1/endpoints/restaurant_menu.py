"""
Restaurant Menu API endpoints.

Handles restaurant menu categories and menu items with multi-language support
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
    CafeMenuCategory,
    CafeMenuCategoryTranslation,
    CafeMenuItem,
    CafeMenuItemTranslation,
    CafeMenuItemMedia,
    MenuItemStatus
)
from app.utils.activity_logger import log_user_activity

router = APIRouter()


# ==========================================
# Pydantic Schemas
# ==========================================

JsonObject = dict[str, Any]
JsonArray = list[Any]
JsonLike = JsonObject | JsonArray

class CategoryTranslationSchema(BaseModel):
    """Category translation schema"""
    locale: str
    name: str
    description: Optional[str] = None


class ItemTranslationSchema(BaseModel):
    """Item translation schema"""
    locale: str
    name: str
    description: Optional[str] = None
    ingredients: Optional[str] = None


class ItemMediaSchema(BaseModel):
    """Item media schema"""
    media_id: int
    is_primary: bool = False
    sort_order: int = 0


class MenuCategoryResponse(BaseModel):
    """Menu Category Response"""
    id: int
    code: str
    icon_media_id: Optional[int] = None
    display_order: int = 0
    is_active: bool = True
    translations: List[CategoryTranslationSchema] = []


class MenuCategoryCreate(BaseModel):
    """Menu Category Create"""
    code: str
    icon_media_id: Optional[int] = None
    display_order: int = 0
    is_active: bool = True
    translations: List[CategoryTranslationSchema]


class MenuCategoryUpdate(BaseModel):
    """Menu Category Update"""
    code: Optional[str] = None
    icon_media_id: Optional[int] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    translations: Optional[List[CategoryTranslationSchema]] = None


class MenuItemResponse(BaseModel):
    """Menu Item Response"""
    id: int
    category_id: int
    code: str
    price: Optional[float] = None
    original_price: Optional[float] = None
    status: str = "available"
    sizes: Optional[JsonLike] = None
    tags: Optional[JsonLike] = None
    calories: Optional[int] = None
    primary_image_media_id: Optional[int] = None
    is_bestseller: bool = False
    is_new: bool = False
    is_seasonal: bool = False
    display_order: int = 0
    attributes_json: Optional[dict] = None
    translations: List[ItemTranslationSchema] = []
    media: List[ItemMediaSchema] = []


class MenuItemCreate(BaseModel):
    """Menu Item Create"""
    category_id: int
    code: str
    price: Optional[float] = None
    original_price: Optional[float] = None
    status: str = "available"
    sizes: Optional[JsonLike] = None
    tags: Optional[JsonLike] = None
    calories: Optional[int] = None
    primary_image_media_id: Optional[int] = None
    is_bestseller: bool = False
    is_new: bool = False
    is_seasonal: bool = False
    display_order: int = 0
    attributes_json: Optional[dict] = None
    translations: List[ItemTranslationSchema]
    media_ids: Optional[List[int]] = None


class MenuItemUpdate(BaseModel):
    """Menu Item Update"""
    category_id: Optional[int] = None
    code: Optional[str] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    status: Optional[str] = None
    sizes: Optional[JsonLike] = None
    tags: Optional[JsonLike] = None
    calories: Optional[int] = None
    primary_image_media_id: Optional[int] = None
    is_bestseller: Optional[bool] = None
    is_new: Optional[bool] = None
    is_seasonal: Optional[bool] = None
    display_order: Optional[int] = None
    attributes_json: Optional[dict] = None
    translations: Optional[List[ItemTranslationSchema]] = None
    media_ids: Optional[List[int]] = None


# ==========================================
# Helper Functions
# ==========================================

def _ensure_unique_locales(translations: List[BaseModel], entity_name: str) -> None:
    locales = [translation.locale for translation in translations]
    duplicate_locales = sorted({locale for locale in locales if locales.count(locale) > 1})
    if duplicate_locales:
        duplicate_text = ", ".join(duplicate_locales)
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate translation locales for {entity_name}: {duplicate_text}",
        )

def get_category_with_translations(category_id: int, db: Session) -> dict:
    """Get category with translations"""
    category = db.get(CafeMenuCategory, category_id)
    if not category:
        return None
    
    trans_stmt = select(CafeMenuCategoryTranslation).where(
        CafeMenuCategoryTranslation.category_id == category_id
    )
    translations = db.exec(trans_stmt).all()
    
    return {
        **category.model_dump(),
        "translations": [
            CategoryTranslationSchema(
                locale=t.locale,
                name=t.name,
                description=t.description
            ) for t in translations
        ]
    }


def get_item_with_relations(item_id: int, db: Session) -> dict:
    """Get menu item with all relations"""
    statement = (
        select(CafeMenuItem)
        .where(CafeMenuItem.id == item_id)
        .options(
            selectinload(CafeMenuItem.translations),
            selectinload(CafeMenuItem.media),
        )
    )
    item = db.exec(statement).first()
    if not item:
        return None
    
    return {
        **item.model_dump(),
        "translations": [
            ItemTranslationSchema(
                locale=t.locale,
                name=t.name,
                description=t.description,
                ingredients=t.ingredients
            ) for t in item.translations
        ],
        "media": [
            ItemMediaSchema(
                media_id=m.media_id,
                is_primary=m.is_primary,
                sort_order=m.sort_order
            ) for m in sorted(item.media, key=lambda media_row: media_row.sort_order)
        ]
    }


# ==========================================
# Category Endpoints
# ==========================================

@router.get("/categories", response_model=List[MenuCategoryResponse])
def get_categories(
    current_user: CurrentUser,
    db: SessionDep,
    is_active: Optional[bool] = None
):
    """Get all menu categories with translations in single query"""
    statement = select(CafeMenuCategory).where(
        CafeMenuCategory.tenant_id == current_user.tenant_id
    )
    
    if is_active is not None:
        statement = statement.where(CafeMenuCategory.is_active == is_active)
    
    # Use selectinload to avoid duplicate parent rows when loading collections
    statement = statement.options(selectinload(CafeMenuCategory.translations))
    statement = statement.order_by(CafeMenuCategory.display_order)
    categories = db.exec(statement).all()
    
    result = []
    for cat in categories:
        result.append(MenuCategoryResponse(
            id=cat.id,
            code=cat.code,
            icon_media_id=cat.icon_media_id,
            display_order=cat.display_order,
            is_active=cat.is_active,
            translations=[
                CategoryTranslationSchema(
                    locale=t.locale,
                    name=t.name,
                    description=t.description
                ) for t in cat.translations
            ]
        ))
    
    return result


@router.post("/categories", response_model=MenuCategoryResponse)
def create_category(
    category_data: MenuCategoryCreate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Create new menu category"""
    _ensure_unique_locales(category_data.translations, "category")

    # Check code uniqueness
    existing = db.exec(
        select(CafeMenuCategory).where(
            CafeMenuCategory.tenant_id == current_user.tenant_id,
            CafeMenuCategory.code == category_data.code
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Category code already exists")
    
    # Create category
    new_category = CafeMenuCategory(
        tenant_id=current_user.tenant_id,
        code=category_data.code,
        icon_media_id=category_data.icon_media_id,
        display_order=category_data.display_order,
        is_active=category_data.is_active
    )
    
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    
    # Add translations
    for trans in category_data.translations:
        translation = CafeMenuCategoryTranslation(
            category_id=new_category.id,
            locale=trans.locale,
            name=trans.name,
            description=trans.description
        )
        db.add(translation)
    
    db.commit()
    
    primary_name = next((trans.name for trans in category_data.translations if trans.name), category_data.code)
    log_user_activity(
        db,
        current_user,
        ActivityType.CREATE_CATEGORY,
        f'Menu category "{primary_name}" created',
        resource_type="restaurant_menu_category",
        resource_id=new_category.id,
        extra_details={"name": primary_name, "code": new_category.code},
    )

    cat_data = get_category_with_translations(new_category.id, db)
    return MenuCategoryResponse(**cat_data)


@router.put("/categories/{category_id}", response_model=MenuCategoryResponse)
def update_category(
    category_id: int,
    category_data: MenuCategoryUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Update menu category"""
    category = db.get(CafeMenuCategory, category_id)
    
    if not category or category.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Update fields
    for key, value in category_data.model_dump(exclude_unset=True, exclude={'translations'}).items():
        if value is not None:
            setattr(category, key, value)
    
    db.add(category)
    
    # Update translations
    if category_data.translations is not None:
        _ensure_unique_locales(category_data.translations, "category")

        # Delete existing
        for existing_trans in db.exec(
            select(CafeMenuCategoryTranslation).where(
                CafeMenuCategoryTranslation.category_id == category_id
            )
        ).all():
            db.delete(existing_trans)

        # Flush deletions before re-inserting the same locale keys
        db.flush()
        
        # Add new
        for trans in category_data.translations:
            translation = CafeMenuCategoryTranslation(
                category_id=category_id,
                locale=trans.locale,
                name=trans.name,
                description=trans.description
            )
            db.add(translation)
    
    db.commit()
    
    category_name = next(
        (trans.name for trans in (category_data.translations or []) if trans.name),
        category.code,
    )
    log_user_activity(
        db,
        current_user,
        ActivityType.UPDATE_CATEGORY,
        f'Menu category "{category_name}" updated',
        resource_type="restaurant_menu_category",
        resource_id=category_id,
        extra_details={"name": category_name, "code": category.code},
    )

    cat_data = get_category_with_translations(category_id, db)
    return MenuCategoryResponse(**cat_data)


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Delete category"""
    category = db.get(CafeMenuCategory, category_id)
    
    if not category or category.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    items = db.exec(
        select(CafeMenuItem).where(CafeMenuItem.category_id == category_id)
    ).all()

    for item in items:
        for item_translation in db.exec(
            select(CafeMenuItemTranslation).where(
                CafeMenuItemTranslation.item_id == item.id
            )
        ).all():
            db.delete(item_translation)

        for item_media in db.exec(
            select(CafeMenuItemMedia).where(
                CafeMenuItemMedia.item_id == item.id
            )
        ).all():
            db.delete(item_media)

        db.flush()
        db.delete(item)

    category_name = category.code
    translations = db.exec(
        select(CafeMenuCategoryTranslation).where(
            CafeMenuCategoryTranslation.category_id == category_id
        )
    ).all()

    for translation in translations:
        db.delete(translation)

    db.flush()
    db.delete(category)
    db.commit()

    log_user_activity(
        db,
        current_user,
        ActivityType.DELETE_CATEGORY,
        f'Menu category "{category_name}" deleted',
        resource_type="restaurant_menu_category",
        resource_id=category_id,
        extra_details={"name": category_name, "code": category.code},
    )
    
    return {"success": True, "message": "Category deleted"}


# ==========================================
# Menu Item Endpoints
# ==========================================

@router.get("/items", response_model=List[MenuItemResponse])
def get_menu_items(
    current_user: CurrentUser,
    db: SessionDep,
    category_id: Optional[int] = None,
    status: Optional[str] = None
):
    """Get all menu items"""
    statement = select(CafeMenuItem).where(
        CafeMenuItem.tenant_id == current_user.tenant_id
    )
    
    if category_id:
        statement = statement.where(CafeMenuItem.category_id == category_id)
    
    if status:
        statement = statement.where(CafeMenuItem.status == status)
    
    statement = statement.options(
        selectinload(CafeMenuItem.translations),
        selectinload(CafeMenuItem.media),
    )
    statement = statement.order_by(CafeMenuItem.display_order)
    items = db.exec(statement).all()
    
    return [
        MenuItemResponse(
            id=item.id,
            category_id=item.category_id,
            code=item.code,
            price=item.price,
            original_price=item.original_price,
            status=item.status,
            sizes=item.sizes,
            tags=item.tags,
            calories=item.calories,
            primary_image_media_id=item.primary_image_media_id,
            is_bestseller=item.is_bestseller,
            is_new=item.is_new,
            is_seasonal=item.is_seasonal,
            display_order=item.display_order,
            attributes_json=item.attributes_json,
            translations=[
                ItemTranslationSchema(
                    locale=t.locale,
                    name=t.name,
                    description=t.description,
                    ingredients=t.ingredients,
                ) for t in item.translations
            ],
            media=[
                ItemMediaSchema(
                    media_id=m.media_id,
                    is_primary=m.is_primary,
                    sort_order=m.sort_order,
                ) for m in sorted(item.media, key=lambda media_row: media_row.sort_order)
            ],
        )
        for item in items
    ]


@router.get("/items/{item_id}", response_model=MenuItemResponse)
def get_menu_item(
    item_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Get specific menu item"""
    item = db.exec(
        select(CafeMenuItem).where(CafeMenuItem.id == item_id)
    ).first()
    
    if not item or item.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    item_data = get_item_with_relations(item_id, db)
    return MenuItemResponse(**item_data)


@router.post("/items", response_model=MenuItemResponse)
def create_menu_item(
    item_data: MenuItemCreate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Create new menu item"""
    _ensure_unique_locales(item_data.translations, "menu item")

    # Check code uniqueness
    existing = db.exec(
        select(CafeMenuItem).where(
            CafeMenuItem.tenant_id == current_user.tenant_id,
            CafeMenuItem.code == item_data.code
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Item code already exists")
    
    category = db.get(CafeMenuCategory, item_data.category_id)
    if not category or category.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Category not found")

    # Create item
    new_item = CafeMenuItem(
        tenant_id=current_user.tenant_id,
        category_id=item_data.category_id,
        code=item_data.code,
        price=item_data.price,
        original_price=item_data.original_price,
        status=item_data.status,
        sizes=item_data.sizes,
        tags=item_data.tags,
        calories=item_data.calories,
        primary_image_media_id=item_data.primary_image_media_id,
        is_bestseller=item_data.is_bestseller,
        is_new=item_data.is_new,
        is_seasonal=item_data.is_seasonal,
        display_order=item_data.display_order,
        attributes_json=item_data.attributes_json
    )
    
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    
    # Add translations
    for trans in item_data.translations:
        translation = CafeMenuItemTranslation(
            item_id=new_item.id,
            locale=trans.locale,
            name=trans.name,
            description=trans.description,
            ingredients=trans.ingredients
        )
        db.add(translation)
    
    # Add media
    if item_data.media_ids:
        for idx, media_id in enumerate(item_data.media_ids):
            item_media = CafeMenuItemMedia(
                item_id=new_item.id,
                media_id=media_id,
                sort_order=idx
            )
            db.add(item_media)
    
    db.commit()
    
    item_name = next((trans.name for trans in item_data.translations if trans.name), item_data.code)
    log_user_activity(
        db,
        current_user,
        ActivityType.CREATE_POST,
        f'Menu item "{item_name}" created',
        resource_type="restaurant_menu_item",
        resource_id=new_item.id,
        extra_details={"title": item_name, "code": new_item.code},
    )

    item_full = get_item_with_relations(new_item.id, db)
    return MenuItemResponse(**item_full)


@router.put("/items/{item_id}", response_model=MenuItemResponse)
def update_menu_item(
    item_id: int,
    item_data: MenuItemUpdate,
    current_user: CurrentUser,
    db: SessionDep
):
    """Update menu item"""
    item = db.get(CafeMenuItem, item_id)
    
    if not item or item.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")

    if item_data.category_id is not None:
        category = db.get(CafeMenuCategory, item_data.category_id)
        if not category or category.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=404, detail="Category not found")
    
    # Update fields
    for key, value in item_data.model_dump(
        exclude_unset=True, 
        exclude={'translations', 'media_ids'}
    ).items():
        if value is not None:
            setattr(item, key, value)
            if key in ['sizes', 'tags', 'attributes_json']:
                flag_modified(item, key)
    
    db.add(item)
    
    # Update translations
    if item_data.translations is not None:
        _ensure_unique_locales(item_data.translations, "menu item")

        for existing_trans in db.exec(
            select(CafeMenuItemTranslation).where(
                CafeMenuItemTranslation.item_id == item_id
            )
        ).all():
            db.delete(existing_trans)

        # Flush deletions before re-inserting the same locale keys
        db.flush()
        
        for trans in item_data.translations:
            translation = CafeMenuItemTranslation(
                item_id=item_id,
                locale=trans.locale,
                name=trans.name,
                description=trans.description,
                ingredients=trans.ingredients
            )
            db.add(translation)
    
    # Update media
    if item_data.media_ids is not None:
        for existing_media in db.exec(
            select(CafeMenuItemMedia).where(CafeMenuItemMedia.item_id == item_id)
        ).all():
            db.delete(existing_media)

        # Flush old media rows before inserting replacements
        db.flush()
        
        for idx, media_id in enumerate(item_data.media_ids):
            item_media = CafeMenuItemMedia(
                item_id=item_id,
                media_id=media_id,
                sort_order=idx
            )
            db.add(item_media)
    
    db.commit()
    
    item_name = next(
        (trans.name for trans in (item_data.translations or []) if trans.name),
        item.code,
    )
    log_user_activity(
        db,
        current_user,
        ActivityType.UPDATE_POST,
        f'Menu item "{item_name}" updated',
        resource_type="restaurant_menu_item",
        resource_id=item_id,
        extra_details={"title": item_name, "code": item.code},
    )

    item_full = get_item_with_relations(item_id, db)
    return MenuItemResponse(**item_full)


@router.delete("/items/{item_id}")
def delete_menu_item(
    item_id: int,
    current_user: CurrentUser,
    db: SessionDep
):
    """Delete menu item"""
    item = db.get(CafeMenuItem, item_id)
    
    if not item or item.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    item_name = item.code

    for existing_trans in db.exec(
        select(CafeMenuItemTranslation).where(
            CafeMenuItemTranslation.item_id == item_id
        )
    ).all():
        db.delete(existing_trans)

    for existing_media in db.exec(
        select(CafeMenuItemMedia).where(
            CafeMenuItemMedia.item_id == item_id
        )
    ).all():
        db.delete(existing_media)

    db.flush()
    db.delete(item)
    db.commit()

    log_user_activity(
        db,
        current_user,
        ActivityType.DELETE_POST,
        f'Menu item "{item_name}" deleted',
        resource_type="restaurant_menu_item",
        resource_id=item_id,
        extra_details={"title": item_name, "code": item.code},
    )
    
    return {"success": True, "message": "Menu item deleted"}






