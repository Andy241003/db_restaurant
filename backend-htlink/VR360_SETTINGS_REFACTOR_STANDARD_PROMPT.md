# VR360 Settings Refactor Standard Prompt

## Purpose

Tai lieu nay dung de giao viec cho AI hoac dev khi can refactor lai module `VR360 Settings` trong cac du an tuong tu, theo huong bo kieu cu va chuyen sang kieu moi thong nhat.

Muc tieu la:

- bo hoan toan flow legacy cua `VR Hotel Settings`
- thong nhat `target_id = scene_id`
- dung scene metadata tu bang `vr360_scenes`
- ap dung cho **tat ca section co su dung module VR360 Settings**
- giu backward compatibility cho du lieu cu

---

## Standard Prompt

```text
Ban hay refactor toan bo module VR360 Settings cua du an nay sang kien truc moi, ap dung cho moi section dang su dung module VR360 Settings.

Muc tieu:
- Bo hoan toan kieu cu / legacy.
- Chuan hoa toan bo VR360 Settings theo mot cau truc moi, dung chung cho tat ca section.
- Khong hardcode logic rieng cho tung section neu khong that su can.
- Moi section co dung VR360 Settings phai dung cung mot chuan du lieu, cung cach luu, cung cach response API.

Yeu cau tong the:

1. Bo kieu cu
- Xoa hoac ngung su dung moi flow legacy cua VR360/VR Hotel settings cu.
- Khong dung numeric database `id` lam Target ID cho frontend.
- Khong dung `property_id` trong flow moi neu he thong hien tai khong con can.
- Khong de OpenAPI hoac router con lan route cu va route moi cho cung module VR360 Settings.

2. Chuan hoa kien truc moi
- Backend dung `tenant_id` lam scope chinh.
- Scene metadata lay tu bang `vr360_scenes`.
- `target_id` trong toan he thong phai la `scene_id`.
- Moi section co bat module VR360 Settings deu dung cung mot cau truc du lieu chuan.

3. Nguyen tac ap dung cho moi section
- Thiet ke theo huong generic.
- Khong viet rieng tung kieu xu ly cho `home`, `about`, `menu`, `contact`... neu chi khac ten section.
- Tao helper / utility / normalization function dung chung cho moi section.
- Moi section chi khac:
  - `section_code`
  - noi luu du lieu
  - du lieu business rieng neu co
- Phan VR360 phai co cung schema o tat ca cac section.

4. Cau truc du lieu chuan cho moi section dung VR360 Settings
Moi section khi tra du lieu VR360 phai co format thong nhat:

{
  "target_id": "panorama_xxx",
  "panorama_url": "https://...",
  "vr360_link": "https://...",
  "vr_title": "Some title",
  "title_translations": {
    "vi": "Tieu de",
    "en": "Title"
  }
}

Field chuan:
- `target_id`
- `panorama_url`
- `vr360_link`
- `vr_title`
- `title_translations`

5. API yeu cau
Can chuan hoa cac API lien quan den VR360:

- `GET /api/v1/vr360/scenes`
  - tra scene list cho tenant hien tai
  - moi item gom:
    - `target_id` = `scene_id`
    - `scene_name`
    - `scene_subtitle`
    - `panorama_url`
    - `display_order`
    - `is_active`

- `POST /api/v1/vr360/scenes/sync`
  - frontend gui full scene list
  - backend insert / update / deactivate
  - upsert theo `tenant_id + scene_id`

- `GET /api/v1/vr360/settings`
  - tra danh sach `scenes`
  - tra `sections`
  - `sections` la object dong theo moi section dang dung VR360 Settings
  - khong gioi han cung chi mot vai section co dinh neu he thong co the mo rong

Vi du:
{
  "scenes": [],
  "sections": {
    "home": {
      "target_id": "panorama_001",
      "panorama_url": "https://...",
      "vr360_link": "https://...",
      "vr_title": "Home VR",
      "title_translations": {
        "vi": "Trang chu",
        "en": "Home"
      }
    },
    "menu": {
      "target_id": null,
      "panorama_url": null,
      "vr360_link": "https://...",
      "vr_title": "Menu VR",
      "title_translations": {
        "vi": "Thuc don",
        "en": "Menu"
      }
    }
  }
}

6. Database / model
Dung bang `vr360_scenes` lam nguon scene metadata:
- `tenant_id`
- `scene_id`
- `scene_name`
- `scene_subtitle`
- `panorama_url`
- `display_order`
- `is_active`

Yeu cau:
- moi query scene chi scope theo `tenant_id`
- khong dung `property_id` trong flow moi
- scene cu khong con trong payload thi `is_active = 0`
- neu can migration thi chi lam toi thieu, an toan voi du lieu cu

7. Cach luu settings cho moi section
- section nao co module VR360 deu luu theo cung key structure
- tranh moi section mot kieu key khac nhau neu khong bat buoc
- neu he thong hien tai dang luu trong `settings_json`, hay tao cach normalize thong nhat
- neu du lieu cu dang dung key legacy hoac numeric id, phai normalize sang format moi khi doc / ghi

8. Frontend mapping
Ap dung cho moi section co module VR360 Settings:
- Dropdown Target ID load tu `GET /api/v1/vr360/scenes`
- option hien thi theo:
  - `target_id`
  - hoac `target_id - scene_name`
- khi user chon target:
  - tu fill `panorama_url`
- phai co them mot option `Null`
  - neu user chon `Null`:
    - luu `target_id = null`
    - luu `panorama_url = null`
    - giu nguyen `vr360_link`
    - preview fallback sang `vr360_link`

9. Preview logic
Ap dung thong nhat cho moi section:
- neu co `panorama_url` hop le:
  - preview dung `panorama_url`
- neu `panorama_url` null / rong / loi:
  - fallback sang `vr360_link`

10. Backward compatibility
- Khong lam hong du lieu cu
- Neu du lieu cu dang dung:
  - numeric target id
  - scene reference kieu cu
  - key legacy
thì phai normalize sang format moi
- API response luon phai tra theo format moi, sach, de dung

11. Yeu cau trien khai
Hay thuc hien day du:
- tim moi section hien dang dung module VR360 Settings
- tim moi logic legacy con sot
- refactor theo huong generic dung chung
- chuan hoa schema/backend/frontend
- dam bao moi section dung cung mot cau truc VR360
- neu can migration SQL thi viet ro
- neu can helper / utility thi tao moi
- neu can bo router cu thi bo khoi OpenAPI

12. Ky vong cuoi cung
- API sach
- du lieu dong nhat
- `target_id = scene_id` tren toan he thong
- moi section dung VR360 Settings deu theo cung chuan
- khong con logic legacy lan vao module moi
```

