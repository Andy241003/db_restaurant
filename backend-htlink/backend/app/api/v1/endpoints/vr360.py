from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models.restaurant import CafePageSettings, CafeSettings, VR360Scene
from app.utils.vr360 import (
    build_grouped_section_settings,
    build_section_vr360_payload,
    get_section_config,
    get_supported_section_codes,
    normalize_section_update_payload,
    persist_vr360_section_settings,
)

router = APIRouter()


class VR360SceneResponse(BaseModel):
    target_id: str
    scene_name: str
    scene_subtitle: Optional[str] = None
    panorama_url: Optional[str] = None
    display_order: int = 0
    is_active: bool = True


class VR360SyncSceneInput(BaseModel):
    id: str
    name: str
    subtitle: Optional[str] = None
    panorama_url: Optional[str] = None
    order: Optional[int] = None


class VR360SyncRequest(BaseModel):
    tenant_code: Optional[str] = None
    scenes: list[VR360SyncSceneInput]


class VR360SyncResponse(BaseModel):
    tenant_id: int
    created: int
    updated: int
    deactivated: int
    scenes: list[VR360SceneResponse]


class VR360SectionSettings(BaseModel):
    target_id: Optional[str] = None
    panorama_url: Optional[str] = None
    vr360_link: Optional[str] = None
    vr_title: Optional[str] = None
    title_translations: dict[str, str] = Field(default_factory=dict)


class VR360SettingsResponse(BaseModel):
    scenes: list[VR360SceneResponse]
    sections: dict[str, VR360SectionSettings]


def _scene_to_response(scene: VR360Scene) -> VR360SceneResponse:
    return VR360SceneResponse(
        target_id=scene.scene_id,
        scene_name=scene.scene_name,
        scene_subtitle=scene.scene_subtitle,
        panorama_url=scene.panorama_url,
        display_order=scene.display_order,
        is_active=scene.is_active,
    )


def _ordered_scenes(db: SessionDep, tenant_id: int) -> list[VR360Scene]:
    return list(
        db.exec(
            select(VR360Scene)
            .where(VR360Scene.tenant_id == tenant_id)
            .order_by(VR360Scene.display_order, VR360Scene.id)
        ).all()
    )


def _get_restaurant_settings_record(db: SessionDep, tenant_id: int) -> CafeSettings | None:
    return db.exec(select(CafeSettings).where(CafeSettings.tenant_id == tenant_id).limit(1)).first()


def _get_page_settings_records(db: SessionDep, tenant_id: int) -> list[CafePageSettings]:
    return list(
        db.exec(
            select(CafePageSettings)
            .where(CafePageSettings.tenant_id == tenant_id)
            .order_by(CafePageSettings.page_code)
        ).all()
    )


def _get_page_settings_record(
    db: SessionDep,
    tenant_id: int,
    page_code: str,
) -> CafePageSettings | None:
    return db.exec(
        select(CafePageSettings).where(
            CafePageSettings.tenant_id == tenant_id,
            CafePageSettings.page_code == page_code,
        )
    ).first()


def _resolve_tenant_id(
    db: SessionDep,
    current_user: CurrentUser,
    tenant_code: Optional[str],
) -> int:
    if not tenant_code:
        return current_user.tenant_id

    tenant = crud.tenant.get_by_code(db, code=tenant_code)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    user_role = (current_user.role or "").upper()
    if user_role != "OWNER" and current_user.tenant_id != tenant.id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")

    return tenant.id


def _load_scene_lookup(
    db: SessionDep,
    tenant_id: int,
) -> tuple[list[VR360Scene], dict[int, VR360Scene], dict[str, VR360Scene]]:
    scenes = _ordered_scenes(db, tenant_id)
    scenes_by_id = {scene.id: scene for scene in scenes if scene.id is not None}
    scenes_by_scene_id = {scene.scene_id: scene for scene in scenes}
    return scenes, scenes_by_id, scenes_by_scene_id


@router.get("/scenes", response_model=list[VR360SceneResponse])
def get_vr360_scenes(
    current_user: CurrentUser,
    db: SessionDep,
):
    scenes = _ordered_scenes(db, current_user.tenant_id)
    return [_scene_to_response(scene) for scene in scenes]


