package data

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Outgoing struct {
	ID         string
	UserID     string
	Ciphertext []byte
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

var ErrOutgoingNotFound = errors.New("outgoing not found")

func ListOutgoings(ctx context.Context, db *sql.DB, userID string) ([]Outgoing, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT id, user_id, ciphertext, created_at, updated_at
		FROM outgoings
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Outgoing{}
	for rows.Next() {
		var o Outgoing
		if err := rows.Scan(&o.ID, &o.UserID, &o.Ciphertext, &o.CreatedAt, &o.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func CreateOutgoing(ctx context.Context, db *sql.DB, userID string, ciphertext []byte) (*Outgoing, error) {
	row := db.QueryRowContext(ctx, `
		INSERT INTO outgoings (user_id, ciphertext)
		VALUES ($1, $2)
		RETURNING id, user_id, ciphertext, created_at, updated_at
	`, userID, ciphertext)

	var o Outgoing
	if err := row.Scan(&o.ID, &o.UserID, &o.Ciphertext, &o.CreatedAt, &o.UpdatedAt); err != nil {
		return nil, err
	}
	return &o, nil
}

func UpdateOutgoing(ctx context.Context, db *sql.DB, userID, id string, ciphertext []byte) (*Outgoing, error) {
	row := db.QueryRowContext(ctx, `
		UPDATE outgoings
		SET ciphertext = $1, updated_at = NOW()
		WHERE id = $2 AND user_id = $3
		RETURNING id, user_id, ciphertext, created_at, updated_at
	`, ciphertext, id, userID)

	var o Outgoing
	err := row.Scan(&o.ID, &o.UserID, &o.Ciphertext, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrOutgoingNotFound
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func DeleteOutgoing(ctx context.Context, db *sql.DB, userID, id string) error {
	res, err := db.ExecContext(ctx, `
		DELETE FROM outgoings
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
		return ErrOutgoingNotFound
	}
	return nil
}
