package handlers

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
)

type contextKey string

const (
	userIDKey    contextKey = "userID"
	userEmailKey contextKey = "userEmail"
)

// InitAuth initializes an OIDC provider and returns an IDTokenVerifier.
// It automatically discovers the JWKS and other endpoints from the provider's discovery URL.
func InitAuth(ctx context.Context, supabaseURL string) (*oidc.IDTokenVerifier, error) {
	issuerURL := strings.TrimRight(supabaseURL, "/") + "/auth/v1"
	log.Printf("Initializing OIDC provider for %s", issuerURL)

	provider, err := oidc.NewProvider(ctx, issuerURL)
	if err != nil {
		return nil, err
	}

	verifier := provider.Verifier(&oidc.Config{
		ClientID: "authenticated",
	})

	return verifier, nil
}

// IDTokenVerifier defines the interface for verifying ID tokens.
// This allows for mocking the verifier in tests.
type IDTokenVerifier interface {
	Verify(ctx context.Context, rawIDToken string) (*oidc.IDToken, error)
}

// AuthMiddleware verifies the JWT and stores user_id + email in context.
func AuthMiddleware(verifier IDTokenVerifier, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"error":"Missing or invalid Authorization header"}`, http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		idToken, err := verifier.Verify(r.Context(), tokenString)
		if err != nil {
			log.Printf("JWT verification failed: %v", err)
			http.Error(w, `{"error":"Invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		sub := idToken.Subject
		if sub == "" {
			http.Error(w, `{"error":"Missing user ID in token"}`, http.StatusUnauthorized)
			return
		}

		var claims struct {
			Email string `json:"email"`
		}
		_ = idToken.Claims(&claims)

		ctx := context.WithValue(r.Context(), userIDKey, sub)
		ctx = context.WithValue(ctx, userEmailKey, claims.Email)
		next(w, r.WithContext(ctx))
	}
}

// GetUserID retrieves the authenticated user's ID from the request context.
func GetUserID(ctx context.Context) string {
	id, _ := ctx.Value(userIDKey).(string)
	return id
}

// GetUserEmail retrieves the authenticated user's email from the request context.
func GetUserEmail(ctx context.Context) string {
	e, _ := ctx.Value(userEmailKey).(string)
	return e
}
