from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from bot.clients import backend_client, ai_client
from bot.config import settings
from datetime import datetime

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_message = """
🎰 **欢迎来到 MindBet!**

MindBet 是一个基于区块链的去中心化预测市场平台，使用 Sepolia 测试网的 ETH 进行交易。

**可用命令:**
/start - 开始使用
/markets - 查看活跃的预测市场
/market <id> - 查看市场详情
/create - 创建新议题指南
/profile <address> - 查看用户资料和战绩
/hot - 获取今日热点话题
/help - 显示帮助信息

**使用步骤:**
1. 在我们的网站连接钱包
2. 浏览预测市场
3. 使用 ETH 下注
4. 预测正确即可领取奖励！

开始预测吧！ 🎯
"""
    keyboard = [
        [InlineKeyboardButton("📊 查看市场", callback_data="markets")],
        [InlineKeyboardButton("🔥 今日热点", callback_data="hot")],
        [InlineKeyboardButton("🌐 访问网站", url="https://mindbet.io")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(welcome_message, parse_mode="Markdown", reply_markup=reply_markup)

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await start(update, context)

async def markets(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        result = await backend_client.get_markets(status="0")
        
        if not result.get("success"):
            await update.message.reply_text("获取市场失败，请稍后重试。")
            return
        
        data = result.get("data", {})
        markets_list = data.get("list", [])
        
        if not markets_list:
            await update.message.reply_text("暂无活跃的市场。")
            return
        
        message = "📊 **活跃市场**\n\n"
        keyboard = []
        
        for market in markets_list[:5]:
            yes_pool = float(market.get("total_yes_pool", 0)) / 1e18
            no_pool = float(market.get("total_no_pool", 0)) / 1e18
            total_pool = yes_pool + no_pool
            
            deadline = datetime.fromtimestamp(market.get("deadline", 0))
            deadline_str = deadline.strftime("%m-%d %H:%M")
            
            content_hash = market.get('content_hash', '')[:10]
            message += f"🟢 **#{content_hash}** {market.get('title', 'N/A')[:40]}\n"
            message += f"   💰 YES: {yes_pool:.4f} | NO: {no_pool:.4f} ETH\n"
            message += f"   ⏰ 截止: {deadline_str}\n\n"
            
            keyboard.append([InlineKeyboardButton(
                f"#{content_hash} {market.get('title', '')[:25]}...",
                callback_data=f"market_{market.get('content_hash')}"
            )])
        
        message += "\n点击下方按钮查看详情，或使用 /market <content_hash>"
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def market_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    content_hash = None
    
    if context.args:
        content_hash = context.args[0]
    elif update.callback_query:
        content_hash = update.callback_query.data.split("_")[1]
    
    if not content_hash:
        await update.message.reply_text("请提供市场内容哈希。用法: /market <content_hash>")
        return
    
    try:
        result = await backend_client.get_market_by_hash(content_hash)
        
        if not result.get("success"):
            await update.message.reply_text("市场不存在。")
            return
        
        market = result.get("data", {})
        
        status_map = {0: "🟢 进行中", 1: "🔴 已封盘", 2: "✅ 已结算", 3: "❌ 已取消"}
        status = status_map.get(market.get("status"), "未知")
        
        yes_pool = float(market.get("total_yes_pool", 0)) / 1e18
        no_pool = float(market.get("total_no_pool", 0)) / 1e18
        total_pool = yes_pool + no_pool
        
        yes_odds = (yes_pool / total_pool * 100) if total_pool > 0 else 50
        no_odds = 100 - yes_odds
        
        deadline = datetime.fromtimestamp(market.get("deadline", 0))
        deadline_str = deadline.strftime("%Y-%m-%d %H:%M")
        
        result_text = ""
        if market.get("status") == 2:
            result_text = f"\n**结果:** {'YES ✅' if market.get('result') == 1 else 'NO ❌'}"
        
        hash_short = content_hash[:10]
        message = f"""
📊 **市场 #{hash_short}**

**{market.get('title', 'N/A')}**

📝 {market.get('description', '暂无描述')[:200]}

**状态:** {status}
**分类:** {market.get('category', 'General')}
**截止时间:** {deadline_str}{result_text}

💰 **奖池:**
• YES: {yes_pool:.4f} ETH ({yes_odds:.1f}%)
• NO: {no_pool:.4f} ETH ({no_odds:.1f}%)

📍 创建者: `{market.get('creator_address', '')[:10]}...`

请在网站上下注！
"""
        keyboard = [
            [InlineKeyboardButton("🌐 前往下注", url=f"https://mindbet.io/markets/{content_hash}")],
            [InlineKeyboardButton("📊 查看所有市场", callback_data="markets")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        if update.callback_query:
            await update.callback_query.edit_message_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        else:
            await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("请提供钱包地址。用法: /profile <address>")
        return
    
    try:
        address = context.args[0]
        result = await backend_client.get_user_profile(address)
        
        if not result.get("success"):
            await update.message.reply_text("用户资料不存在。")
            return
        
        profile = result.get("data", {})
        
        win_rate = 0
        if profile.get("total_bets", 0) > 0:
            win_rate = profile.get("win_bets", 0) / profile.get("total_bets", 1) * 100
        
        pnl = float(profile.get("total_pnl", 0)) / 1e18
        volume = float(profile.get("total_volume", 0)) / 1e18
        pnl_emoji = "📈" if pnl >= 0 else "📉"
        
        message = f"""
👤 **用户资料**

📍 地址: `{address[:10]}...{address[-8:]}`

📊 **统计数据:**
• 总下注次数: {profile.get('total_bets', 0)}
• 获胜次数: {profile.get('win_bets', 0)}
• 胜率: {win_rate:.1f}%
• 总交易量: {volume:.4f} ETH

{pnl_emoji} **盈亏:** {pnl:+.4f} ETH
"""
        keyboard = [
            [InlineKeyboardButton("📊 查看下注历史", callback_data=f"bets_{address}")],
            [InlineKeyboardButton("🌐 查看完整资料", url=f"https://mindbet.io/profile/{address}")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def hot(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        result = await ai_client.get_hot_events()
        
        if not result.get("success"):
            await update.message.reply_text("获取热点失败，请稍后重试。")
            return
        
        data = result.get("data", {})
        
        message = f"""
🔥 **今日热点话题**

{data.get('title', '热点事件')}

{data.get('summary', '')[:500]}

访问网站查看基于这些话题的预测市场！
"""
        keyboard = [
            [InlineKeyboardButton("📊 查看相关市场", callback_data="markets")],
            [InlineKeyboardButton("🌐 访问网站", url="https://mindbet.io")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        if update.callback_query:
            await update.callback_query.edit_message_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        else:
            await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def create_guide(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = """
📝 **创建预测议题指南**

在 MindBet 创建预测议题非常简单：

**步骤:**
1. 连接你的钱包
2. 点击"创建议题"
3. 填写议题信息：
   • 标题（清晰描述预测问题）
   • 详细描述
   • 分类
   • 截止时间
4. 支付 0.001 ETH 押金
5. 提交创建

**注意事项:**
• 押金在有人下注后会退还
• 如果无人下注，押金将退还
• 群主地址可选，填写后可获得1%分润

**费用说明:**
• 创建押金: 0.001 ETH
• 最小下注金额: 0.0001 ETH
• 平台手续费: 3%
• 创建者分润: 1%
• 群主分润: 1%

立即访问网站创建你的第一个预测议题！
"""
    keyboard = [
        [InlineKeyboardButton("🌐 创建议题", url="https://mindbet.io/create")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)

async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    if data == "markets":
        await markets(update, context)
    elif data == "hot":
        await hot(update, context)
    elif data.startswith("market_"):
        context.args = [data.split("_")[1]]
        await market_detail(update, context)
    elif data.startswith("bets_"):
        address = data.split("_")[1]
        result = await backend_client.get_user_bets(address)
        if result.get("success"):
            bets = result.get("data", {}).get("list", [])
            message = "📊 **下注历史**\n\n"
            for bet in bets[:10]:
                outcome = "YES" if bet.get("outcome") == 1 else "NO"
                amount = float(bet.get("amount", 0)) / 1e18
                message += f"• {outcome}: {amount:.4f} ETH\n"
            await query.edit_message_text(message, parse_mode="Markdown")
