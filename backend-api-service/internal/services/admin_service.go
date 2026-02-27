package services

import (
	"fmt"

	"mindbet-backend/internal/models"
	"mindbet-backend/pkg/config"
)

func ResolveMarket(marketID uint64, result uint8) (map[string]interface{}, error) {
	market, err := GetMarketByID(marketID)
	if err != nil {
		return nil, fmt.Errorf("market not found")
	}

	if market.Status != models.MarketStatusOpen && market.Status != models.MarketStatusClosed {
		return nil, fmt.Errorf("market cannot be resolved in current status")
	}

	return map[string]interface{}{
		"market_id":     marketID,
		"result":        result,
		"contract_addr": GetContractAddress(),
		"message":       "ready to resolve on chain",
	}, nil
}

func CancelMarket(marketID uint64) (map[string]interface{}, error) {
	market, err := GetMarketByID(marketID)
	if err != nil {
		return nil, fmt.Errorf("market not found")
	}

	if market.Status != models.MarketStatusOpen && market.Status != models.MarketStatusClosed {
		return nil, fmt.Errorf("market cannot be cancelled in current status")
	}

	return map[string]interface{}{
		"market_id":     marketID,
		"contract_addr": GetContractAddress(),
		"message":       "ready to cancel on chain",
	}, nil
}

type PlatformStats struct {
	TotalMarkets      int64   `json:"total_markets"`
	OpenMarkets       int64   `json:"open_markets"`
	ResolvedMarkets   int64   `json:"resolved_markets"`
	TotalVolume       uint64  `json:"total_volume"`
	TotalUsers        int64   `json:"total_users"`
	TotalTransactions int64   `json:"total_transactions"`
}

func GetPlatformStats() (*PlatformStats, error) {
	stats := &PlatformStats{}

	models.DB.Model(&models.Market{}).Count(&stats.TotalMarkets)
	models.DB.Model(&models.Market{}).Where("status = ?", models.MarketStatusOpen).Count(&stats.OpenMarkets)
	models.DB.Model(&models.Market{}).Where("status = ?", models.MarketStatusResolved).Count(&stats.ResolvedMarkets)
	models.DB.Model(&models.UserProfile{}).Count(&stats.TotalUsers)
	models.DB.Model(&models.Transaction{}).Count(&stats.TotalTransactions)

	var totalVolume uint64
	models.DB.Model(&models.Transaction{}).
		Where("tx_type = ? AND tx_status = ?", models.TxTypeBet, models.TxStatusSuccess).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&totalVolume)
	stats.TotalVolume = totalVolume

	return stats, nil
}

func GetPendingResolutionMarkets(page, pageSize int) ([]models.Market, int64, error) {
	var markets []models.Market
	var total int64

	query := models.DB.Model(&models.Market{}).
		Where("status IN ? AND deadline < ?", 
			[]models.MarketStatus{models.MarketStatusOpen, models.MarketStatusClosed})

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("deadline ASC").Offset(offset).Limit(pageSize).Find(&markets).Error; err != nil {
		return nil, 0, err
	}

	return markets, total, nil
}

func GetContractAddress() string {
	if config.GlobalConfig != nil {
		return config.GlobalConfig.Chain.ContractAddr
	}
	return ""
}

func GetUSDCAddress() string {
	if config.GlobalConfig != nil {
		return config.GlobalConfig.Chain.USDCAddr
	}
	return ""
}
