package handlers

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"tally/backend/internal/data"
)

type UserKeysHandler struct {
	db *sql.DB
}

func NewUserKeysHandler(db *sql.DB) *UserKeysHandler {
	return &UserKeysHandler{db: db}
}

type userKeyDTO struct {
	WrappedDek string `json:"wrapped_dek"`
	Salt       string `json:"salt"`
	Iterations int    `json:"iterations"`
}

func (h *UserKeysHandler) HandleKey(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.get(w, r)
	case http.MethodPost:
		h.upsert(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *UserKeysHandler) get(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	k, err := data.GetUserKey(r.Context(), h.db, userID)
	if errors.Is(err, data.ErrUserKeyNotFound) {
		http.Error(w, `{"error":"key not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("GetUserKey: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userKeyDTO{
		WrappedDek: base64.StdEncoding.EncodeToString(k.WrappedDek),
		Salt:       base64.StdEncoding.EncodeToString(k.Salt),
		Iterations: k.Iterations,
	})
}

func (h *UserKeysHandler) upsert(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	var dto userKeyDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	if dto.Iterations < 1 {
		http.Error(w, `{"error":"iterations must be > 0"}`, http.StatusBadRequest)
		return
	}

	wrapped, err := base64.StdEncoding.DecodeString(dto.WrappedDek)
	if err != nil || len(wrapped) == 0 {
		http.Error(w, `{"error":"invalid wrapped_dek"}`, http.StatusBadRequest)
		return
	}
	salt, err := base64.StdEncoding.DecodeString(dto.Salt)
	if err != nil || len(salt) == 0 {
		http.Error(w, `{"error":"invalid salt"}`, http.StatusBadRequest)
		return
	}

	if err := data.UpsertUserKey(r.Context(), h.db, userID, wrapped, salt, dto.Iterations); err != nil {
		log.Printf("UpsertUserKey: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dto)
}
