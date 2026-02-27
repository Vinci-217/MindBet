package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type WebhookPayload struct {
	Event       string `json:"event"`
	GroupID     string `json:"group_id"`
	UserID      string `json:"user_id"`
	UserName    string `json:"user_name"`
	Message     string `json:"message"`
	MessageID   string `json:"message_id"`
	Timestamp   int64  `json:"timestamp"`
	ReplyToID   string `json:"reply_to_id,omitempty"`
}

type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

type ClientConfig struct {
	BackendAPIURL string
	JWTSecret     string
}

type MessageResponse struct {
	Text        string       `json:"text"`
	ParseMode   string       `json:"parse_mode,omitempty"`
	ReplyMarkup *ReplyMarkup `json:"reply_markup,omitempty"`
}

type ReplyMarkup struct {
	InlineButtons [][]InlineButton `json:"inline_buttons"`
}

type InlineButton struct {
	Text string `json:"text"`
	URL  string `json:"url,omitempty"`
	Data string `json:"callback_data,omitempty"`
}

type Market struct {
	ID             uint64 `json:"id"`
	ChainID        uint64 `json:"chain_id"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	Category       string `json:"category"`
	Status         int    `json:"status"`
	Result         int    `json:"result"`
	TotalYesPool   string `json:"total_yes_pool"`
	TotalNoPool    string `json:"total_no_pool"`
	Deadline       int64  `json:"deadline"`
	CreatorAddress string `json:"creator_address"`
}

type MarketsResponse struct {
	Success bool `json:"success"`
	Data    struct {
		List []Market `json:"list"`
	} `json:"data"`
}

type MarketResponse struct {
	Success bool   `json:"success"`
	Data    Market `json:"data"`
}

type UserProfile struct {
	UserAddress string `json:"user_address"`
	TotalBets   int    `json:"total_bets"`
	WinBets     int    `json:"win_bets"`
	TotalPnL    string `json:"total_pnl"`
	TotalVolume string `json:"total_volume"`
}

type ProfileResponse struct {
	Success bool         `json:"success"`
	Data    UserProfile `json:"data"`
}

func HandleMessage(payload *WebhookPayload, config *ClientConfig) (*Response, error) {
	switch payload.Event {
	case "message":
		return handleMessage(payload, config)
	case "command":
		return handleCommand(payload, config)
	case "callback":
		return handleCallback(payload, config)
	default:
		return &Response{Success: true, Message: "Event received"}, nil
	}
}

func handleMessage(payload *WebhookPayload, config *ClientConfig) (*Response, error) {
	return &Response{
		Success: true,
		Data: MessageResponse{
			Text: "欢迎使用 MindBet！发送 /help 查看可用命令。",
		},
	}, nil
}

func handleCommand(payload *WebhookPayload, config *ClientConfig) (*Response, error) {
	message := payload.Message
	
	switch {
	case message == "/start" || message == "/help":
		return handleStart(payload, config)
	case message == "/markets":
		return handleMarkets(payload, config)
	case len(message) > 8 && message[:8] == "/market ":
		marketID := message[8:]
		return handleMarketDetail(payload, config, marketID)
	case len(message) > 9 && message[:9] == "/profile ":
		address := message[9:]
		return handleProfile(payload, config, address)
	case message == "/create":
		return handleCreateGuide(payload, config)
	case message == "/hot":
		return handleHot(payload, config)
	default:
		return &Response{
			Success: true,
			Data: MessageResponse{
				Text: "未知命令。发送 /help 查看可用命令。",
			},
		}, nil
	}
}

func handleCallback(payload *WebhookPayload, config *ClientConfig) (*Response, error) {
	data := payload.Message
	
	switch {
	case data == "markets":
		return handleMarkets(payload, config)
	case data == "hot":
		return handleHot(payload, config)
	case len(data) > 7 && data[:7] == "market_":
		marketID := data[7:]
		return handleMarketDetail(payload, config, marketID)
	default:
		return &Response{Success: true}, nil
	}
}

func handleStart(payload *WebhookPayload, config *ClientConfig) (*Response, error) {
	text := `🎰 欢迎来到 MindBet!

MindBet 是一个基于区块链的去中心化预测市场平台，使用 Sepolia 测试网的 ETH 进行交易。

可用命令:
/start - 开始使用
/markets - 查看活跃的预测市场
/market <id> - 查看市场详情
/create - 创建新议题指南
/profile <address> - 查看用户资料和战绩
/hot - 获取今日热点话题
/help - 显示帮助信息

使用步骤:
1. 在我们的网站连接钱包
2. 浏览预测市场
3. 使用 ETH 下注
4. 预测正确即可领取奖励！

开始预测吧！ 🎯`

	return &Response{
		Success: true,
		Data: MessageResponse{
			Text: text,
			ReplyMarkup: &ReplyMarkup{
				InlineButtons: [][]InlineButton{
					{{Text: "📊 查看市场", Data: "markets"}},
					{{Text: "🔥 今日热点", Data: "hot"}},
					{{Text: "🌐 访问网站", URL: "https://mindbet.io"}},
				},
			},
		},
	}, nil
}

func handleMarkets(payload *WebhookPayload, config *ClientConfig) (*Response, error) {
	resp, err := http.Get(config.BackendAPIURL + "/api/v1/markets?status=0&page=1&page_size=5")
	if err != nil {
		return &Response{Success: false, Message: "获取市场失败"}, err
	}
	defer resp.Body.Close()

	var marketsResp MarketsResponse
	if err := json.NewDecoder(resp.Body).Decode(&marketsResp); err != nil {
		return &Response{Success: false, Message: "解析数据失败"}, err
	}

	if !marketsResp.Success || len(marketsResp.Data.List) == 0 {
		return &Response{
			Success: true,
			Data: MessageResponse{
				Text: "暂无活跃的市场。",
			},
		}, nil
	}

	text := "📊 活跃市场\n\n"
	buttons := make([][]InlineButton, 0)

	for _, market := range marketsResp.Data.List {
		yesPool := parseFloat(market.TotalYesPool) / 1e18
		noPool := parseFloat(market.TotalNoPool) / 1e18
		
		deadline := time.Unix(market.Deadline, 0)
		deadlineStr := deadline.Format("01-02 15:04")

		title := market.Title
		if len(title) > 40 {
			title = title[:40] + "..."
		}

		text += fmt.Sprintf("🟢 #%d %s\n", market.ChainID, title)
		text += fmt.Sprintf("   💰 YES: %.4f | NO: %.4f ETH\n", yesPool, noPool)
		text += fmt.Sprintf("   ⏰ 截止: %s\n\n", deadlineStr)

		buttonText := fmt.Sprintf("#%d %s...", market.ChainID, market.Title[:min(25, len(market.Title))])
		buttons = append(buttons, []InlineButton{{Text: buttonText, Data: fmt.Sprintf("market_%d", market.ChainID)}})
	}

	text += "\n点击下方按钮查看详情"

	return &Response{
		Success: true,
		Data: MessageResponse{
			Text:      text,
			ReplyMarkup: &ReplyMarkup{InlineButtons: buttons},
		},
	}, nil
}

func handleMarketDetail(payload *WebhookPayload, config *ClientConfig, marketIDStr string) (*Response, error) {
	marketID, err := strconv.ParseUint(marketIDStr, 10, 64)
	if err != nil {
		return &Response{
			Success: true,
			Data: MessageResponse{Text: "无效的市场ID"},
		}, nil
	}

	resp, err := http.Get(fmt.Sprintf("%s/api/v1/markets/%d", config.BackendAPIURL, marketID))
	if err != nil {
		return &Response{Success: false, Message: "获取市场失败"}, err
	}
	defer resp.Body.Close()

	var marketResp MarketResponse
	if err := json.NewDecoder(resp.Body).Decode(&marketResp); err != nil {
		return &Response{Success: false, Message: "解析数据失败"}, err
	}

	if !marketResp.Success {
		return &Response{
			Success: true,
			Data: MessageResponse{Text: "市场不存在"},
		}, nil
	}

	market := marketResp.Data
	
	statusMap := map[int]string{0: "🟢 进行中", 1: "🔴 已封盘", 2: "✅ 已结算", 3: "❌ 已取消"}
	status := statusMap[market.Status]

	yesPool := parseFloat(market.TotalYesPool) / 1e18
	noPool := parseFloat(market.TotalNoPool) / 1e18
	totalPool := yesPool + noPool

	yesOdds := 50.0
	noOdds := 50.0
	if totalPool > 0 {
		yesOdds = yesPool / totalPool * 100
		noOdds = 100 - yesOdds
	}

	deadline := time.Unix(market.Deadline, 0)
	deadlineStr := deadline.Format("2006-01-02 15:04")

	resultText := ""
	if market.Status == 2 {
		if market.Result == 1 {
			resultText = "\n结果: YES ✅"
		} else {
			resultText = "\n结果: NO ❌"
		}
	}

	description := market.Description
	if len(description) > 200 {
		description = description[:200] + "..."
	}

	text := fmt.Sprintf(`📊 市场 #%d

%s

📝 %s

状态: %s
分类: %s
截止时间: %s%s

💰 奖池:
• YES: %.4f ETH (%.1f%%)
• NO: %.4f ETH (%.1f%%)

📍 创建者: %s...

请在网站上下注！`,
		market.ChainID,
		market.Title,
		description,
		status,
		market.Category,
		deadlineStr,
		resultText,
		yesPool, yesOdds,
		noPool, noOdds,
		market.CreatorAddress[:10],
	)

	return &Response{
		Success: true,
		Data: MessageResponse{
			Text: text,
			ReplyMarkup: &ReplyMarkup{
				InlineButtons: [][]InlineButton{
					{{Text: "🌐 前往下注", URL: fmt.Sprintf("https://mindbet.io/markets/%d", market.ID)}},
					{{Text: "📊 查看所有市场", Data: "markets"}},
				},
			},
		},
	}, nil
}

func handleProfile(payload *WebhookPayload, config *ClientConfig, address string) (*Response, error) {
	resp, err := http.Get(fmt.Sprintf("%s/api/v1/users/%s/profile", config.BackendAPIURL, address))
	if err != nil {
		return &Response{Success: false, Message: "获取用户资料失败"}, err
	}
	defer resp.Body.Close()

	var profileResp ProfileResponse
	if err := json.NewDecoder(resp.Body).Decode(&profileResp); err != nil {
		return &Response{Success: false, Message: "解析数据失败"}, err
	}

	if !profileResp.Success {
		return &Response{
			Success: true,
			Data: MessageResponse{Text: "用户资料不存在"},
		}, nil
	}

	profile := profileResp.Data
	
	winRate := 0.0
	if profile.TotalBets > 0 {
		winRate = float64(profile.WinBets) / float64(profile.TotalBets) * 100
	}

	pnl := parseFloat(profile.TotalPnL) / 1e18
	volume := parseFloat(profile.TotalVolume) / 1e18
	
	pnlEmoji := "📈"
	if pnl < 0 {
		pnlEmoji = "📉"
	}

	shortAddr := address
	if len(address) > 18 {
		shortAddr = address[:10] + "..." + address[len(address)-8:]
	}

	text := fmt.Sprintf(`👤 用户资料

📍 地址: %s

📊 统计数据:
• 总下注次数: %d
• 获胜次数: %d
• 胜率: %.1f%%
• 总交易量: %.4f ETH

%s 盈亏: %+.4f ETH`,
		shortAddr,
		profile.TotalBets,
		profile.WinBets,
		winRate,
		volume,
		pnlEmoji,
		pnl,
	)

	return &Response{
		Success: true,
		Data: MessageResponse{
			Text: text,
			ReplyMarkup: &ReplyMarkup{
				InlineButtons: [][]InlineButton{
					{{Text: "🌐 查看完整资料", URL: fmt.Sprintf("https://mindbet.io/profile/%s", address)}},
				},
			},
		},
	}, nil
}

func handleCreateGuide(payload *WebhookPayload, config *ClientConfig) (*Response, error) {
	text := `📝 创建预测议题指南

在 MindBet 创建预测议题非常简单：

步骤:
1. 连接你的钱包
2. 点击"创建议题"
3. 填写议题信息：
   • 标题（清晰描述预测问题）
   • 详细描述
   • 分类
   • 截止时间
4. 支付 0.001 ETH 押金
5. 提交创建

注意事项:
• 押金在有人下注后会退还
• 如果无人下注，押金将退还
• 群主地址可选，填写后可获得1%%分润

费用说明:
• 创建押金: 0.001 ETH
• 最小下注金额: 0.0001 ETH
• 平台手续费: 3%%
• 创建者分润: 1%%
• 群主分润: 1%%

立即访问网站创建你的第一个预测议题！`

	return &Response{
		Success: true,
		Data: MessageResponse{
			Text: text,
			ReplyMarkup: &ReplyMarkup{
				InlineButtons: [][]InlineButton{
					{{Text: "🌐 创建议题", URL: "https://mindbet.io/create"}},
				},
			},
		},
	}, nil
}

func handleHot(payload *WebhookPayload, config *ClientConfig) (*Response, error) {
	text := `🔥 今日热点话题

目前热点分析功能正在开发中，敬请期待！

访问网站查看最新的预测市场！`

	return &Response{
		Success: true,
		Data: MessageResponse{
			Text: text,
			ReplyMarkup: &ReplyMarkup{
				InlineButtons: [][]InlineButton{
					{{Text: "📊 查看市场", Data: "markets"}},
					{{Text: "🌐 访问网站", URL: "https://mindbet.io"}},
				},
			},
		},
	}, nil
}

func parseFloat(s string) float64 {
	var f float64
	fmt.Sscanf(s, "%f", &f)
	return f
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
