CREATE TABLE IF NOT EXISTS bifrost_secure_settings (
    `key` VARCHAR(120) NOT NULL,
    encrypted_value TEXT NOT NULL,
    key_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    updated_by_user_id BIGINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (`key`),
    CONSTRAINT bifrost_secure_settings_user_fk
        FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bifrost_jobs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    type VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payload JSON NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    available_at DATETIME NOT NULL,
    locked_at DATETIME NULL,
    locked_by VARCHAR(120) NULL,
    last_error TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    INDEX bifrost_jobs_claim_idx (status, available_at, locked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
