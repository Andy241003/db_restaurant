from typing import Any

from sqlalchemy.orm.attributes import flag_modified

from app.models.restaurant import CafePageSettings, CafeSettings, VR360Scene


SECTION_PAGE_STORAGE = "page_settings"
SECTION_RESTAURANT_STORAGE = "restaurant_settings"

SECTION_CONFIG: dict[str, dict[str, Any]] = {
    "home": {
        "storage": SECTION_PAGE_STORAGE,
        "page_code": "home",
    },
    "about": {
        "storage": SECTION_PAGE_STORAGE,
        "page_code": "about",
    },
    "contact": {
        "storage": SECTION_RESTAURANT_STORAGE,
        "legacy_link_key": "vr360_link",
        "legacy_title_key": "vr_title",
    },
    "menu": {
        "storage": SECTION_RESTAURANT_STORAGE,
        "legacy_link_key": "menu_vr360_link",
        "legacy_title_key": "menu_vr_title",
    },
    "events": {
        "storage": SECTION_RESTAURANT_STORAGE,
        "legacy_link_key": "events_vr360_link",
        "legacy_title_key": "events_vr_title",
    },
    "careers": {
        "storage": SECTION_RESTAURANT_STORAGE,
        "legacy_link_key": "careers_vr360_link",
        "legacy_title_key": "careers_vr_title",
    },
    "promotions": {
        "storage": SECTION_RESTAURANT_STORAGE,
        "legacy_link_key": "promotions_vr360_link",
        "legacy_title_key": "promotions_vr_title",
    },
    "branches": {
        "storage": SECTION_RESTAURANT_STORAGE,
        "legacy_link_key": "branches_vr360_link",
        "legacy_title_key": "branches_vr_title",
    },
    "achievements": {
        "storage": SECTION_RESTAURANT_STORAGE,
        "legacy_link_key": "achievements_vr360_link",
        "legacy_title_key": "achievements_vr_title",
    },
    "spaces": {
        "storage": SECTION_RESTAURANT_STORAGE,
        "legacy_link_key": "spaces_vr360_link",
        "legacy_title_key": "spaces_vr_title",
    },
}

DEFAULT_SECTION_SETTINGS = {
    "target_id": None,
    "panorama_url": None,
    "vr360_link": None,
    "vr_title": None,
    "title_translations": {},
}


def get_supported_section_codes() -> list[str]:
    return list(SECTION_CONFIG.keys())


def get_section_config(section_code: str) -> dict[str, Any] | None:
    return SECTION_CONFIG.get(section_code)


def _clean_string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return str(value)


def _copy_section_defaults() -> dict[str, Any]:
    return {
        "target_id": None,
        "panorama_url": None,
        "vr360_link": None,
        "vr_title": None,
        "title_translations": {},
    }


def _scene_by_numeric_id(
    raw_value: Any,
    scenes_by_id: dict[int, VR360Scene],
) -> VR360Scene | None:
    if raw_value is None or isinstance(raw_value, bool):
        return None
    if isinstance(raw_value, int):
        return scenes_by_id.get(raw_value)
    if isinstance(raw_value, str) and raw_value.strip().isdigit():
        return scenes_by_id.get(int(raw_value.strip()))
    return None


def normalize_target_id(
    raw_target_id: Any,
    scenes_by_id: dict[int, VR360Scene],
    scenes_by_scene_id: dict[str, VR360Scene],
) -> str | None:
    direct_target = _clean_string(raw_target_id)
    if direct_target and direct_target in scenes_by_scene_id:
        return direct_target

    numeric_scene = _scene_by_numeric_id(raw_target_id, scenes_by_id)
    if numeric_scene:
        return numeric_scene.scene_id

    return direct_target


def normalize_title_translations(
    raw_translations: Any,
    fallback_title: str | None,
) -> dict[str, str]:
    if isinstance(raw_translations, dict):
        normalized: dict[str, str] = {}
        for locale, value in raw_translations.items():
            locale_key = _clean_string(locale)
            locale_value = _clean_string(value)
            if locale_key and locale_value:
                normalized[locale_key] = locale_value
        if normalized:
            return normalized

    fallback = _clean_string(fallback_title)
    if fallback:
        return {"vi": fallback}

    return {}


def get_or_create_restaurant_settings(
    tenant_id: int,
    settings_record: CafeSettings | None,
) -> CafeSettings:
    if settings_record:
        if settings_record.settings_json is None:
            settings_record.settings_json = {}
        return settings_record

    return CafeSettings(
        tenant_id=tenant_id,
        restaurant_name="My Restaurant",
        primary_color="#6f4e37",
        secondary_color="#d4a574",
        background_color="#ffffff",
        settings_json={},
    )


