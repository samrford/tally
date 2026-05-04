package data

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListFlows(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	now := time.Now()
	rows := sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}).
		AddRow("id-2", "user-1", []byte{0x02}, now, now).
		AddRow("id-1", "user-1", []byte{0x01}, now.Add(-time.Hour), now.Add(-time.Hour))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, ciphertext, created_at, updated_at`)).
		WithArgs("user-1").
		WillReturnRows(rows)

	out, err := ListFlows(context.Background(), db, "user-1")
	require.NoError(t, err)
	require.Len(t, out, 2)
	assert.Equal(t, "id-2", out[0].ID)
	assert.Equal(t, []byte{0x02}, out[0].Ciphertext)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestListFlows_Empty(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, ciphertext, created_at, updated_at`)).
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}))

	out, err := ListFlows(context.Background(), db, "user-1")
	require.NoError(t, err)
	assert.Empty(t, out) // not nil — handler relies on this for clean JSON marshalling
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCreateFlow(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	now := time.Now()
	rows := sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}).
		AddRow("new-id", "user-1", []byte{0xab}, now, now)
	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO flows`)).
		WithArgs("user-1", []byte{0xab}).
		WillReturnRows(rows)

	got, err := CreateFlow(context.Background(), db, "user-1", []byte{0xab})
	require.NoError(t, err)
	assert.Equal(t, "new-id", got.ID)
	assert.Equal(t, []byte{0xab}, got.Ciphertext)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateFlow_Found(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	now := time.Now()
	rows := sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}).
		AddRow("id-1", "user-1", []byte{0xcd}, now.Add(-time.Hour), now)
	mock.ExpectQuery(regexp.QuoteMeta(`UPDATE flows`)).
		WithArgs([]byte{0xcd}, "id-1", "user-1").
		WillReturnRows(rows)

	got, err := UpdateFlow(context.Background(), db, "user-1", "id-1", []byte{0xcd})
	require.NoError(t, err)
	assert.Equal(t, []byte{0xcd}, got.Ciphertext)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateFlow_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(`UPDATE flows`)).
		WithArgs([]byte{0xcd}, "missing-id", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}))

	_, err = UpdateFlow(context.Background(), db, "user-1", "missing-id", []byte{0xcd})
	assert.True(t, errors.Is(err, ErrFlowNotFound))
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestDeleteFlow_Found(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM flows`)).
		WithArgs("id-1", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = DeleteFlow(context.Background(), db, "user-1", "id-1")
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestDeleteFlow_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM flows`)).
		WithArgs("missing-id", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err = DeleteFlow(context.Background(), db, "user-1", "missing-id")
	assert.True(t, errors.Is(err, ErrFlowNotFound))
	assert.NoError(t, mock.ExpectationsWereMet())
}
