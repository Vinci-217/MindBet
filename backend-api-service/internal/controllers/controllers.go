package controllers

import (
	"net/http"
	"strconv"

	"mindbet-backend/internal/models"
	"mindbet-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type CreateMarketRequest struct {
	Title          string `json:"title" binding:"required"`
	Description    string `json:"description"`
	Category       string `json:"category"`
	Deadline       int64  `json:"deadline" binding:"required"`
	CreatorAddress string `json:"creator_address" binding:"required"`
	ContentHash    string `json:"content_hash" binding:"required"`
}

func GetMarketList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "12"))
	status := c.Query("status")
	category := c.Query("category")

	markets, total, err := services.GetMarketList(page, pageSize, status, category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list":  markets,
			"total": total,
			"page":  page,
			"page_size": pageSize,
		},
	})
}

func GetMarket(c *gin.Context) {
	idOrHash := c.Param("id")
	
	var market *models.Market
	var err error
	
	if len(idOrHash) >= 2 && idOrHash[:2] == "0x" {
		market, err = services.GetMarketByContentHash(idOrHash)
	} else {
		id, _ := strconv.ParseUint(idOrHash, 10, 64)
		market, err = services.GetMarketByID(id)
	}
	
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "market not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    market,
	})
}

func CheckContentHash(c *gin.Context) {
	contentHash := c.Param("hash")
	
	exists, err := services.CheckContentHashExists(contentHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"exists": exists,
		},
	})
}

func CreateMarket(c *gin.Context) {
	var req CreateMarketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	exists, _ := services.CheckContentHashExists(req.ContentHash)
	if exists {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "market already exists",
		})
		return
	}

	result, err := services.SaveMarketDetails(
		req.Title,
		req.Description,
		req.Category,
		req.Deadline,
		req.CreatorAddress,
		req.ContentHash,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetMarketTransactions(c *gin.Context) {
	contentHash := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	txs, total, err := services.GetMarketTransactions(contentHash, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list":  txs,
			"total": total,
		},
	})
}

func PlaceBet(c *gin.Context) {
	contentHash := c.Param("id")

	var req struct {
		TxHash      string `json:"tx_hash" binding:"required"`
		Amount      string `json:"amount" binding:"required"`
		BetType     bool   `json:"bet_type"`
		UserAddress string `json:"user_address" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	amountUint, err := strconv.ParseUint(req.Amount, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid amount"})
		return
	}

	result, err := services.SaveBet(req.TxHash, contentHash, req.UserAddress, amountUint, req.BetType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func PrepareClaim(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "claim prepared"})
}

func GetUserBets(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
}

func GetUserProfile(c *gin.Context) {
	address := c.Param("address")
	
	profile, err := services.GetUserProfile(address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    profile,
	})
}

func UpdateUserProfile(c *gin.Context) {
	address := c.Param("address")
	
	var req struct {
		Name string `json:"name"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	
	err := services.UpdateUserName(address, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "profile updated",
	})
}

func GetUserBetsHistory(c *gin.Context) {
	address := c.Param("address")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	status := c.Query("status")

	items, total, err := services.GetUserBetHistory(address, page, pageSize, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list":  items,
			"total": total,
			"page":  page,
			"page_size": pageSize,
		},
	})
}

func GetUserClaims(c *gin.Context) {
	address := c.Param("address")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	items, total, err := services.GetUserClaimHistory(address, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list":  items,
			"total": total,
			"page":  page,
			"page_size": pageSize,
		},
	})
}

func GetUserStats(c *gin.Context) {
	address := c.Param("address")
	
	stats, err := services.GetUserStats(address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

func GetUserTransactions(c *gin.Context) {
	address := c.Param("address")
	txType := c.Query("type")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	var items interface{}
	var total int64
	var err error

	switch txType {
	case "bets":
		items, total, err = services.GetUserBetHistory(address, page, pageSize, "")
	case "claims":
		items, total, err = services.GetUserClaimHistory(address, page, pageSize)
	case "created":
		items, total, err = services.GetUserCreatedMarkets(address, page, pageSize)
	default:
		items, total, err = services.GetUserBetHistory(address, page, pageSize, "")
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list":  items,
			"total": total,
			"page":  page,
			"page_size": pageSize,
		},
	})
}

func GetUserCreatedMarkets(c *gin.Context) {
	address := c.Param("address")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	markets, total, err := services.GetUserCreatedMarkets(address, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list":  markets,
			"total": total,
			"page":  page,
			"page_size": pageSize,
		},
	})
}

func ResolveMarket(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "market resolved"})
}

func CancelMarket(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "market cancelled"})
}

func GetStats(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"total_markets": 0,
		"total_volume":  0,
		"total_users":   0,
	}})
}

func GetPendingMarkets(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": []interface{}{}})
}
