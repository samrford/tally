package handlers

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"tally/backend/internal/data"
)

type OutgoingsHandler struct {
	db *sql.DB
}

func NewOutgoingsHandler(db *sql.DB) *OutgoingsHandler {
	return &OutgoingsHandler{db: db}
}

type outgoingDTO struct {
	ID         string    `json:"id,omitempty"`
	Ciphertext string    `json:"ciphertext"`
	CreatedAt  time.Time `json:"created_at,omitempty"`
	UpdatedAt  time.Time `json:"updated_at,omitempty"`
}

func toDTO(o data.Outgoing) outgoingDTO {
	return outgoingDTO{
		ID:         o.ID,
		Ciphertext: base64.StdEncoding.EncodeToString(o.Ciphertext),
		CreatedAt:  o.CreatedAt,
		UpdatedAt:  o.UpdatedAt,
	}
}

// HandleCollection handles /v1/outgoings.
func (h *OutgoingsHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.list(w, r)
	case http.MethodPost:
		h.create(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleByID handles /v1/outgoings/{id}.
func (h *OutgoingsHandler) HandleByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/outgoings/")
	if id == "" {
		http.Error(w, `{"error":"id required"}`, http.StatusBadRequest)
		return
	}
	switch r.Method {
	case http.MethodPut:
		h.update(w, r, id)
	case http.MethodDelete:
		h.delete(w, r, id)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *OutgoingsHandler) list(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	outs, err := data.ListOutgoings(r.Context(), h.db, userID)
	if err != nil {
		log.Printf("ListOutgoings: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	dtos := make([]outgoingDTO, 0, len(outs))
	for _, o := range outs {
		dtos = append(dtos, toDTO(o))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dtos)
}

func (h *OutgoingsHandler) create(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	var dto outgoingDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	ct, err := base64.StdEncoding.DecodeString(dto.Ciphertext)
	if err != nil || len(ct) == 0 {
		http.Error(w, `{"error":"invalid ciphertext"}`, http.StatusBadRequest)
		return
	}
	o, err := data.CreateOutgoing(r.Context(), h.db, userID, ct)
	if err != nil {
		log.Printf("CreateOutgoing: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(toDTO(*o))
}

func (h *OutgoingsHandler) update(w http.ResponseWriter, r *http.Request, id string) {
	userID := GetUserID(r.Context())
	var dto outgoingDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	ct, err := base64.StdEncoding.DecodeString(dto.Ciphertext)
	if err != nil || len(ct) == 0 {
		http.Error(w, `{"error":"invalid ciphertext"}`, http.StatusBadRequest)
		return
	}
	o, err := data.UpdateOutgoing(r.Context(), h.db, userID, id, ct)
	if errors.Is(err, data.ErrOutgoingNotFound) {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("UpdateOutgoing: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(toDTO(*o))
}

func (h *OutgoingsHandler) delete(w http.ResponseWriter, r *http.Request, id string) {
	userID := GetUserID(r.Context())
	err := data.DeleteOutgoing(r.Context(), h.db, userID, id)
	if errors.Is(err, data.ErrOutgoingNotFound) {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("DeleteOutgoing: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
