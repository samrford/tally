package handlers

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFlowsHandler_List(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	now := time.Now()
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, ciphertext`)).
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}).
			AddRow("id-1", "user-1", []byte{0xab}, now, now))

	h := NewFlowsHandler(db)
	w := httptest.NewRecorder()
	h.HandleCollection(w, authed(http.MethodGet, "/v1/flows", "", "user-1"))

	assert.Equal(t, http.StatusOK, w.Code)
	var body []map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Len(t, body, 1)
	assert.Equal(t, "id-1", body[0]["id"])
	assert.Equal(t, base64.StdEncoding.EncodeToString([]byte{0xab}), body[0]["ciphertext"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestFlowsHandler_List_EmptyReturnsArrayNotNull(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, user_id, ciphertext`)).
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}))

	h := NewFlowsHandler(db)
	w := httptest.NewRecorder()
	h.HandleCollection(w, authed(http.MethodGet, "/v1/flows", "", "user-1"))

	assert.Equal(t, http.StatusOK, w.Code)
	// Frontend expects [] not null when there are no records
	assert.Equal(t, "[]", string(w.Body.Bytes()[:2]))
}

func TestFlowsHandler_Create(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	ct := []byte{0x01, 0x02, 0x03}
	now := time.Now()
	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO flows`)).
		WithArgs("user-1", ct).
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}).
			AddRow("new-id", "user-1", ct, now, now))

	body := `{"ciphertext":"` + base64.StdEncoding.EncodeToString(ct) + `"}`
	h := NewFlowsHandler(db)
	w := httptest.NewRecorder()
	h.HandleCollection(w, authed(http.MethodPost, "/v1/flows", body, "user-1"))

	assert.Equal(t, http.StatusCreated, w.Code)
	var got map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	assert.Equal(t, "new-id", got["id"])
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestFlowsHandler_Create_RejectsEmptyCiphertext(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	body := `{"ciphertext":""}`
	h := NewFlowsHandler(db)
	w := httptest.NewRecorder()
	h.HandleCollection(w, authed(http.MethodPost, "/v1/flows", body, "user-1"))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestFlowsHandler_Update(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	ct := []byte{0xff}
	now := time.Now()
	mock.ExpectQuery(regexp.QuoteMeta(`UPDATE flows`)).
		WithArgs(ct, "id-1", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}).
			AddRow("id-1", "user-1", ct, now, now))

	body := `{"ciphertext":"` + base64.StdEncoding.EncodeToString(ct) + `"}`
	h := NewFlowsHandler(db)
	w := httptest.NewRecorder()
	h.HandleByID(w, authed(http.MethodPut, "/v1/flows/id-1", body, "user-1"))

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestFlowsHandler_Update_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	ct := []byte{0xff}
	mock.ExpectQuery(regexp.QuoteMeta(`UPDATE flows`)).
		WithArgs(ct, "missing", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "ciphertext", "created_at", "updated_at"}))

	body := `{"ciphertext":"` + base64.StdEncoding.EncodeToString(ct) + `"}`
	h := NewFlowsHandler(db)
	w := httptest.NewRecorder()
	h.HandleByID(w, authed(http.MethodPut, "/v1/flows/missing", body, "user-1"))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestFlowsHandler_Delete(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM flows`)).
		WithArgs("id-1", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	h := NewFlowsHandler(db)
	w := httptest.NewRecorder()
	h.HandleByID(w, authed(http.MethodDelete, "/v1/flows/id-1", "", "user-1"))

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestFlowsHandler_Delete_NotFound(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectExec(regexp.QuoteMeta(`DELETE FROM flows`)).
		WithArgs("missing", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	h := NewFlowsHandler(db)
	w := httptest.NewRecorder()
	h.HandleByID(w, authed(http.MethodDelete, "/v1/flows/missing", "", "user-1"))

	assert.Equal(t, http.StatusNotFound, w.Code)
}
