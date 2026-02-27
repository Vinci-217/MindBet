package services

import (
	"mindbet-backend/internal/models"
	"time"
)

func GetUserProfile(address string) (*models.UserProfile, error) {
	var profile models.UserProfile
	err := models.DB.Where("user_address = ?", address).First(&profile).Error
	if err != nil {
		profile = models.UserProfile{
			UserAddress: address,
			Name:        "普通用户",
			TotalBets:   0,
			WinBets:     0,
			TotalPnL:    0,
			TotalVolume: 0,
		}
	}
	return &profile, nil
}

func UpdateUserName(address string, name string) error {
	profile, err := GetUserProfile(address)
	if err != nil {
		return err
	}
	profile.Name = name
	return models.DB.Save(&profile).Error
}

type BetHistoryItem struct {
	models.Transaction
	MarketTitle    string `json:"market_title"`
	MarketStatus   int8   `json:"market_status"`
	MarketResult   int8   `json:"market_result"`
	MarketDeadline int64  `json:"market_deadline"`
}

func GetUserBetHistory(address string, page, pageSize int, status string) ([]BetHistoryItem, int64, error) {
	var items []BetHistoryItem
	var total int64

	query := models.DB.Table("transactions t").
		Select(`t.*, m.title as market_title, m.status as market_status, 
				m.result as market_result, m.deadline as market_deadline`).
		Joins("LEFT JOIN markets m ON t.content_hash = m.content_hash").
		Where("t.user_address = ? AND t.tx_type = ?", address, models.TxTypeBet)

	if status != "" {
		query = query.Where("m.status = ?", status)
	}

	countQuery := models.DB.Table("transactions").Where("user_address = ? AND tx_type = ?", address, models.TxTypeBet)
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("t.created_at DESC").Offset(offset).Limit(pageSize).Scan(&items).Error; err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

type ClaimHistoryItem struct {
	models.Transaction
	MarketTitle string `json:"market_title"`
}

func GetUserClaimHistory(address string, page, pageSize int) ([]ClaimHistoryItem, int64, error) {
	var items []ClaimHistoryItem
	var total int64

	query := models.DB.Table("transactions t").
		Select("t.*, m.title as market_title").
		Joins("LEFT JOIN markets m ON t.content_hash = m.content_hash").
		Where("t.user_address = ? AND t.tx_type = ?", address, models.TxTypeClaim)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("t.created_at DESC").Offset(offset).Limit(pageSize).Scan(&items).Error; err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

type UserStats struct {
	UserAddress  string  `json:"user_address"`
	TotalBets    uint64  `json:"total_bets"`
	WinBets      uint64  `json:"win_bets"`
	WinRate      float64 `json:"win_rate"`
	TotalPnL     int64   `json:"total_pnl"`
	TotalVolume  uint64  `json:"total_volume"`
	TotalClaimed uint64  `json:"total_claimed"`
}

func GetUserStats(address string) (*UserStats, error) {
	profile, err := GetUserProfile(address)
	if err != nil {
		return nil, err
	}

	var totalClaimed uint64
	models.DB.Model(&models.Transaction{}).
		Where("user_address = ? AND tx_type = ? AND tx_status = ?", 
			address, models.TxTypeClaim, models.TxStatusSuccess).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&totalClaimed)

	winRate := float64(0)
	if profile.TotalBets > 0 {
		winRate = float64(profile.WinBets) / float64(profile.TotalBets) * 100
	}

	return &UserStats{
		UserAddress:  address,
		TotalBets:    profile.TotalBets,
		WinBets:      profile.WinBets,
		WinRate:      winRate,
		TotalPnL:     profile.TotalPnL,
		TotalVolume:  profile.TotalVolume,
		TotalClaimed: totalClaimed,
	}, nil
}

type UserMarketItem struct {
	models.Market
	TimeLeft int64 `json:"time_left"`
}

func GetUserCreatedMarkets(address string, page, pageSize int) ([]UserMarketItem, int64, error) {
	var markets []models.Market
	var total int64

	query := models.DB.Model(&models.Market{}).Where("creator_address = ?", address)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&markets).Error; err != nil {
		return nil, 0, err
	}

	now := time.Now().Unix()
	var items []UserMarketItem
	for _, m := range markets {
		items = append(items, UserMarketItem{
			Market:   m,
			TimeLeft: m.Deadline - now,
		})
	}

	return items, total, nil
}
