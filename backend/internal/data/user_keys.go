package data

import (
	"context"
	"database/sql"
	"errors"
)

type UserKey struct {
	UserID     string
	WrappedDek []byte
	Salt       []byte
	Iterations int
}

var ErrUserKeyNotFound = errors.New("user key not found")

func GetUserKey(ctx context.Context, db *sql.DB, userID string) (*UserKey, error) {
	row := db.QueryRowContext(ctx, `
		SELECT user_id, wrapped_dek, salt, iterations
		FROM user_keys
		WHERE user_id = $1
	`, userID)

	var k UserKey
	err := row.Scan(&k.UserID, &k.WrappedDek, &k.Salt, &k.Iterations)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUserKeyNotFound
	}
	if err != nil {
		return nil, err
	}
	return &k, nil
}

func UpsertUserKey(ctx context.Context, db *sql.DB, userID string, wrappedDek, salt []byte, iterations int) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO user_keys (user_id, wrapped_dek, salt, iterations)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id) DO UPDATE SET
			wrapped_dek = EXCLUDED.wrapped_dek,
			salt = EXCLUDED.salt,
			iterations = EXCLUDED.iterations,
			updated_at = NOW()
	`, userID, wrappedDek, salt, iterations)
	return err
}
