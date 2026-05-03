package data

import (
	"context"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpsertUser(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO users (id, email)`)).
		WithArgs("user-1", "sam@example.com").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = UpsertUser(context.Background(), db, "user-1", "sam@example.com")
	assert.NoError(t, err)
	assert.NoError(t, mock.ExpectationsWereMet())
}
