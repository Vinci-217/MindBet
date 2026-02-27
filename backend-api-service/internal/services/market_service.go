package services

import (
	"fmt"
	"time"

	"mindbet-backend/internal/models"
)

func GetMarketList(page, pageSize int, status, category string) ([]models.Market, int64, error) {
	var markets []models.Market
	var total int64

	query := models.DB.Model(&models.Market{})

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&markets).Error; err != nil {
		return nil, 0, err
	}

	return markets, total, nil
}

func GetMarketByID(id uint64) (*models.Market, error) {
	var market models.Market
	if err := models.DB.Where("id = ?", id).First(&market).Error; err != nil {
		return nil, err
	}
	return &market, nil
}

func GetMarketByContentHash(contentHash string) (*models.Market, error) {
	var market models.Market
	if err := models.DB.Where("content_hash = ?", contentHash).First(&market).Error; err != nil {
		return nil, err
	}
	return &market, nil
}

func CheckContentHashExists(contentHash string) (bool, error) {
	var count int64
	if err := models.DB.Model(&models.Market{}).Where("content_hash = ?", contentHash).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

type CreateMarketResult struct {
	ContentHash string `json:"content_hash"`
}

func SaveMarketDetails(title, description, category string, deadline int64, creatorAddress, contentHash string) (*CreateMarketResult, error) {
	market := models.Market{
		ContentHash:    contentHash,
		Title:          title,
		Description:    description,
		Category:       category,
		Deadline:       deadline,
		CreatorAddress: creatorAddress,
		GroupOwnerAddr: "0x0000000000000000000000000000000000000000",
		Status:         models.MarketStatusOpen,
	}

	if err := models.DB.Create(&market).Error; err != nil {
		return nil, err
	}

	depositAmount := uint64(1000000000000000000)
	if err := CreateOrUpdateUserPosition(creatorAddress, contentHash, models.PositionRoleCreator, nil, 0, depositAmount); err != nil {
		fmt.Printf("Warning: failed to create creator position: %v\n", err)
	}

	return &CreateMarketResult{
		ContentHash: contentHash,
	}, nil
}

type BetResult struct {
	ContentHash   string `json:"content_hash"`
	BetType       bool   `json:"bet_type"`
	Amount        uint64 `json:"amount"`
	ContractAddr  string `json:"contract_address"`
	MinBet        uint64 `json:"min_bet"`
}

func PrepareBet(contentHash string, userAddress string, betType bool, amount uint64) (*BetResult, error) {
	var market models.Market
	if err := models.DB.Where("content_hash = ?", contentHash).First(&market).Error; err != nil {
		return nil, fmt.Errorf("market not found")
	}

	if market.Status != models.MarketStatusOpen {
		return nil, fmt.Errorf("market is not open")
	}

	if market.Deadline > 0 && time.Now().Unix() > market.Deadline-30*60 {
		return nil, fmt.Errorf("market is closing soon")
	}

	return &BetResult{
		ContentHash:  contentHash,
		BetType:      betType,
		Amount:       amount,
		ContractAddr: GetContractAddress(),
		MinBet:       100000,
	}, nil
}

type ClaimResult struct {
	ContentHash string `json:"content_hash"`
	UserAddress string `json:"user_address"`
	CanClaim    bool   `json:"can_claim"`
}

func PrepareClaim(contentHash string, userAddress string) (*ClaimResult, error) {
	var market models.Market
	if err := models.DB.Where("content_hash = ?", contentHash).First(&market).Error; err != nil {
		return nil, fmt.Errorf("market not found")
	}

	if market.Status != models.MarketStatusResolved {
		return nil, fmt.Errorf("market not resolved")
	}

	return &ClaimResult{
		ContentHash: contentHash,
		UserAddress: userAddress,
		CanClaim:    true,
	}, nil
}

func GetUserBets(contentHash string, userAddress string) (map[string]interface{}, error) {
	var txs []models.Transaction
	if err := models.DB.Where("content_hash = ? AND user_address = ? AND tx_type = ?", 
		contentHash, userAddress, models.TxTypeBet).Find(&txs).Error; err != nil {
		return nil, err
	}

	var totalAmount uint64
	var betType *bool
	for _, tx := range txs {
		totalAmount += tx.Amount
		if tx.Outcome != nil {
			b := *tx.Outcome == 1
			betType = &b
		}
	}

	result := map[string]interface{}{
		"content_hash": contentHash,
		"user_address": userAddress,
		"total_amount": totalAmount,
		"bet_count":    len(txs),
	}

	if betType != nil {
		result["bet_type"] = *betType
	}

	return result, nil
}

func GetMarketTransactions(contentHash string, page, pageSize int) ([]models.Transaction, int64, error) {
	var txs []models.Transaction
	var total int64

	query := models.DB.Model(&models.Transaction{}).Where("content_hash = ?", contentHash)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&txs).Error; err != nil {
		return nil, 0, err
	}

	return txs, total, nil
}