def get_or_create_page_settings(
    tenant_id: int,
    section_code: str,
    page_record: CafePageSettings | None,
) -> CafePageSettings:
    if page_record:
        if page_record.settings_json is None:
            page_record.settings_json = {}
        return page_record

    return CafePageSettings(
        tenant_id=tenant_id,
        page_code=section_code,
        is_displaying=True,
        vr360_link=None,
        vr_title=None,
        settings_json={},
    )


def _get_normalized_sections_bucket(settings_json: dict[str, Any]) -> dict[str, Any]:
    bucket = settings_json.get("vr360_sections")
    if isinstance(bucket, dict):
        return bucket
    bucket = {}
    settings_json["vr360_sections"] = bucket
    return bucket


def _get_normalized_section_raw(
    settings_json: dict[str, Any],
    section_code: str,
) -> dict[str, Any]:
    sections_bucket = settings_json.get("vr360_sections")
    if isinstance(sections_bucket, dict):
        raw_value = sections_bucket.get(section_code)
        if isinstance(raw_value, dict):
            return raw_value
    return {}


def _extract_legacy_restaurant_section_raw(
    section_code: str,
    settings_record: CafeSettings | None,
) -> dict[str, Any]:
    if not settings_record or not isinstance(settings_record.settings_json, dict):
        return {}

    config = get_section_config(section_code) or {}
    legacy_link_key = config.get("legacy_link_key")
    legacy_title_key = config.get("legacy_title_key")
    settings_json = settings_record.settings_json or {}

    raw: dict[str, Any] = {}
    if legacy_link_key:
        raw["vr360_link"] = settings_json.get(legacy_link_key)
    if legacy_title_key:
        raw["vr_title"] = settings_json.get(legacy_title_key)

    legacy_target_key = f"{section_code}_target_id"
    legacy_panorama_key = f"{section_code}_panorama_url"
    legacy_translations_key = f"{section_code}_title_translations"

    raw["target_id"] = settings_json.get(legacy_target_key)
    raw["panorama_url"] = settings_json.get(legacy_panorama_key)
    raw["title_translations"] = settings_json.get(legacy_translations_key)
    return raw


def _extract_legacy_page_section_raw(
    page_settings: CafePageSettings | None,
) -> dict[str, Any]:
    if not page_settings:
        return {}

    raw: dict[str, Any] = {
        "vr360_link": page_settings.vr360_link,
        "vr_title": page_settings.vr_title,
    }
    if isinstance(page_settings.settings_json, dict):
        settings_json = page_settings.settings_json
        raw["target_id"] = (
            settings_json.get("target_id")
            or settings_json.get("targetId")
            or settings_json.get("scene_id")
            or settings_json.get("sceneId")
        )
        raw["panorama_url"] = settings_json.get("panorama_url") or settings_json.get("panoramaUrl")
        raw["title_translations"] = settings_json.get("title_translations") or settings_json.get(
            "titleTranslations"
        )
    return raw


def _normalize_section_payload(
    raw_section: dict[str, Any],
    scenes_by_id: dict[int, VR360Scene],
    scenes_by_scene_id: dict[str, VR360Scene],
) -> dict[str, Any]:
    payload = _copy_section_defaults()

    target_id = normalize_target_id(raw_section.get("target_id"), scenes_by_id, scenes_by_scene_id)
    matched_scene = scenes_by_scene_id.get(target_id) if target_id else None

    vr360_link = _clean_string(raw_section.get("vr360_link"))
    vr_title = _clean_string(raw_section.get("vr_title"))
    panorama_url = (
        _clean_string(raw_section.get("panorama_url"))
        or (matched_scene.panorama_url if matched_scene else None)
    )
    title_translations = normalize_title_translations(
        raw_section.get("title_translations"),
        vr_title,
    )

    if target_id is None:
        panorama_url = _clean_string(raw_section.get("panorama_url"))

    payload["target_id"] = target_id
    payload["panorama_url"] = panorama_url
    payload["vr360_link"] = vr360_link
    payload["vr_title"] = vr_title
    payload["title_translations"] = title_translations
    return payload


