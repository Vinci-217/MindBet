package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"mindbet-debox-bot/internal/handlers"

	"github.com/golang-jwt/jwt/v5"
	"github.com/spf13/viper"
)

type Config struct {
	DeboxAPIKey    string
	DeboxAppSecret string
	BackendAPIURL  string
	JWTSecret      string
	Port           int
}

var config Config

func main() {
	viper.AutomaticEnv()

	config = Config{
		DeboxAPIKey:    viper.GetString("DEBOX_API_KEY"),
		DeboxAppSecret: viper.GetString("DEBOX_APP_SECRET"),
		BackendAPIURL:  viper.GetString("BACKEND_API_URL"),
		JWTSecret:      viper.GetString("JWT_SECRET"),
		Port:           viper.GetInt("PORT"),
	}

	if config.Port == 0 {
		config.Port = 8002
	}

	http.HandleFunc("/webhook", webhookHandler)
	http.HandleFunc("/health", healthHandler)

	log.Printf("Starting DeBox Bot on port %d...", config.Port)
	if err := http.ListenAndServe(fmt.Sprintf(":%d", config.Port), nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": "debox-bot",
	})
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload handlers.WebhookPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	response, err := handlers.HandleMessage(&payload, &handlers.ClientConfig{
		BackendAPIURL: config.BackendAPIURL,
		JWTSecret:     config.JWTSecret,
	})
	if err != nil {
		log.Printf("Error handling message: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func generateJWTToken(serviceName string) (string, error) {
	claims := jwt.MapClaims{
		"service": serviceName,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.JWTSecret))
}
