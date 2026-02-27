from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from bot.clients import backend_client
from bot.config import settings
from datetime import datetime

async def bet(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if len(context.args) < 3:
        await update.message.reply_text("用法: /bet <market_id> <yes/no> <amount>\n示例: /bet abc123... yes 0.5")
        return
    
    market_id = context.args[0]
    bet_type = context.args[1].lower()
    amount = context.args[2]
    
    if bet_type not in ["yes", "no"]:
        await update.message.reply_text("方向必须是 yes 或 no")
        return
    
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_binding(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        
        market_result = await backend_client.get_market_by_hash(market_id)
        if not market_result.get("success"):
            await update.message.reply_text("市场不存在。")
            return
        
        market = market_result.get("data", {})
        
        mini_app_url = f"{settings.MINI_APP_URL}/sign?action=bet&market_id={market_id}&bet_type={bet_type}&amount={amount}&wallet={wallet_address}"
        
        message = f"""
📋 **下注确认**

市场: #{market_id[:10]}... {market.get('title', 'N/A')[:30]}
方向: {bet_type.upper()}
金额: {amount} MON

预计 Gas 费: ~0.003 MON
总计: {float(amount) + 0.003:.6f} MON
"""
        keyboard = [
            [InlineKeyboardButton("🔐 点击确认下注", url=mini_app_url)],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def claim(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if len(context.args) < 1:
        await update.message.reply_text("用法: /claim <market_id>\n示例: /claim abc123...")
        return
    
    market_id = context.args[0]
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_binding(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        
        market_result = await backend_client.get_market_by_hash(market_id)
        if not market_result.get("success"):
            await update.message.reply_text("市场不存在。")
            return
        
        market = market_result.get("data", {})
        
        if market.get("status") != 2:
            await update.message.reply_text("该市场尚未结算。")
            return
        
        mini_app_url = f"{settings.MINI_APP_URL}/sign?action=claim&market_id={market_id}&wallet={wallet_address}"
        
        result_emoji = "YES ✅" if market.get('result') == 1 else "NO ❌"
        
        message = f"""
💰 **领奖确认**

市场: #{market_id[:10]}... {market.get('title', 'N/A')[:30]}
结果: {result_emoji}

点击下方按钮领取奖金。
"""
        keyboard = [
            [InlineKeyboardButton("🔐 点击领取奖金", url=mini_app_url)],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def refund(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if len(context.args) < 1:
        await update.message.reply_text("用法: /refund <market_id>\n示例: /refund abc123...")
        return
    
    market_id = context.args[0]
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_binding(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        
        market_result = await backend_client.get_market_by_hash(market_id)
        if not market_result.get("success"):
            await update.message.reply_text("市场不存在。")
            return
        
        market = market_result.get("data", {})
        
        if market.get("status") != 3:
            await update.message.reply_text("该市场未被取消。")
            return
        
        mini_app_url = f"{settings.MINI_APP_URL}/sign?action=refund&market_id={market_id}&wallet={wallet_address}"
        
        message = f"""
🔄 **退款确认**

市场: #{market_id[:10]}... {market.get('title', 'N/A')[:30]}
状态: 已取消

点击下方按钮领取退款。
"""
        keyboard = [
            [InlineKeyboardButton("🔐 点击领取退款", url=mini_app_url)],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def create(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_binding(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        
        mini_app_url = f"{settings.MINI_APP_URL}/create?wallet={wallet_address}"
        
        message = """
📝 **创建预测议题**

请点击下方按钮创建新议题。

**创建说明:**
• 需要支付 0.001 MON 押金
• 最小下注金额: 0.0001 MON
• 平台手续费: 3%
• 创建者分润: 1%
• 群主分润: 1% (可选)

押金在市场结算后会退还！
"""
        keyboard = [
            [InlineKeyboardButton("🔗 创建议题", url=mini_app_url)],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def resolve(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if len(context.args) < 2:
        await update.message.reply_text("用法: /resolve <market_id> <yes/no>\n示例: /resolve abc123... yes")
        return
    
    market_id = context.args[0]
    result_type = context.args[1].lower()
    
    if result_type not in ["yes", "no"]:
        await update.message.reply_text("结果必须是 yes 或 no")
        return
    
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_binding(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        
        market_result = await backend_client.get_market_by_hash(market_id)
        if not market_result.get("success"):
            await update.message.reply_text("市场不存在。")
            return
        
        market = market_result.get("data", {})
        
        if market.get("creator_address", "").lower() != wallet_address.lower():
            await update.message.reply_text("只有创建者可以结算议题。")
            return
        
        if market.get("status") not in [0, 1]:
            await update.message.reply_text("该市场无法结算。")
            return
        
        deadline = market.get("deadline", 0)
        if datetime.now().timestamp() < deadline:
            await update.message.reply_text("市场尚未截止，无法结算。")
            return
        
        mini_app_url = f"{settings.MINI_APP_URL}/sign?action=resolve&market_id={market_id}&result={result_type}&wallet={wallet_address}"
        
        message = f"""
⚠️ **结算确认**

市场: #{market_id[:10]}... {market.get('title', 'N/A')[:30]}
结算结果: {result_type.upper()}

**警告:**
• 结算后无法更改
• 只有创建者可以结算
• 必须在截止时间后结算
"""
        keyboard = [
            [InlineKeyboardButton("🔐 点击确认结算", url=mini_app_url)],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if len(context.args) < 1:
        await update.message.reply_text("用法: /cancel <market_id>\n示例: /cancel abc123...")
        return
    
    market_id = context.args[0]
    telegram_id = update.effective_user.id
    
    try:
        result = await backend_client.get_binding(telegram_id)
        
        if not result.get("success"):
            await update.message.reply_text("请先绑定钱包：/login")
            return
        
        data = result.get("data", {})
        wallet_address = data.get("wallet_address", "")
        
        market_result = await backend_client.get_market_by_hash(market_id)
        if not market_result.get("success"):
            await update.message.reply_text("市场不存在。")
            return
        
        market = market_result.get("data", {})
        
        if market.get("creator_address", "").lower() != wallet_address.lower():
            await update.message.reply_text("只有创建者可以取消议题。")
            return
        
        if market.get("status") not in [0, 1]:
            await update.message.reply_text("该市场无法取消。")
            return
        
        mini_app_url = f"{settings.MINI_APP_URL}/sign?action=cancel&market_id={market_id}&wallet={wallet_address}"
        
        message = f"""
⚠️ **取消确认**

市场: #{market_id[:10]}... {market.get('title', 'N/A')[:30]}

**警告:**
• 取消后无法恢复
• 只有创建者可以取消
• 下注者可以领取退款
"""
        keyboard = [
            [InlineKeyboardButton("🔐 点击确认取消", url=mini_app_url)],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
        
    except Exception as e:
        await update.message.reply_text(f"错误: {str(e)}")

async def deposit(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    
    await update.message.reply_text("功能开发中，请使用 Mini App 领取押金。")

async def hot(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from bot.handlers.basic import hot as basic_hot
    await basic_hot(update, context)

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
4. 支付 0.001 MON 押金
5. 提交创建

**注意事项:**
• 押金在市场结算后会退还
• 如果无人下注，押金将退还
• 群主地址可选，填写后可获得1%分润

**费用说明:**
• 创建押金: 0.001 MON
• 最小下注金额: 0.0001 MON
• 平台手续费: 3%
• 创建者分润: 1%
• 群主分润: 1%

立即创建你的第一个预测议题！
"""
    keyboard = [
        [InlineKeyboardButton("🔗 创建议题", callback_data="create")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(message, parse_mode="Markdown", reply_markup=reply_markup)