---

## Target Architecture

### 1. Source of truth

- FE la noi doc scene metadata tu bo export 3DVista
- BE la noi luu metadata scene da chuan hoa
- Dashboard lay scene tu BE de map vao tung section

### 2. Scope

- scope chinh: `tenant_id`
- khong dung `property_id` cho flow moi neu day la he thong cafe-only / tenant-only

### 3. Data flow

1. FE extract scene metadata
2. FE goi `POST /api/v1/vr360/scenes/sync`
3. BE upsert vao `vr360_scenes`
4. Dashboard load `GET /api/v1/vr360/scenes`
5. User chon `target_id`
6. FE auto-fill `panorama_url`
7. Luu settings cho section
8. Preview uu tien `panorama_url`, fallback sang `vr360_link`

### 4. Standard section VR360 object

```json
{
  "target_id": "panorama_001",
  "panorama_url": "https://cdn.example.com/pano.jpg",
  "vr360_link": "https://example.com/vr-tour",
  "vr_title": "VR Tour",
  "title_translations": {
    "vi": "Tour 360",
    "en": "VR Tour"
  }
}
```

---

## Database Standard

### Recommended table

```sql
CREATE TABLE IF NOT EXISTS vr360_scenes (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  property_id INT NULL,
  scene_id VARCHAR(255) NOT NULL,
  scene_name VARCHAR(255) NOT NULL,
  scene_subtitle VARCHAR(500) NULL,
  panorama_url VARCHAR(1000) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_vr360_scenes_tenant_id (tenant_id),
  KEY ix_vr360_scenes_scene_id (scene_id),
  KEY ix_vr360_scenes_property_id (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Recommended unique index

Neu flow moi la tenant-only:

```sql
ALTER TABLE vr360_scenes
ADD UNIQUE KEY uq_vr360_scenes_tenant_scene (tenant_id, scene_id);
```

### Optional cleanup for old schema

Neu du an cu dang de `property_id` la `NOT NULL`, cho phep nullable:

```sql
ALTER TABLE vr360_scenes
MODIFY COLUMN property_id INT NULL;
```

Neu can bo rang buoc FK cu vao `properties`:

```sql
SET @fk_name = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vr360_scenes'
    AND COLUMN_NAME = 'property_id'
    AND REFERENCED_TABLE_NAME = 'properties'
  LIMIT 1
);