@router.post("/scenes/sync", response_model=VR360SyncResponse)
def sync_vr360_scenes(
    payload: VR360SyncRequest,
    current_user: CurrentUser,
    db: SessionDep,
):
    tenant_id = _resolve_tenant_id(db, current_user, payload.tenant_code)

    existing_scenes = _ordered_scenes(db, tenant_id)
    existing_by_scene_id = {scene.scene_id: scene for scene in existing_scenes}
    incoming_scene_ids: set[str] = set()

    created = 0
    updated = 0
    deactivated = 0

    for fallback_order, raw_scene in enumerate(payload.scenes):
        scene_id = raw_scene.id.strip()
        if not scene_id:
            raise HTTPException(status_code=400, detail="Scene id must not be empty")

        incoming_scene_ids.add(scene_id)
        display_order = raw_scene.order if raw_scene.order is not None else fallback_order

        scene = existing_by_scene_id.get(scene_id)
        if scene:
            changed = False
            updates: dict[str, Any] = {
                "scene_name": raw_scene.name,
                "scene_subtitle": raw_scene.subtitle,
                "panorama_url": raw_scene.panorama_url,
                "display_order": display_order,
                "is_active": True,
            }
            for field_name, value in updates.items():
                if getattr(scene, field_name) != value:
                    setattr(scene, field_name, value)
                    changed = True
            if changed:
                db.add(scene)
                updated += 1
            continue

        db.add(
            VR360Scene(
                tenant_id=tenant_id,
                property_id=None,
                scene_id=scene_id,
                scene_name=raw_scene.name,
                scene_subtitle=raw_scene.subtitle,
                panorama_url=raw_scene.panorama_url,
                display_order=display_order,
                is_active=True,
            )
        )
        created += 1

    for scene in existing_scenes:
        if scene.scene_id not in incoming_scene_ids and scene.is_active:
            scene.is_active = False
            db.add(scene)
            deactivated += 1

    db.commit()

    scenes = _ordered_scenes(db, tenant_id)
    return VR360SyncResponse(
        tenant_id=tenant_id,
        created=created,
        updated=updated,
        deactivated=deactivated,
        scenes=[_scene_to_response(scene) for scene in scenes],
    )


@router.get("/settings", response_model=VR360SettingsResponse)
def get_vr360_settings(
    current_user: CurrentUser,
    db: SessionDep,
):
    scenes, scenes_by_id, scenes_by_scene_id = _load_scene_lookup(db, current_user.tenant_id)
    settings_record = _get_restaurant_settings_record(db, current_user.tenant_id)
    page_settings_rows = _get_page_settings_records(db, current_user.tenant_id)

    grouped_sections = build_grouped_section_settings(
        settings_record=settings_record,
        page_settings_rows=page_settings_rows,
        scenes_by_id=scenes_by_id,
        scenes_by_scene_id=scenes_by_scene_id,
    )

    return VR360SettingsResponse(
        scenes=[_scene_to_response(scene) for scene in scenes],
        sections={
            section_code: VR360SectionSettings(**payload)
            for section_code, payload in grouped_sections.items()
        },
    )


@router.get("/settings/{section_code}", response_model=VR360SectionSettings)
def get_vr360_section_settings(
    section_code: str,
    current_user: CurrentUser,
    db: SessionDep,
):
    config = get_section_config(section_code)
    if not config:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "VR360 section not found",
                "supported_sections": get_supported_section_codes(),
            },
        )

    _, scenes_by_id, scenes_by_scene_id = _load_scene_lookup(db, current_user.tenant_id)
    settings_record = _get_restaurant_settings_record(db, current_user.tenant_id)
    page_record = None
    if config["storage"] == "page_settings":
        page_record = _get_page_settings_record(db, current_user.tenant_id, config["page_code"])

    payload = build_section_vr360_payload(
        section_code=section_code,
        settings_record=settings_record,
        page_settings=page_record,
        scenes_by_id=scenes_by_id,
        scenes_by_scene_id=scenes_by_scene_id,
    )
    return VR360SectionSettings(**payload)


@router.put("/settings/{section_code}", response_model=VR360SectionSettings)
def update_vr360_section_settings(
    section_code: str,
    payload: VR360SectionSettings,
    current_user: CurrentUser,
    db: SessionDep,
):
    config = get_section_config(section_code)
    if not config:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "VR360 section not found",
                "supported_sections": get_supported_section_codes(),
            },
        )

    _, scenes_by_id, scenes_by_scene_id = _load_scene_lookup(db, current_user.tenant_id)
    normalized_payload = normalize_section_update_payload(
        payload.model_dump(),
        scenes_by_id=scenes_by_id,
        scenes_by_scene_id=scenes_by_scene_id,
    )

    settings_record = _get_restaurant_settings_record(db, current_user.tenant_id)
    page_record = None
    if config["storage"] == "page_settings":
        page_record = _get_page_settings_record(db, current_user.tenant_id, config["page_code"])

    settings_record, page_record = persist_vr360_section_settings(
        section_code=section_code,
        normalized_payload=normalized_payload,
        tenant_id=current_user.tenant_id,
        settings_record=settings_record,
        page_record=page_record,
    )

    if settings_record is not None:
        db.add(settings_record)
    if page_record is not None:
        db.add(page_record)
    db.commit()

    return VR360SectionSettings(**normalized_payload)

