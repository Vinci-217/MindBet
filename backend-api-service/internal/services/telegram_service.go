package services

import (
	"errors"
	"time"

	"mindbet-backend/internal/models"

	"gorm.io/gorm"
)

func BindWallet(telegramID int64, walletAddress, signature, username string) error {
	var existingUser models.TelegramUser
	result := models.DB.Where("telegram_id = ?", telegramID).First(&existingUser)

	if result.Error == nil {
		if existingUser.WalletAddress == walletAddress {
			return nil
		}
		existingUser.WalletAddress = walletAddress
		existingUser.Signature = signature
		existingUser.Username = username
		existingUser.UpdatedAt = time.Now()
		return models.DB.Save(&existingUser).Error
	}

	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return result.Error
	}

	newUser := models.TelegramUser{
		TelegramID:    telegramID,
		WalletAddress: walletAddress,
		Signature:     signature,
		Username:      username,
		CreatedAt:     time.Now(),
	}

	return models.DB.Create(&newUser).Error
}

func GetTelegramUser(telegramID int64) (*models.TelegramUser, error) {
	var user models.TelegramUser
	err := models.DB.Where("telegram_id = ?", telegramID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func UnbindWallet(telegramID int64) error {
	return models.DB.Where("telegram_id = ?", telegramID).Delete(&models.TelegramUser{}).Error
}

func GetUserTransactions(walletAddress string) ([]models.Transaction, error) {
	var transactions []models.Transaction
	err := models.DB.Where("user_address = ?", walletAddress).
		Order("created_at DESC").
		Limit(20).
		Find(&transactions).Error
	return transactions, err
}

func GetClaimableMarkets(walletAddress string) ([]models.Market, error) {
	var markets []models.Market

	err := models.DB.Table("user_positions up").
		Select("m.*").
		Joins("INNER JOIN markets m ON m.content_hash = up.content_hash").
		Where("up.user_address = ?", walletAddress).
		Where("up.role = ?", models.PositionRoleBettor).
		Where("up.bet_outcome = m.result").
		Where("up.has_claimed = ?", false).
		Where("m.status = ?", models.MarketStatusResolved).
		Find(&markets).Error

	return markets, err
}

func GetRefundableMarkets(walletAddress string) ([]models.Market, error) {
	var markets []models.Market

	err := models.DB.Table("user_positions up").
		Select("m.*").
		Joins("INNER JOIN markets m ON m.content_hash = up.content_hash").
		Where("up.user_address = ?", walletAddress).
		Where("up.has_refunded = ?", false).
		Where("m.status = ?", models.MarketStatusCancelled).
		Find(&markets).Error

	return markets, err
}

func GetResolvedMarkets(page, pageSize int) ([]models.Market, int64, error) {
	var markets []models.Market
	var total int64

	offset := (page - 1) * pageSize

	err := models.DB.Model(&models.Market{}).
		Where("status = ?", models.MarketStatusResolved).
		Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = models.DB.Where("status = ?", models.MarketStatusResolved).
		Order("resolved_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&markets).Error

	return markets, total, err
}

func GetWalletBalance(walletAddress string) (string, error) {
	balance, err := GetBalance(walletAddress)
	if err != nil {
		return "0", err
	}
	return balance, nil
}

func CreateOrUpdateUserPosition(userAddress, contentHash string, role models.PositionRole, betOutcome *int8, betAmount, depositAmount uint64) error {
	var position models.UserPosition
	err := models.DB.Where("user_address = ? AND content_hash = ? AND role = ?", 
		userAddress, contentHash, role).First(&position).Error

	if err == gorm.ErrRecordNotFound {
		position = models.UserPosition{
			UserAddress:   userAddress,
			ContentHash:   contentHash,
			Role:          role,
			BetOutcome:    betOutcome,
			BetAmount:     betAmount,
			DepositAmount: depositAmount,
			HasClaimed:    false,
			HasRefunded:   false,
		}
		return models.DB.Create(&position).Error
	}

	if err != nil {
		return err
	}

	if betOutcome != nil {
		position.BetOutcome = betOutcome
	}
	position.BetAmount += betAmount
	position.DepositAmount += depositAmount

	return models.DB.Save(&position).Error
}

func MarkPositionClaimed(userAddress, contentHash string, role models.PositionRole) error {
	now := time.Now()
	return models.DB.Model(&models.UserPosition{}).
		Where("user_address = ? AND content_hash = ? AND role = ?", userAddress, contentHash, role).
		Updates(map[string]interface{}{
			"has_claimed": true,
			"claimed_at":  &now,
		}).Error
}

func MarkPositionRefunded(userAddress, contentHash string, role models.PositionRole) error {
	now := time.Now()
	return models.DB.Model(&models.UserPosition{}).
		Where("user_address = ? AND content_hash = ? AND role = ?", userAddress, contentHash, role).
		Updates(map[string]interface{}{
			"has_refunded": true,
			"claimed_at":   &now,
		}).Error
}

func GetUserPosition(userAddress, contentHash string, role models.PositionRole) (*models.UserPosition, error) {
	var position models.UserPosition
	err := models.DB.Where("user_address = ? AND content_hash = ? AND role = ?", 
		userAddress, contentHash, role).First(&position).Error
	if err != nil {
		return nil, err
	}
	return &position, nil
}

func GetUserPositionsByMarket(contentHash string) ([]models.UserPosition, error) {
	var positions []models.UserPosition
	err := models.DB.Where("content_hash = ?", contentHash).Find(&positions).Error
	return positions, err
}
