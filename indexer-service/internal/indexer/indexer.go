package indexer

import (
	"context"
	"math/big"

	"mindbet-indexer/internal/models"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

type EventIndexer struct {
	client       *ethclient.Client
	ctx          context.Context
	contractAddr common.Address
	filterQuery  ethereum.FilterQuery
}

func NewEventIndexer(rpcURL, contractAddr string) (*EventIndexer, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, err
	}

	addr := common.HexToAddress(contractAddr)
	ctx := context.Background()

	return &EventIndexer{
		client:       client,
		ctx:          ctx,
		contractAddr: addr,
		filterQuery: ethereum.FilterQuery{
			Addresses: []common.Address{addr},
		},
	}, nil
}

func (i *EventIndexer) GetLatestBlockNumber() (uint64, error) {
	header, err := i.client.HeaderByNumber(i.ctx, nil)
	if err != nil {
		return 0, err
	}
	return header.Number.Uint64(), nil
}

func (i *EventIndexer) GetLastIndexedBlock() uint64 {
	var state models.IndexerState
	if err := models.DB.Where("contract_name = ?", "PredictionMarket").First(&state).Error; err != nil {
		return 1000
	}
	return state.LastBlock
}

func (i *EventIndexer) UpdateLastIndexedBlock(blockNumber uint64) error {
	return models.DB.Model(&models.IndexerState{}).
		Where("contract_name = ?", "PredictionMarket").
		Update("last_block", blockNumber).Error
}

func (i *EventIndexer) IndexEvents(fromBlock, toBlock uint64) error {
	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(fromBlock)),
		ToBlock:   big.NewInt(int64(toBlock)),
		Addresses: []common.Address{i.contractAddr},
	}

	logs, err := i.client.FilterLogs(i.ctx, query)
	if err != nil {
		return err
	}

	for _, vLog := range logs {
		if err := i.processLog(vLog); err != nil {
			return err
		}
	}

	return i.UpdateLastIndexedBlock(toBlock)
}
