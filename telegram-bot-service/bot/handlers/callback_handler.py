from telegram import Update
from telegram.ext import ContextTypes
from bot.clients import backend_client
from bot.handlers.telegram_handlers import market_detail, balance
from bot.handlers.transaction_handlers import bet, claim, refund

async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    if data == "markets":
        from bot.handlers.telegram_handlers import markets
        context.args = []
        await markets(update, context)
    elif data == "hot":
        from bot.handlers.basic import hot
        await hot(update, context)
    elif data.startswith("market_"):
        content_hash = data.split("_")[1]
        context.args = [content_hash]
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
                tx_type_map = {1: "创建", 2: "下注", 3: "领奖", 4: "押金退款", 5: "退款"}
                tx_type = tx_type_map.get(bet.get("tx_type"), "其他")
                message += f"• {tx_type}: {outcome} {amount:.4f} MON\n"
            await query.edit_message_text(message, parse_mode="Markdown")
    elif data == "mybets":
        from bot.handlers.telegram_handlers import mybets
        await mybets(update, context)
    elif data == "refresh_balance":
        await balance(update, context)
    elif data == "cancel_unbind":
        await query.edit_message_text("已取消解绑。")
    elif data == "confirm_unbind":
        telegram_id = update.effective_user.id
        try:
            result = await backend_client.unbind_wallet(telegram_id)
            if result.get("success"):
                await query.edit_message_text("✅ 钱包已解绑\n\n使用 /login 重新绑定钱包")
            else:
                await query.edit_message_text(f"解绑失败: {result.get('error', '未知错误')}")
        except Exception as e:
            await query.edit_message_text(f"错误: {str(e)}")
    elif data.startswith("bet_yes_"):
        content_hash = data.split("_")[2]
        context.args = [content_hash, "yes", "0.001"]
        await bet(update, context)
    elif data.startswith("bet_no_"):
        content_hash = data.split("_")[2]
        context.args = [content_hash, "no", "0.001"]
        await bet(update, context)
    elif data.startswith("claim_"):
        content_hash = data.split("_")[1]
        context.args = [content_hash]
        await claim(update, context)
    elif data.startswith("refund_"):
        content_hash = data.split("_")[1]
        context.args = [content_hash]
        await refund(update, context)
    elif data == "create":
        from bot.handlers.transaction_handlers import create
        await create(update, context)
