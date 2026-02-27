from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from bot.clients import backend_client
from bot.config import settings
from datetime import datetime
from urllib.parse import quote

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_message = """
🎰 **欢迎来到 MindBet!**

MindBet 是基于 Monad 链的去中心化预测市场平台，使用 MON 代币进行交易。

**快速开始:**
1️⃣ 绑定钱包: /login
2️⃣ 查看市场: /markets
3️⃣ 开始下注: /bet <id> <yes/no> <金额>

**可用命令:**
/help - 查看所有命令
/markets - 查看活跃市场
/market <id> - 查看市场详情
/mybets - 查看我的下注
/claimable - 查看可领奖议题
/refundable - 查看可退款议题
/resolved - 查看已结算议题
/bet <id> <yes/no> <amount> - 下注
/claim <id> - 领取奖金
/refund <id> - 领取退款
/create - 创建议题
/resolve <id> <yes/no> - 结算议题
/cancel <id> - 取消议题
/deposit - 领取押金
/profile - 查看我的战绩
/balance - 查询钱包余额
/login - 绑定钱包
/logout - 解绑钱包

开始预测吧！ 🎯
"""
    keyboard = [
        [InlineKeyboardButton("📊 查看市场", callback_data="markets")],
        [InlineKeyboardButton("🔥 今日热点", callback_data="hot")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(welcome_message, parse_mode="Markdown", reply_markup=reply_markup)

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await start(update, context)

async def login(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    username = update.effective_user.username or ""
    
    mini_app_url = f"{settings.MINI_APP_URL}/bind?telegram_id={telegram_id}&username={quote(username)}"
    
    message = """
🔐 **绑定钱包**

请点击下方按钮连接钱包并绑定到您的 Telegram 账号。

绑定后即可使用 Bot 进行交易！
"""
    keyboard = [
        [InlineKeyboardButton("🔗 点击绑定钱包", url=mini_app_url)],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)

async def logout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_binding(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("您还未绑定钱包。")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        
        message = f"""
⚠️ **确认解绑钱包？**

当前绑定: `{wallet_address[:10]}...{wallet_address[-8:]}`

解绑后需要重新绑定才能使用交易功能。
"""
        keyboard = [
            [InlineKeyboardButton("取消", callback_data="cancel_unbind"),
             InlineKeyboardButton("确认解绑", callback_data="confirm_unbind")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

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
            message += f"   💰 YES: {yes_pool:.4f} | NO: {no_pool:.4f} MON\n"
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
            result_text = f"\n**结果:** {'YES ✅' if market.get('result') ==1 else 'NO ❌'}"
        
        hash_short = content_hash[:10]
        message = f"""
📊 **市场 #{hash_short}**

**{market.get('title', 'N/A')}**

📝 {market.get('description', '暂无描述')[:200]}

**状态:** {status}
**分类:** {market.get('category', 'General')}
**截止时间:** {deadline_str}{result_text}

💰 **奖池:**
• YES: {yes_pool:.4f} MON ({yes_odds:.1f}%)
• NO: {no_pool:.4f} MON ({no_odds:.1f}%)

📍 创建者: `{market.get('creator_address', '')[:10]}...`
"""
        
        keyboard = [
            [InlineKeyboardButton("🎯 下注 YES", callback_data=f"bet_yes_{content_hash}"),
             InlineKeyboardButton("🎯 下注 NO", callback_data=f"bet_no_{content_hash}")],
            [InlineKeyboardButton("📊 查看所有市场", callback_data="markets")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        if update.callback_query:
            await update.callback_query.edit_message_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        else:
            await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def mybets(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_binding(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        
        result = await backend_client.get_user_bets(wallet_address)
        
        if not result.get("success"):
            await update.message.reply_text("获取下注记录失败。")
            return
        
        bets = result.get("data", {}).get("list", [])
        
        if not bets:
            await update.message.reply_text("您还没有下注记录。")
            return
        
        message = "📊 **我的下注**\n\n"
        
        for bet in bets[:10]:
            outcome = "YES" if bet.get("outcome") == 1 else "NO"
            amount = float(bet.get("amount", 0)) / 1e18
            tx_type_map = {1: "创建", 2: "下注", 3: "领奖", 4: "押金退款", 5: "退款"}
            tx_type = tx_type_map.get(bet.get("tx_type"), "其他")
            
            message += f"📌 {tx_type}: {outcome} {amount:.4f} MON\n"
        
        keyboard = [
            [InlineKeyboardButton("📊 查看所有市场", callback_data="markets")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def claimable(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_claimable_markets(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        markets = result.get("data", {}).get("list", [])
        
        if not markets:
            await update.message.reply_text("暂无可领奖的议题。")
            return
        
        message = "💰 **可领奖议题**\n\n"
        keyboard = []
        
        for market in markets:
            content_hash = market.get('content_hash', '')[:10]
            message += f"🟢 #{content_hash} {market.get('title', 'N/A')[:30]}\n"
            message += f"   [💰 领取奖金]\n\n"
            
            keyboard.append([InlineKeyboardButton(
                f"💰 #{content_hash} 领取",
                callback_data=f"claim_{market.get('content_hash')}"
            )])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def refundable(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_refundable_markets(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        markets = result.get("data", {}).get("list", [])
        
        if not markets:
            await update.message.reply_text("暂无可退款的议题。")
            return
        
        message = "🔄 **可退款议题**\n\n"
        keyboard = []
        
        for market in markets:
            content_hash = market.get('content_hash', '')[:10]
            message += f"🔴 #{content_hash} {market.get('title', 'N/A')[:30]}\n"
            message += f"   [💰 领取退款]\n\n"
            
            keyboard.append([InlineKeyboardButton(
                f"💰 #{content_hash} 退款",
                callback_data=f"refund_{market.get('content_hash')}"
            )])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def resolved(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        result = await backend_client.get_resolved_markets(page=1, page_size=10)
        
        if not result.get("success"):
            await update.message.reply_text("获取已结算市场失败。")
            return
        
        data = result.get("data", {})
        markets_list = data.get("list", [])
        
        if not markets_list:
            await update.message.reply_text("暂无已结算的市场。")
            return
        
        message = "✅ **已结算议题**\n\n"
        keyboard = []
        
        for market in markets_list:
            content_hash = market.get('content_hash', '')[:10]
            result_emoji = "YES ✅" if market.get('result') == 1 else "NO ❌"
            
            message += f"🟢 #{content_hash} {market.get('title', 'N/A')[:30]}\n"
            message += f"   结果: {result_emoji}\n\n"
            
            keyboard.append([InlineKeyboardButton(
                f"#{content_hash}",
                callback_data=f"market_{market.get('content_hash')}"
            )])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_binding(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        
        result = await backend_client.get_user_profile(wallet_address)
        
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

📍 钱包地址: `{wallet_address[:10]}...{wallet_address[-8:]}`

📊 **统计数据:**
• 总下注次数: {profile.get('total_bets', 0)}
• 获胜次数: {profile.get('win_bets', 0)}
• 胜率: {win_rate:.1f}%
• 总交易量: {volume:.4f} MON

{pnl_emoji} **盈亏:** {pnl:+.4f} MON
"""
        keyboard = [
            [InlineKeyboardButton("📊 查看下注历史", callback_data=f"bets_{wallet_address}")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_wallet_balance(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        balance = data.get("balance", "0")
        
        message = f"""
💰 **钱包余额**

📍 钱包地址: `{wallet_address[:10]}...{wallet_address[-8:]}`

💎 **MON 余额:**
• 可用余额: {balance} MON

📊 **最近交易:**
• 查看完整交易记录请使用 /mybets
"""
        keyboard = [
            [InlineKeyboardButton("📊 查看我的下注", callback_data="mybets")],
            [InlineKeyboardButton("🔄 刷新", callback_data="refresh_balance")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")
