package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"tally/backend/internal/data"
)

type MeHandler struct {
	db *sql.DB
}

func NewMeHandler(db *sql.DB) *MeHandler {
	return &MeHandler{db: db}
}

func (h *MeHandler) HandleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := GetUserID(r.Context())
	email := GetUserEmail(r.Context())

	if err := data.UpsertUser(r.Context(), h.db, userID, email); err != nil {
		log.Printf("UpsertUser failed: %v", err)
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"id":    userID,
		"email": email,
	})
}
