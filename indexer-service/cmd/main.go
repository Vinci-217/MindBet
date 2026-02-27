package main

import (
	"fmt"
	"log"
	"time"

	"mindbet-indexer/internal/indexer"
	"mindbet-indexer/internal/models"

	"github.com/spf13/viper"
)

func main() {
	viper.AutomaticEnv()

	rpcURL := viper.GetString("BLOCKCHAIN_RPC_URL")
	contractAddr := viper.GetString("CONTRACT_ADDRESS")
	mysqlHost := viper.GetString("MYSQL_HOST")
	mysqlPort := viper.GetInt("MYSQL_PORT")
	mysqlUser := viper.GetString("MYSQL_USER")
	mysqlPassword := viper.GetString("MYSQL_PASSWORD")
	mysqlDB := viper.GetString("MYSQL_DATABASE")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		mysqlUser, mysqlPassword, mysqlHost, mysqlPort, mysqlDB)

	if err := models.InitDB(dsn); err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}
	log.Println("Database connected successfully")

	eventIndexer, err := indexer.NewEventIndexer(rpcURL, contractAddr)
	if err != nil {
		log.Fatalf("Failed to create event indexer: %v", err)
	}
	log.Println("Event indexer initialized")

	pollInterval := 15 * time.Second
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	lastBlock := eventIndexer.GetLastIndexedBlock()
	log.Printf("Starting from block %d", lastBlock)

	for range ticker.C {
		newLastBlock, err := syncBlocks(eventIndexer, lastBlock)
		if err != nil {
			log.Printf("Error syncing blocks: %v", err)
		} else if newLastBlock > lastBlock {
			lastBlock = newLastBlock
		}
	}
}

func syncBlocks(indexer *indexer.EventIndexer, lastBlock uint64) (uint64, error) {
	latestBlock, err := indexer.GetLatestBlockNumber()
	if err != nil {
		return lastBlock, err
	}

	if latestBlock <= lastBlock {
		return lastBlock, nil
	}

	fromBlock := lastBlock + 1
	toBlock := latestBlock

	if toBlock-fromBlock > 1000 {
		toBlock = fromBlock + 1000
	}

	log.Printf("Indexing blocks %d to %d", fromBlock, toBlock)

	if err := indexer.IndexEvents(fromBlock, toBlock); err != nil {
		return lastBlock, err
	}

	log.Printf("Indexed blocks %d to %d", fromBlock, toBlock)
	return toBlock, nil
}