def build_section_vr360_payload(
    section_code: str,
    settings_record: CafeSettings | None,
    page_settings: CafePageSettings | None,
    scenes_by_id: dict[int, VR360Scene],
    scenes_by_scene_id: dict[str, VR360Scene],
) -> dict[str, Any]:
    config = get_section_config(section_code)
    if not config:
        return _copy_section_defaults()

    raw_section: dict[str, Any] = {}

    if config["storage"] == SECTION_PAGE_STORAGE:
        if page_settings and isinstance(page_settings.settings_json, dict):
            raw_section.update(
                _get_normalized_section_raw(page_settings.settings_json, section_code)
            )
        raw_section = {
            **_extract_legacy_page_section_raw(page_settings),
            **raw_section,
        }
    else:
        if settings_record and isinstance(settings_record.settings_json, dict):
            raw_section.update(
                _get_normalized_section_raw(settings_record.settings_json, section_code)
            )
        raw_section = {
            **_extract_legacy_restaurant_section_raw(section_code, settings_record),
            **raw_section,
        }

    return _normalize_section_payload(raw_section, scenes_by_id, scenes_by_scene_id)


def build_grouped_section_settings(
    settings_record: CafeSettings | None,
    page_settings_rows: list[CafePageSettings],
    scenes_by_id: dict[int, VR360Scene],
    scenes_by_scene_id: dict[str, VR360Scene],
) -> dict[str, dict[str, Any]]:
    page_settings_by_code = {row.page_code: row for row in page_settings_rows}
    grouped: dict[str, dict[str, Any]] = {}
    for section_code in get_supported_section_codes():
        page_record = page_settings_by_code.get(section_code)
        grouped[section_code] = build_section_vr360_payload(
            section_code,
            settings_record=settings_record,
            page_settings=page_record,
            scenes_by_id=scenes_by_id,
            scenes_by_scene_id=scenes_by_scene_id,
        )
    return grouped


def normalize_section_update_payload(
    section_payload: dict[str, Any],
    scenes_by_id: dict[int, VR360Scene],
    scenes_by_scene_id: dict[str, VR360Scene],
) -> dict[str, Any]:
    return _normalize_section_payload(section_payload, scenes_by_id, scenes_by_scene_id)


def persist_vr360_section_settings(
    section_code: str,
    normalized_payload: dict[str, Any],
    tenant_id: int,
    settings_record: CafeSettings | None,
    page_record: CafePageSettings | None,
) -> tuple[CafeSettings | None, CafePageSettings | None]:
    config = get_section_config(section_code)
    if not config:
        raise ValueError(f"Unsupported VR360 section: {section_code}")

    if config["storage"] == SECTION_PAGE_STORAGE:
        page_settings = get_or_create_page_settings(tenant_id, section_code, page_record)
        settings_json = page_settings.settings_json or {}
        sections_bucket = _get_normalized_sections_bucket(settings_json)
        sections_bucket[section_code] = {
            "target_id": normalized_payload.get("target_id"),
            "panorama_url": normalized_payload.get("panorama_url"),
            "vr360_link": normalized_payload.get("vr360_link"),
            "vr_title": normalized_payload.get("vr_title"),
            "title_translations": normalized_payload.get("title_translations") or {},
        }
        page_settings.vr360_link = normalized_payload.get("vr360_link")
        page_settings.vr_title = normalized_payload.get("vr_title")
        page_settings.settings_json = settings_json
        flag_modified(page_settings, "settings_json")
        return settings_record, page_settings

    settings = get_or_create_restaurant_settings(tenant_id, settings_record)
    settings_json = settings.settings_json or {}
    sections_bucket = _get_normalized_sections_bucket(settings_json)
    sections_bucket[section_code] = {
        "target_id": normalized_payload.get("target_id"),
        "panorama_url": normalized_payload.get("panorama_url"),
        "vr360_link": normalized_payload.get("vr360_link"),
        "vr_title": normalized_payload.get("vr_title"),
        "title_translations": normalized_payload.get("title_translations") or {},
    }

    legacy_link_key = config.get("legacy_link_key")
    legacy_title_key = config.get("legacy_title_key")
    if legacy_link_key:
        settings_json[legacy_link_key] = normalized_payload.get("vr360_link")
    if legacy_title_key:
        settings_json[legacy_title_key] = normalized_payload.get("vr_title")

    settings_json[f"{section_code}_target_id"] = normalized_payload.get("target_id")
    settings_json[f"{section_code}_panorama_url"] = normalized_payload.get("panorama_url")
    settings_json[f"{section_code}_title_translations"] = (
        normalized_payload.get("title_translations") or {}
    )

    settings.settings_json = settings_json
    flag_modified(settings, "settings_json")
    return settings, page_record

