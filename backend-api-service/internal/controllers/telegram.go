package controllers

import (
	"net/http"
	"strconv"

	"mindbet-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type BindWalletRequest struct {
	TelegramID   int64  `json:"telegram_id" binding:"required"`
	WalletAddress string `json:"wallet_address" binding:"required"`
	Signature     string `json:"signature" binding:"required"`
	Username      string `json:"username"`
}

type GetBindingRequest struct {
	TelegramID int64 `json:"telegram_id" binding:"required"`
}

func BindWallet(c *gin.Context) {
	var req BindWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	err := services.BindWallet(req.TelegramID, req.WalletAddress, req.Signature, req.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "钱包绑定成功",
	})
}

func GetBinding(c *gin.Context) {
	telegramIDStr := c.Query("telegram_id")
	if telegramIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "缺少 telegram_id 参数"})
		return
	}

	telegramID, err := strconv.ParseInt(telegramIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "无效的 telegram_id"})
		return
	}

	user, err := services.GetTelegramUser(telegramID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "用户未绑定"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"telegram_id":     user.TelegramID,
			"wallet_address": user.WalletAddress,
			"username":       user.Username,
			"created_at":     user.CreatedAt,
		},
	})
}

func UnbindWallet(c *gin.Context) {
	telegramIDStr := c.Query("telegram_id")
	if telegramIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "缺少 telegram_id 参数"})
		return
	}

	telegramID, err := strconv.ParseInt(telegramIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "无效的 telegram_id"})
		return
	}

	err = services.UnbindWallet(telegramID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "钱包解绑成功",
	})
}

func GetClaimableMarkets(c *gin.Context) {
	telegramIDStr := c.Query("telegram_id")
	if telegramIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "缺少 telegram_id 参数"})
		return
	}

	telegramID, err := strconv.ParseInt(telegramIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "无效的 telegram_id"})
		return
	}

	user, err := services.GetTelegramUser(telegramID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "用户未绑定"})
		return
	}

	markets, err := services.GetClaimableMarkets(user.WalletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list": markets,
		},
	})
}

func GetRefundableMarkets(c *gin.Context) {
	telegramIDStr := c.Query("telegram_id")
	if telegramIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "缺少 telegram_id 参数"})
		return
	}

	telegramID, err := strconv.ParseInt(telegramIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "无效的 telegram_id"})
		return
	}

	user, err := services.GetTelegramUser(telegramID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "用户未绑定"})
		return
	}

	markets, err := services.GetRefundableMarkets(user.WalletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list": markets,
		},
	})
}

func GetResolvedMarkets(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	markets, total, err := services.GetResolvedMarkets(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
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

func GetWalletBalance(c *gin.Context) {
	telegramIDStr := c.Query("telegram_id")
	if telegramIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "缺少 telegram_id 参数"})
		return
	}

	telegramID, err := strconv.ParseInt(telegramIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "无效的 telegram_id"})
		return
	}

	user, err := services.GetTelegramUser(telegramID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "用户未绑定"})
		return
	}

	balance, err := services.GetWalletBalance(user.WalletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"wallet_address": user.WalletAddress,
			"balance":        balance,
		},
	})
}
