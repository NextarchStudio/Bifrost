CREATE TABLE IF NOT EXISTS bifrost_crew_provisioning_rules (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    crew_name VARCHAR(180) NOT NULL,
    crew_role VARCHAR(180) NULL,
    role_id SMALLINT UNSIGNED NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    INDEX bifrost_crew_rules_match_idx (enabled, crew_name, crew_role),
    INDEX bifrost_crew_rules_role_idx (role_id),
    CONSTRAINT bifrost_crew_rules_role_fk
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS crew_provisioning_email_enabled TINYINT(1) NOT NULL DEFAULT 0
    AFTER crew_cache_year;

INSERT INTO bifrost_crew_provisioning_rules (crew_name, crew_role, role_id, enabled, created_at, updated_at)
SELECT seed.crew_name, seed.crew_role, roles.id, 1, NOW(), NOW()
FROM (
    SELECT 'Arena:Logistikk' AS crew_name, NULL AS crew_role, 'logistikk' AS role_name
    UNION ALL SELECT 'Arena:Logistikk', 'Skiftleder', 'skiftleder'
    UNION ALL SELECT 'Arena:Logistikk', 'Chief', 'chief'
    UNION ALL SELECT 'Arena:Logistikk', 'Co-Chief', 'co-chief'
    UNION ALL SELECT 'Arena:Innkjøp', 'Innkjøpsansvarlig', 'innkjop'
) AS seed
INNER JOIN roles ON roles.name = seed.role_name
WHERE NOT EXISTS (
    SELECT 1
    FROM bifrost_crew_provisioning_rules existing
    WHERE existing.crew_name = seed.crew_name
      AND (existing.crew_role = seed.crew_role OR (existing.crew_role IS NULL AND seed.crew_role IS NULL))
      AND existing.role_id = roles.id
);
