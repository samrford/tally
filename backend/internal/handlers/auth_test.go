package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockVerifier struct {
	idToken *oidc.IDToken
	err     error
}

func (m *mockVerifier) Verify(_ context.Context, _ string) (*oidc.IDToken, error) {
	return m.idToken, m.err
}

func TestAuthMiddleware_MissingHeader(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	called := false
	next := func(http.ResponseWriter, *http.Request) { called = true }
	mw := AuthMiddleware(&mockVerifier{}, db, next)

	w := httptest.NewRecorder()
	mw(w, httptest.NewRequest(http.MethodGet, "/v1/me", nil))

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.False(t, called)
}

func TestAuthMiddleware_BadPrefix(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	called := false
	next := func(http.ResponseWriter, *http.Request) { called = true }
	mw := AuthMiddleware(&mockVerifier{}, db, next)

	r := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	r.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	w := httptest.NewRecorder()
	mw(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.False(t, called)
}

func TestAuthMiddleware_VerifyError(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	called := false
	next := func(http.ResponseWriter, *http.Request) { called = true }
	mw := AuthMiddleware(&mockVerifier{err: errors.New("invalid")}, db, next)

	r := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	r.Header.Set("Authorization", "Bearer token")
	w := httptest.NewRecorder()
	mw(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.False(t, called)
}

func TestAuthMiddleware_EmptySubject(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	called := false
	next := func(http.ResponseWriter, *http.Request) { called = true }
	mw := AuthMiddleware(&mockVerifier{idToken: &oidc.IDToken{}}, db, next)

	r := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	r.Header.Set("Authorization", "Bearer token")
	w := httptest.NewRecorder()
	mw(w, r)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.False(t, called)
}

func TestAuthMiddleware_Valid_UpsertsUser_PopulatesContext(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO users (id, email)`)).
		WithArgs("user-1", "").
		WillReturnResult(sqlmock.NewResult(0, 1))

	var capturedUserID string
	next := func(w http.ResponseWriter, r *http.Request) {
		capturedUserID = GetUserID(r.Context())
		w.WriteHeader(http.StatusOK)
	}
	mw := AuthMiddleware(&mockVerifier{idToken: &oidc.IDToken{Subject: "user-1"}}, db, next)

	r := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	r.Header.Set("Authorization", "Bearer token")
	w := httptest.NewRecorder()
	mw(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "user-1", capturedUserID)
	assert.NoError(t, mock.ExpectationsWereMet())
}
