package indexer

import (
	"math/big"
	"time"

	"mindbet-indexer/internal/models"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

var (
	MarketCreatedSig   = crypto.Keccak256Hash([]byte("MarketCreated(bytes32,uint256,address,address)"))
	BetPlacedSig       = crypto.Keccak256Hash([]byte("BetPlaced(bytes32,address,bool,uint256,uint256,uint256)"))
	MarketClosedSig    = crypto.Keccak256Hash([]byte("MarketClosed(bytes32)"))
	MarketResolvedSig  = crypto.Keccak256Hash([]byte("MarketResolved(bytes32,uint8,uint256,uint256)"))
	BetClaimedSig      = crypto.Keccak256Hash([]byte("BetClaimed(bytes32,address,uint256)"))
	MarketCancelledSig = crypto.Keccak256Hash([]byte("MarketCancelled(bytes32)"))
	BetRefundedSig     = crypto.Keccak256Hash([]byte("BetRefunded(bytes32,address,uint256)"))
	DepositClaimedSig  = crypto.Keccak256Hash([]byte("DepositClaimed(bytes32,address,uint256)"))
)

func (i *EventIndexer) processLog(vLog types.Log) error {
	if len(vLog.Topics) == 0 {
		return nil
	}

	switch vLog.Topics[0].Hex() {
	case MarketCreatedSig.Hex():
		return i.handleMarketCreated(vLog)
	case BetPlacedSig.Hex():
		return i.handleBetPlaced(vLog)
	case MarketClosedSig.Hex():
		return i.handleMarketClosed(vLog)
	case MarketResolvedSig.Hex():
		return i.handleMarketResolved(vLog)
	case BetClaimedSig.Hex():
		return i.handleBetClaimed(vLog)
	case MarketCancelledSig.Hex():
		return i.handleMarketCancelled(vLog)
	case BetRefundedSig.Hex():
		return i.handleBetRefunded(vLog)
	case DepositClaimedSig.Hex():
		return i.handleDepositClaimed(vLog)
	default:
		return nil
	}
}

func (i *EventIndexer) handleMarketCreated(vLog types.Log) error {
	if len(vLog.Topics) < 4 {
		return nil
	}

	contentHash := common.BytesToHash(vLog.Topics[1].Bytes())
	creator := common.BytesToAddress(vLog.Topics[2].Bytes())
	groupOwner := common.BytesToAddress(vLog.Topics[3].Bytes())

	var deadline uint64
	if len(vLog.Data) >= 32 {
		deadline = new(big.Int).SetBytes(vLog.Data[:32]).Uint64()
	}

	var existingMarket models.Market
	if err := models.DB.Where("content_hash = ?", contentHash.Hex()).First(&existingMarket).Error; err == nil {
		return nil
	}

	market := models.Market{
		ContentHash:    contentHash.Hex(),
		CreatorAddress: creator.Hex(),
		GroupOwnerAddr: groupOwner.Hex(),
		Deadline:       int64(deadline),
		Status:         models.MarketStatusOpen,
	}

	if err := models.DB.Create(&market).Error; err != nil {
		return err
	}

	tx := models.Transaction{
		TxHash:      vLog.TxHash.Hex(),
		ContentHash: contentHash.Hex(),
		UserAddress: creator.Hex(),
		Amount:      1000000000000000000,
		TxType:      models.TxTypeCreateMarket,
		TxStatus:    models.TxStatusSuccess,
	}
	if err := models.DB.Create(&tx).Error; err != nil {
		return err
	}

	depositAmount := uint64(1000000000000000000)
	position := models.UserPosition{
		UserAddress:   creator.Hex(),
		ContentHash:   contentHash.Hex(),
		Role:          models.PositionRoleCreator,
		DepositAmount: depositAmount,
		HasClaimed:    false,
		HasRefunded:   false,
	}
	return models.DB.Create(&position).Error
}

func (i *EventIndexer) handleBetPlaced(vLog types.Log) error {
	if len(vLog.Topics) < 3 {
		return nil
	}

	contentHash := common.BytesToHash(vLog.Topics[1].Bytes())
	user := common.BytesToAddress(vLog.Topics[2].Bytes())

	var market models.Market
	if err := models.DB.Where("content_hash = ?", contentHash.Hex()).First(&market).Error; err != nil {
		return err
	}

	if len(vLog.Data) >= 160 {
		betType := new(big.Int).SetBytes(vLog.Data[:32])
		amount := new(big.Int).SetBytes(vLog.Data[32:64])
		totalYesPool := new(big.Int).SetBytes(vLog.Data[64:96])
		totalNoPool := new(big.Int).SetBytes(vLog.Data[96:128])

		outcome := int8(2)
		if betType.Cmp(big.NewInt(1)) == 0 {
			outcome = 1
		}

		market.TotalYesPool = totalYesPool.Uint64()
		market.TotalNoPool = totalNoPool.Uint64()
		models.DB.Save(&market)

		tx := models.Transaction{
			TxHash:      vLog.TxHash.Hex(),
			ContentHash: contentHash.Hex(),
			UserAddress: user.Hex(),
			Amount:      amount.Uint64(),
			Outcome:     &outcome,
			TxType:      models.TxTypeBet,
			TxStatus:    models.TxStatusSuccess,
		}
		if err := models.DB.Create(&tx).Error; err != nil {
			return err
		}

		var position models.UserPosition
		err := models.DB.Where("user_address = ? AND content_hash = ? AND role = ?",
			user.Hex(), contentHash.Hex(), models.PositionRoleBettor).First(&position).Error
		if err != nil {
			position = models.UserPosition{
				UserAddress: user.Hex(),
				ContentHash: contentHash.Hex(),
				Role:        models.PositionRoleBettor,
				BetOutcome:  &outcome,
				BetAmount:   amount.Uint64(),
				HasClaimed:  false,
				HasRefunded: false,
			}
			if err := models.DB.Create(&position).Error; err != nil {
				return err
			}
		} else {
			position.BetAmount += amount.Uint64()
			if err := models.DB.Save(&position).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func (i *EventIndexer) handleMarketClosed(vLog types.Log) error {
	if len(vLog.Topics) < 2 {
		return nil
	}
	contentHash := common.BytesToHash(vLog.Topics[1].Bytes())
	return models.DB.Model(&models.Market{}).
		Where("content_hash = ?", contentHash.Hex()).
		Update("status", models.MarketStatusClosed).Error
}

func (i *EventIndexer) handleMarketResolved(vLog types.Log) error {
	if len(vLog.Topics) < 2 {
		return nil
	}
	contentHash := common.BytesToHash(vLog.Topics[1].Bytes())

	result := uint8(0)
	var totalYesPool, totalNoPool uint64
	if len(vLog.Data) >= 96 {
		result = uint8(new(big.Int).SetBytes(vLog.Data[:32]).Uint64())
		totalYesPool = new(big.Int).SetBytes(vLog.Data[32:64]).Uint64()
		totalNoPool = new(big.Int).SetBytes(vLog.Data[64:96]).Uint64()
	}

	resolvedAt := time.Now().Unix()

	return models.DB.Model(&models.Market{}).
		Where("content_hash = ?", contentHash.Hex()).
		Updates(map[string]interface{}{
			"status":        models.MarketStatusResolved,
			"result":        result,
			"resolved_at":   resolvedAt,
			"total_yes_pool": totalYesPool,
			"total_no_pool": totalNoPool,
		}).Error
}

func (i *EventIndexer) handleBetClaimed(vLog types.Log) error {
	if len(vLog.Topics) < 3 {
		return nil
	}
	contentHash := common.BytesToHash(vLog.Topics[1].Bytes())
	user := common.BytesToAddress(vLog.Topics[2].Bytes())

	var market models.Market
	if err := models.DB.Where("content_hash = ?", contentHash.Hex()).First(&market).Error; err != nil {
		return err
	}

	amount := uint64(0)
	if len(vLog.Data) >= 32 {
		amount = new(big.Int).SetBytes(vLog.Data[:32]).Uint64()
	}

	tx := models.Transaction{
		TxHash:      vLog.TxHash.Hex(),
		ContentHash: contentHash.Hex(),
		UserAddress: user.Hex(),
		Amount:      amount,
		TxType:      models.TxTypeClaim,
		TxStatus:    models.TxStatusSuccess,
	}

	if err := models.DB.Create(&tx).Error; err != nil {
		return err
	}

	now := time.Now()
	models.DB.Model(&models.UserPosition{}).
		Where("user_address = ? AND content_hash = ? AND role = ?", user.Hex(), contentHash.Hex(), models.PositionRoleBettor).
		Updates(map[string]interface{}{
			"has_claimed": true,
			"claimed_at":  &now,
		})

	return i.updateUserProfile(user.Hex(), market.Result, amount)
}

func (i *EventIndexer) handleMarketCancelled(vLog types.Log) error {
	if len(vLog.Topics) < 2 {
		return nil
	}
	contentHash := common.BytesToHash(vLog.Topics[1].Bytes())
	now := time.Now().Unix()

	return models.DB.Model(&models.Market{}).
		Where("content_hash = ?", contentHash.Hex()).
		Updates(map[string]interface{}{
			"status":      models.MarketStatusCancelled,
			"resolved_at": now,
		}).Error
}

func (i *EventIndexer) handleBetRefunded(vLog types.Log) error {
	if len(vLog.Topics) < 3 {
		return nil
	}
	contentHash := common.BytesToHash(vLog.Topics[1].Bytes())
	user := common.BytesToAddress(vLog.Topics[2].Bytes())

	var market models.Market
	if err := models.DB.Where("content_hash = ?", contentHash.Hex()).First(&market).Error; err != nil {
		return err
	}

	amount := uint64(0)
	if len(vLog.Data) >= 32 {
		amount = new(big.Int).SetBytes(vLog.Data[:32]).Uint64()
	}

	tx := models.Transaction{
		TxHash:      vLog.TxHash.Hex(),
		ContentHash: contentHash.Hex(),
		UserAddress: user.Hex(),
		Amount:      amount,
		TxType:      models.TxTypeRefund,
		TxStatus:    models.TxStatusSuccess,
	}

	if err := models.DB.Create(&tx).Error; err != nil {
		return err
	}

	now := time.Now()
	return models.DB.Model(&models.UserPosition{}).
		Where("user_address = ? AND content_hash = ? AND role = ?", user.Hex(), contentHash.Hex(), models.PositionRoleBettor).
		Updates(map[string]interface{}{
			"has_refunded": true,
			"claimed_at":   &now,
		}).Error
}

func (i *EventIndexer) handleDepositClaimed(vLog types.Log) error {
	if len(vLog.Topics) < 3 {
		return nil
	}
	contentHash := common.BytesToHash(vLog.Topics[1].Bytes())
	creator := common.BytesToAddress(vLog.Topics[2].Bytes())

	amount := uint64(0)
	if len(vLog.Data) >= 32 {
		amount = new(big.Int).SetBytes(vLog.Data[:32]).Uint64()
	}

	tx := models.Transaction{
		TxHash:      vLog.TxHash.Hex(),
		ContentHash: contentHash.Hex(),
		UserAddress: creator.Hex(),
		Amount:      amount,
		TxType:      models.TxTypeDepositRefund,
		TxStatus:    models.TxStatusSuccess,
	}

	if err := models.DB.Create(&tx).Error; err != nil {
		return err
	}

	now := time.Now()
	return models.DB.Model(&models.UserPosition{}).
		Where("user_address = ? AND content_hash = ? AND role = ?", creator.Hex(), contentHash.Hex(), models.PositionRoleCreator).
		Updates(map[string]interface{}{
			"has_claimed": true,
			"claimed_at":  &now,
		}).Error
}

func (i *EventIndexer) updateUserProfile(userAddress string, marketResult models.MarketResult, claimAmount uint64) error {
	var profile models.UserProfile
	err := models.DB.Where("user_address = ?", userAddress).First(&profile).Error
	if err != nil {
		profile = models.UserProfile{
			UserAddress: userAddress,
		}
	}

	profile.TotalBets++
	if claimAmount > 0 {
		profile.WinBets++
		profile.TotalPnL += int64(claimAmount)
	}
	profile.TotalVolume += claimAmount

	return models.DB.Save(&profile).Error
}
