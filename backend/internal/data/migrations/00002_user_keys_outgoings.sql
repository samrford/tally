-- +goose Up
CREATE TABLE user_keys (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    wrapped_dek BYTEA NOT NULL,
    salt        BYTEA NOT NULL,
    iterations  INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE outgoings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ciphertext BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX outgoings_user_id_created_at ON outgoings(user_id, created_at DESC);

-- +goose Down
DROP TABLE outgoings;
DROP TABLE user_keys;