SET @sql = IF(
  @fk_name IS NOT NULL,
  CONCAT('ALTER TABLE vr360_scenes DROP FOREIGN KEY ', @fk_name),
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
```

### If table already exists but is missing panorama_url

```sql
ALTER TABLE vr360_scenes
ADD COLUMN panorama_url VARCHAR(1000) NULL AFTER scene_subtitle;
```

---

## API Contract

### GET /api/v1/vr360/scenes

```json
[
  {
    "target_id": "panorama_001",
    "scene_name": "pano-01",
    "scene_subtitle": "Garden view",
    "panorama_url": "https://cdn.example.com/pano-01.jpg",
    "display_order": 0,
    "is_active": true
  }
]
```

### POST /api/v1/vr360/scenes/sync

```json
{
  "tenant_code": "boton_blue",
  "scenes": [
    {
      "id": "panorama_001",
      "name": "pano-01",
      "subtitle": "Garden view",
      "panorama_url": "https://cdn.example.com/pano-01.jpg",
      "order": 0
    }
  ]
}
```

### GET /api/v1/vr360/settings

```json
{
  "scenes": [
    {
      "target_id": "panorama_001",
      "scene_name": "pano-01",
      "scene_subtitle": "Garden view",
      "panorama_url": "https://cdn.example.com/pano-01.jpg",
      "display_order": 0,
      "is_active": true
    }
  ],
  "sections": {
    "home": {
      "target_id": "panorama_001",
      "panorama_url": "https://cdn.example.com/pano-01.jpg",
      "vr360_link": "https://example.com/vr-home",
      "vr_title": "Home Tour",
      "title_translations": {
        "vi": "Trang chu",
        "en": "Home"
      }
    },
    "menu": {
      "target_id": null,
      "panorama_url": null,
      "vr360_link": "https://example.com/vr-menu",
      "vr_title": "Menu Tour",
      "title_translations": {
        "vi": "Thuc don",
        "en": "Menu"
      }
    }
  }
}
```

---

## Frontend Behavior Standard

### Dropdown

- load danh sach tu `GET /api/v1/vr360/scenes`
- them 1 option dac biet: `Null`

### When user selects a scene

- `target_id = scene_id`
- `panorama_url = scene.panorama_url`
- `vr360_link` giu nguyen neu user da nhap

### When user selects Null

- `target_id = null`
- `panorama_url = null`
- `vr360_link` giu nguyen
- preview fallback sang `vr360_link`

### Preview rule

1. Neu `panorama_url` hop le -> preview bang `panorama_url`
2. Neu `panorama_url` null, rong, hoac fail -> fallback sang `vr360_link`

---

## Backend Implementation Checklist

- Tao / kiem tra bang `vr360_scenes`
- Chuan hoa model `VR360Scene`
- Tao helper:
  - resolve scene theo `scene_id`
  - normalize `target_id`
  - normalize settings json
  - build grouped sections
- Chuan hoa response schema
- Chuan hoa `GET /api/v1/vr360/scenes`
- Chuan hoa `POST /api/v1/vr360/scenes/sync`
- Chuan hoa `GET /api/v1/vr360/settings`
- Bo router legacy khoi `/api/v1/vr360`
- Dam bao OpenAPI chi con route moi

---

## Frontend Implementation Checklist

- Dung chung helper cho target options
- Dung `target_id` string, khong dung numeric `id`
- Them option `Null`
- Chon scene -> auto-fill `panorama_url`
- Chon `Null` -> xoa `target_id` va `panorama_url`
- Giu nguyen `vr360_link`
- Preview fallback dung
- Mapping thong nhat cho moi section co module VR360

---

## Backward Compatibility Notes

- Neu du lieu cu luu numeric target id, normalize sang `scene_id`
- Neu key cu va key moi cung ton tai, uu tien key moi
- API response luon tra format moi
- Khong de FE moi phai tu xu ly data cu

---

## Expected Final Result

- khong con flow VR Hotel legacy trong module VR360 moi
- `target_id = scene_id` tren toan he thong
- moi section dung module VR360 Settings deu dung cung mot chuan
- FE de mapping, BE de maintain
- preview thong nhat
- deployment production va local cho ra API giong nhau

