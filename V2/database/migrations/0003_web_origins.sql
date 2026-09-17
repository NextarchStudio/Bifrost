CREATE TABLE IF NOT EXISTS bifrost_web_origins (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    origin VARCHAR(255) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY bifrost_web_origins_origin_unique (origin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO bifrost_web_origins (origin, enabled, created_at, updated_at)
VALUES
    ('https://tg.legacyh.dev', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('https://bifrost.tg.no', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('http://127.0.0.1:3000', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = VALUES(updated_at);
