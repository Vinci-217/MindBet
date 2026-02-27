package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	Chain    ChainConfig
	IPFS     IPFSConfig
}

type ServerConfig struct {
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

type JWTConfig struct {
	Secret     string
	ExpireTime time.Duration
}

type ChainConfig struct {
	RPCURL         string
	ContractAddr   string
	USDCAddr       string
	ChainID        int64
	PlatformTreasury string
}

type IPFSConfig struct {
	APIURL string
}

var GlobalConfig *Config

func InitConfig(configPath string) error {
	viper.SetConfigFile(configPath)
	viper.SetConfigType("yaml")

	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}

	GlobalConfig = &Config{}
	if err := viper.Unmarshal(GlobalConfig); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return nil
}

func InitConfigFromEnv() error {
	viper.AutomaticEnv()

	GlobalConfig = &Config{
		Server: ServerConfig{
			Port:         getEnvInt("SERVER_PORT", 8080),
			ReadTimeout:  30 * time.Second,
			WriteTimeout: 30 * time.Second,
		},
		Database: DatabaseConfig{
			Host:     getEnvString("MYSQL_HOST", "localhost"),
			Port:     getEnvInt("MYSQL_PORT", 3306),
			User:     getEnvString("MYSQL_USER", "root"),
			Password: getEnvString("MYSQL_PASSWORD", ""),
			DBName:   getEnvString("MYSQL_DATABASE", "mindbet"),
		},
		Redis: RedisConfig{
			Host:     getEnvString("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnvString("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		JWT: JWTConfig{
			Secret:     getEnvString("JWT_SECRET", ""),
			ExpireTime: 24 * time.Hour,
		},
		Chain: ChainConfig{
			RPCURL:           getEnvString("BLOCKCHAIN_RPC_URL", ""),
			ContractAddr:     getEnvString("CONTRACT_ADDRESS", ""),
			USDCAddr:         getEnvString("USDC_ADDRESS", ""),
			ChainID:          getEnvInt64("CHAIN_ID", 11155111),
			PlatformTreasury: getEnvString("PLATFORM_TREASURY", ""),
		},
		IPFS: IPFSConfig{
			APIURL: getEnvString("IPFS_API_URL", "http://localhost:5001"),
		},
	}

	return nil
}

func getEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intVal
		}
	}
	return defaultValue
}
