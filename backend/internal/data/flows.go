package data

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Flow struct {
	ID         string
	UserID     string
	Ciphertext []byte
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

var ErrFlowNotFound = errors.New("flow not found")

func ListFlows(ctx context.Context, db *sql.DB, userID string) ([]Flow, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, user_id, ciphertext, created_at, updated_at
		FROM flows
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Flow{}
	for rows.Next() {
		var f Flow
		if err := rows.Scan(&f.ID, &f.UserID, &f.Ciphertext, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func CreateFlow(ctx context.Context, db *sql.DB, userID string, ciphertext []byte) (*Flow, error) {
	row := db.QueryRowContext(ctx, `
		INSERT INTO flows (user_id, ciphertext)
		VALUES ($1, $2)
		RETURNING id, user_id, ciphertext, created_at, updated_at
	`, userID, ciphertext)

	var f Flow
	if err := row.Scan(&f.ID, &f.UserID, &f.Ciphertext, &f.CreatedAt, &f.UpdatedAt); err != nil {
		return nil, err
	}
	return &f, nil
}

func UpdateFlow(ctx context.Context, db *sql.DB, userID, id string, ciphertext []byte) (*Flow, error) {
	row := db.QueryRowContext(ctx, `
		UPDATE flows
		SET ciphertext = $1, updated_at = NOW()
		WHERE id = $2 AND user_id = $3
		RETURNING id, user_id, ciphertext, created_at, updated_at
	`, ciphertext, id, userID)

	var f Flow
	err := row.Scan(&f.ID, &f.UserID, &f.Ciphertext, &f.CreatedAt, &f.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrFlowNotFound
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func DeleteFlow(ctx context.Context, db *sql.DB, userID, id string) error {
	res, err := db.ExecContext(ctx, `
		DELETE FROM flows
		WHERE id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrFlowNotFound
	}
	return nil
}
