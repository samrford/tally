package data

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserKey_Found(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	rows := sqlmock.NewRows([]string{"user_id", "wrapped_dek", "salt", "iterations"}).
		AddRow("user-1", []byte{0xaa, 0xbb}, []byte{0x01, 0x02}, 600000)
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, wrapped_dek, salt, iterations`)).
		WithArgs("user-1").
		WillReturnRows(rows)

	got, err := GetUserKey(context.Background(), db, "user-1")
	require.NoError(t, err)
	assert.Equal(t, "user-1", got.UserID)
	assert.Equal(t, []byte{0xaa, 0xbb}, got.WrappedDek)
	assert.Equal(t, []byte{0x01, 0x02}, got.Salt)
	assert.Equal(t, 600000, got.Iterations)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetUserKey_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, wrapped_dek, salt, iterations`)).
		WithArgs("missing-user").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "wrapped_dek", "salt", "iterations"}))

	_, err = GetUserKey(context.Background(), db, "missing-user")
	assert.True(t, errors.Is(err, ErrUserKeyNotFound))
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpsertUserKey(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO user_keys`)).
		WithArgs("user-1", []byte{0x01}, []byte{0x02}, 600000).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = UpsertUserKey(context.Background(), db, "user-1", []byte{0x01}, []byte{0x02}, 600000)
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}
