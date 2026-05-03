package handlers

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// authed builds a request with user_id + email pre-set in context (what
// AuthMiddleware does in production), letting us test handlers in isolation.
func authed(method, path, body, userID string) *http.Request {
	var r *http.Request
	if body == "" {
		r = httptest.NewRequest(method, path, nil)
	} else {
		r = httptest.NewRequest(method, path, strings.NewReader(body))
	}
	ctx := context.WithValue(r.Context(), userIDKey, userID)
	ctx = context.WithValue(ctx, userEmailKey, "sam@example.com")
	return r.WithContext(ctx)
}

func TestUserKeysHandler_Get_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, wrapped_dek, salt, iterations`)).
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "wrapped_dek", "salt", "iterations"}))

	h := NewUserKeysHandler(db)
	w := httptest.NewRecorder()
	h.HandleKey(w, authed(http.MethodGet, "/v1/me/key", "", "user-1"))

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserKeysHandler_Get_Found(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT user_id, wrapped_dek, salt, iterations`)).
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "wrapped_dek", "salt", "iterations"}).
			AddRow("user-1", []byte{0xaa}, []byte{0xbb}, 600000))

	h := NewUserKeysHandler(db)
	w := httptest.NewRecorder()
	h.HandleKey(w, authed(http.MethodGet, "/v1/me/key", "", "user-1"))

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, base64.StdEncoding.EncodeToString([]byte{0xaa}), body["wrapped_dek"])
	assert.Equal(t, base64.StdEncoding.EncodeToString([]byte{0xbb}), body["salt"])
	assert.Equal(t, float64(600000), body["iterations"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserKeysHandler_Post_DecodesAndUpserts(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	wrappedDek := []byte{0x01, 0x02}
	salt := []byte{0x03, 0x04}
	mock.ExpectExec(regexp.QuoteMeta(`INSERT INTO user_keys`)).
		WithArgs("user-1", wrappedDek, salt, 600000).
		WillReturnResult(sqlmock.NewResult(0, 1))

	body, _ := json.Marshal(map[string]any{
		"wrapped_dek": base64.StdEncoding.EncodeToString(wrappedDek),
		"salt":        base64.StdEncoding.EncodeToString(salt),
		"iterations":  600000,
	})

	h := NewUserKeysHandler(db)
	w := httptest.NewRecorder()
	h.HandleKey(w, authed(http.MethodPost, "/v1/me/key", string(body), "user-1"))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUserKeysHandler_Post_RejectsInvalidBase64(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	body := `{"wrapped_dek":"not-base64!@#","salt":"AAAA","iterations":600000}`

	h := NewUserKeysHandler(db)
	w := httptest.NewRecorder()
	h.HandleKey(w, authed(http.MethodPost, "/v1/me/key", body, "user-1"))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUserKeysHandler_Post_RejectsZeroIterations(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	body := `{"wrapped_dek":"AA==","salt":"AA==","iterations":0}`

	h := NewUserKeysHandler(db)
	w := httptest.NewRecorder()
	h.HandleKey(w, authed(http.MethodPost, "/v1/me/key", body, "user-1"))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
