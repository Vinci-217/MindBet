package routes

import (
	"mindbet-backend/internal/controllers"
	"mindbet-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		markets := api.Group("/markets")
		{
			markets.GET("", controllers.GetMarketList)
			markets.GET("/check/:hash", controllers.CheckContentHash)
			markets.GET("/:id", controllers.GetMarket)
			markets.POST("", controllers.CreateMarket)
			markets.POST("/:id/bet", controllers.PlaceBet)
			markets.POST("/:id/claim", controllers.PrepareClaim)
			markets.GET("/:id/bets", controllers.GetUserBets)
			markets.GET("/:id/transactions", controllers.GetMarketTransactions)
		}
		users := api.Group("/users")
		{
			users.GET("/:address/profile", controllers.GetUserProfile)
			users.PUT("/:address/profile", controllers.UpdateUserProfile)
			users.GET("/:address/bets", controllers.GetUserBetsHistory)
			users.GET("/:address/claims", controllers.GetUserClaims)
			users.GET("/:address/stats", controllers.GetUserStats)
			users.GET("/:address/markets", controllers.GetUserCreatedMarkets)
			users.GET("/:address/transactions", controllers.GetUserTransactions)
		}
		admin := api.Group("/admin")
		admin.Use(middleware.JWTAuth())
		{
			admin.POST("/markets/:id/resolve", controllers.ResolveMarket)
			admin.POST("/markets/:id/cancel", controllers.CancelMarket)
			admin.GET("/stats", controllers.GetStats)
			admin.GET("/markets/pending", controllers.GetPendingMarkets)
		}
		telegram := api.Group("/telegram")
		{
			telegram.POST("/bind", controllers.BindWallet)
			telegram.GET("/binding", controllers.GetBinding)
			telegram.DELETE("/binding", controllers.UnbindWallet)
			telegram.GET("/claimable", controllers.GetClaimableMarkets)
			telegram.GET("/refundable", controllers.GetRefundableMarkets)
			telegram.GET("/resolved", controllers.GetResolvedMarkets)
			telegram.GET("/balance", controllers.GetWalletBalance)
		}
	}
}
