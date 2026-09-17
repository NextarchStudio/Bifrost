CREATE TABLE IF NOT EXISTS bifrost_local_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY bifrost_local_sessions_token_hash_unique (token_hash),
    INDEX bifrost_local_sessions_user_idx (user_id, expires_at),
    INDEX bifrost_local_sessions_cleanup_idx (expires_at, revoked_at),
    CONSTRAINT bifrost_local_sessions_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
