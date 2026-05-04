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

type FlowsHandler struct {
	db *sql.DB
}

func NewFlowsHandler(db *sql.DB) *FlowsHandler {
	return &FlowsHandler{db: db}
}

type flowDTO struct {
	ID         string    `json:"id,omitempty"`
	Ciphertext string    `json:"ciphertext"`
	CreatedAt  time.Time `json:"created_at,omitempty"`
	UpdatedAt  time.Time `json:"updated_at,omitempty"`
}

func toDTO(f data.Flow) flowDTO {
	return flowDTO{
		ID:         f.ID,
		Ciphertext: base64.StdEncoding.EncodeToString(f.Ciphertext),
		CreatedAt:  f.CreatedAt,
		UpdatedAt:  f.UpdatedAt,
	}
}

// HandleCollection handles /v1/flows.
func (h *FlowsHandler) HandleCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.list(w, r)
	case http.MethodPost:
		h.create(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// HandleByID handles /v1/flows/{id}.
func (h *FlowsHandler) HandleByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/flows/")
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

func (h *FlowsHandler) list(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	flows, err := data.ListFlows(r.Context(), h.db, userID)
	if err != nil {
		log.Printf("ListFlows: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	dtos := make([]flowDTO, 0, len(flows))
	for _, f := range flows {
		dtos = append(dtos, toDTO(f))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dtos)
}

func (h *FlowsHandler) create(w http.ResponseWriter, r *http.Request) {
	userID := GetUserID(r.Context())
	var dto flowDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	ct, err := base64.StdEncoding.DecodeString(dto.Ciphertext)
	if err != nil || len(ct) == 0 {
		http.Error(w, `{"error":"invalid ciphertext"}`, http.StatusBadRequest)
		return
	}
	f, err := data.CreateFlow(r.Context(), h.db, userID, ct)
	if err != nil {
		log.Printf("CreateFlow: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(toDTO(*f))
}

func (h *FlowsHandler) update(w http.ResponseWriter, r *http.Request, id string) {
	userID := GetUserID(r.Context())
	var dto flowDTO
	if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
		http.Error(w, `{"error":"invalid body"}`, http.StatusBadRequest)
		return
	}
	ct, err := base64.StdEncoding.DecodeString(dto.Ciphertext)
	if err != nil || len(ct) == 0 {
		http.Error(w, `{"error":"invalid ciphertext"}`, http.StatusBadRequest)
		return
	}
	f, err := data.UpdateFlow(r.Context(), h.db, userID, id, ct)
	if errors.Is(err, data.ErrFlowNotFound) {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("UpdateFlow: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(toDTO(*f))
}

func (h *FlowsHandler) delete(w http.ResponseWriter, r *http.Request, id string) {
	userID := GetUserID(r.Context())
	err := data.DeleteFlow(r.Context(), h.db, userID, id)
	if errors.Is(err, data.ErrFlowNotFound) {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		log.Printf("DeleteFlow: %v", err)
		http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