type SaveBetResult struct {
	TxHash     string `json:"tx_hash"`
	ContentHash string `json:"content_hash"`
	UserAddress string `json:"user_address"`
	Amount     uint64 `json:"amount"`
	Outcome    int8   `json:"outcome"`
}

func SaveBet(txHash, contentHash, userAddress string, amount uint64, betType bool) (*SaveBetResult, error) {
	exists, err := CheckContentHashExists(contentHash)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("market not found")
	}

	outcome := int8(1)
	if !betType {
		outcome = int8(2)
	}

	tx := models.Transaction{
		TxHash:      txHash,
		ContentHash: contentHash,
		UserAddress: userAddress,
		Amount:      amount,
		Outcome:     &outcome,
		TxType:      models.TxTypeBet,
		TxStatus:    models.TxStatusSuccess,
	}

	if err := models.DB.Create(&tx).Error; err != nil {
		return nil, err
	}

	var market models.Market
	if err := models.DB.Where("content_hash = ?", contentHash).First(&market).Error; err != nil {
		return nil, err
	}

	if betType {
		market.TotalYesPool += amount
	} else {
		market.TotalNoPool += amount
	}

	if err := models.DB.Save(&market).Error; err != nil {
		return nil, err
	}

	if err := CreateOrUpdateUserPosition(userAddress, contentHash, models.PositionRoleBettor, &outcome, amount, 0); err != nil {
		fmt.Printf("Warning: failed to update bettor position: %v\n", err)
	}

	return &SaveBetResult{
		TxHash:      txHash,
		ContentHash: contentHash,
		UserAddress: userAddress,
		Amount:      amount,
		Outcome:     outcome,
	}, nil
}

type SaveClaimResult struct {
	TxHash      string `json:"tx_hash"`
	ContentHash string `json:"content_hash"`
	UserAddress string `json:"user_address"`
	Amount      uint64 `json:"amount"`
	IsCreator   bool   `json:"is_creator"`
}

func SaveClaim(txHash, contentHash, userAddress string, amount uint64, isCreator bool) (*SaveClaimResult, error) {
	tx := models.Transaction{
		TxHash:      txHash,
		ContentHash: contentHash,
		UserAddress: userAddress,
		Amount:      amount,
		TxType:      models.TxTypeClaim,
		TxStatus:    models.TxStatusSuccess,
	}

	if isCreator {
		tx.TxType = models.TxTypeDepositRefund
	}

	if err := models.DB.Create(&tx).Error; err != nil {
		return nil, err
	}

	role := models.PositionRoleBettor
	if isCreator {
		role = models.PositionRoleCreator
	}

	if err := MarkPositionClaimed(userAddress, contentHash, role); err != nil {
		fmt.Printf("Warning: failed to mark position as claimed: %v\n", err)
	}

	return &SaveClaimResult{
		TxHash:      txHash,
		ContentHash: contentHash,
		UserAddress: userAddress,
		Amount:      amount,
		IsCreator:   isCreator,
	}, nil
}

type SaveRefundResult struct {
	TxHash      string `json:"tx_hash"`
	ContentHash string `json:"content_hash"`
	UserAddress string `json:"user_address"`
	Amount      uint64 `json:"amount"`
	IsCreator   bool   `json:"is_creator"`
}

func SaveRefund(txHash, contentHash, userAddress string, amount uint64, isCreator bool) (*SaveRefundResult, error) {
	tx := models.Transaction{
		TxHash:      txHash,
		ContentHash: contentHash,
		UserAddress: userAddress,
		Amount:      amount,
		TxType:      models.TxTypeRefund,
		TxStatus:    models.TxStatusSuccess,
	}

	if isCreator {
		tx.TxType = models.TxTypeDepositRefund
	}

	if err := models.DB.Create(&tx).Error; err != nil {
		return nil, err
	}

	role := models.PositionRoleBettor
	if isCreator {
		role = models.PositionRoleCreator
	}

	if err := MarkPositionRefunded(userAddress, contentHash, role); err != nil {
		fmt.Printf("Warning: failed to mark position as refunded: %v\n", err)
	}

	return &SaveRefundResult{
		TxHash:      txHash,
		ContentHash: contentHash,
		UserAddress: userAddress,
		Amount:      amount,
		IsCreator:   isCreator,
	}, nil
}

func UpdateMarketStatus(contentHash string, status models.MarketStatus, result models.MarketResult) error {
	updates := map[string]interface{}{
		"status": status,
	}

	if status == models.MarketStatusResolved {
		now := time.Now().Unix()
		updates["result"] = result
		updates["resolved_at"] = now
	}

	return models.DB.Model(&models.Market{}).
		Where("content_hash = ?", contentHash).
		Updates(updates).Error
}
