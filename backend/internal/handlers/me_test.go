package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleMe_ReturnsContextClaims(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	ctx := context.WithValue(r.Context(), userIDKey, "user-1")
	ctx = context.WithValue(ctx, userEmailKey, "sam@example.com")
	r = r.WithContext(ctx)

	w := httptest.NewRecorder()
	HandleMe(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "user-1", body["id"])
	assert.Equal(t, "sam@example.com", body["email"])
}

func TestHandleMe_RejectsNonGet(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/v1/me", nil)
	w := httptest.NewRecorder()
	HandleMe(w, r)
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
}
