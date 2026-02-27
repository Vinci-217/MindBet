import logging
from telegram import Update
from telegram.ext import ContextTypes
from bot.clients import ai_client
from bot.handlers.telegram_handlers import (
    start, help_command, login, logout, markets, market_detail,
    mybets, claimable, refundable, resolved, profile, balance
)
from bot.handlers.transaction_handlers import bet, claim, refund, hot

logger = logging.getLogger(__name__)

COMMAND_MAP = {
    "start": start,
    "help": help_command,
    "login": login,
    "logout": logout,
    "markets": markets,
    "market": market_detail,
    "mybets": mybets,
    "claimable": claimable,
    "refundable": refundable,
    "resolved": resolved,
    "profile": profile,
    "balance": balance,
    "bet": bet,
    "claim": claim,
    "refund": refund,
    "hot": hot,
}

def is_group_chat(update: Update) -> bool:
    chat = update.effective_chat
    return chat.type in ["group", "supergroup"]

def is_mentioned_or_reply(update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
    if not is_group_chat(update):
        return True
    
    message = update.message
    if message is None:
        return False
    
    bot_username = context.bot.username
    if not bot_username:
        return False
    
    text = message.text or ""
    if f"@{bot_username}" in text:
        return True
    
    if message.reply_to_message and message.reply_to_message.from_user.id == context.bot.id:
        return True
    
    return False

def remove_bot_mention(text: str, bot_username: str) -> str:
    if bot_username:
        return text.replace(f"@{bot_username}", "").strip()
    return text

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message is None or update.message.text is None:
        return
    
    if update.message.text.startswith('/'):
        return
    
    if not is_mentioned_or_reply(update, context):
        return
    
    bot_username = context.bot.username if context.bot else None
    user_message = remove_bot_mention(update.message.text, bot_username)
    
    if not user_message.strip():
        return
    
    user_name = update.effective_user.first_name or "用户"
    chat_type = "群聊" if is_group_chat(update) else "私聊"
    
    logger.info(f"[{chat_type}] Processing message from {user_name}: {user_message}")
    
    try:
        result = await ai_client.recognize_intent(user_message)
        
        if not result.get("success"):
            await update.message.reply_text(
                "抱歉，服务暂时不可用，请稍后再试。"
            )
            return
        
        data = result.get("data", {})
        has_intent = data.get("has_intent", False)
        command = data.get("command")
        args = data.get("args", [])
        confidence = data.get("confidence", 0)
        reply = data.get("reply")
        
        logger.info(f"Intent result: has_intent={has_intent}, command={command}, confidence={confidence}")
        
        if has_intent and command and confidence > 0.6:
            if command in COMMAND_MAP:
                context.args = args
                logger.info(f"Executing command: {command} with args: {args}")
                await COMMAND_MAP[command](update, context)
            else:
                await update.message.reply_text(
                    f"识别到命令 `{command}`，但该命令暂不支持。\n\n"
                    "输入 /help 查看可用命令。",
                    parse_mode="Markdown"
                )
        else:
            if reply:
                await update.message.reply_text(reply)
            else:
                await update.message.reply_text(
                    f"你好 {user_name}！我是 MindBet 预测市场助手。\n\n"
                    "你可以用自然语言和我交流，例如：\n"
                    "• \"我要登录\"\n"
                    "• \"有什么市场\"\n"
                    "• \"查看余额\"\n\n"
                    "输入 /help 查看所有可用命令。"
                )
                
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        await update.message.reply_text(
            f"处理消息时出错: {str(e)}\n\n请稍后重试，或输入 /help 查看可用命令。"
        )
