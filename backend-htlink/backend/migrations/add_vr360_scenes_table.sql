SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

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
  CONSTRAINT `fk_vr360_scenes_tenant`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vr360_scenes'
    AND COLUMN_NAME = 'panorama_url'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `vr360_scenes` ADD COLUMN `panorama_url` VARCHAR(1000) NULL AFTER `scene_subtitle`',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := 'ALTER TABLE `vr360_scenes` MODIFY COLUMN `property_id` BIGINT NULL';
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @unique_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vr360_scenes'
    AND INDEX_NAME = 'uq_vr360_scenes_tenant_scene'
);

SET @sql := IF(
  @unique_exists = 0,
  'ALTER TABLE `vr360_scenes` ADD UNIQUE KEY `uq_vr360_scenes_tenant_scene` (`tenant_id`, `scene_id`)',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @property_fk_name := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vr360_scenes'
    AND COLUMN_NAME = 'property_id'
    AND REFERENCED_TABLE_NAME = 'properties'
  LIMIT 1
);

SET @sql := IF(
  @property_fk_name IS NOT NULL,
  CONCAT('ALTER TABLE `vr360_scenes` DROP FOREIGN KEY `', @property_fk_name, '`'),
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
