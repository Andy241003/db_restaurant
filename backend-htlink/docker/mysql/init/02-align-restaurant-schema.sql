INSERT IGNORE INTO `locales` (`code`, `name`, `native_name`) VALUES
  ('vi', 'Vietnamese', 'Tiếng Việt'),
  ('en', 'English', 'English'),
  ('ko', 'Korean', '한국어'),
  ('ja', 'Japanese', '日本語'),
  ('zh', 'Chinese', '中文');

INSERT IGNORE INTO `plans` (`code`, `name`, `features_json`, `created_at`) VALUES
  (
    'restaurant-basic',
    'Restaurant Basic',
    JSON_OBJECT(
      'modules', JSON_ARRAY('restaurant', 'media', 'translations', 'analytics'),
      'max_branches', 10,
      'multi_language', true
    ),
    NOW()
  );

CREATE TABLE IF NOT EXISTS `vr360_scenes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `property_id` bigint NULL,
  `scene_id` varchar(255) NOT NULL,
  `scene_name` varchar(255) NOT NULL,
  `scene_subtitle` varchar(500) DEFAULT NULL,
  `panorama_url` varchar(1000) DEFAULT NULL,
  `display_order` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_vr360_scenes_tenant_id` (`tenant_id`),
  KEY `ix_vr360_scenes_scene_id` (`scene_id`),
  KEY `ix_vr360_scenes_property_id` (`property_id`),
  UNIQUE KEY `uq_vr360_scenes_tenant_scene` (`tenant_id`, `scene_id`),
  CONSTRAINT `fk_vr360_scenes_tenant`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
