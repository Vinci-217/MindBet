import logging
import sys
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters
from telegram.request import HTTPXRequest

from bot.handlers.telegram_handlers import (
    start, help_command, login, logout, markets, market_detail,
    mybets, claimable, refundable, resolved, profile, balance
)
from bot.handlers.transaction_handlers import (
    bet, claim, refund, create, resolve, cancel, deposit, hot, create_guide
)
from bot.handlers.callback_handler import callback_handler
from bot.handlers.ai_handler import handle_message
from bot.config import settings

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def main():
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set!")
        sys.exit(1)
    
    request = None
    if settings.TELEGRAM_PROXY:
        logger.info(f"Using proxy: {settings.TELEGRAM_PROXY}")
        request = HTTPXRequest(
            proxy=settings.TELEGRAM_PROXY,
            connect_timeout=60.0,
            read_timeout=60.0,
            write_timeout=60.0,
            pool_timeout=60.0
        )
    
    application = Application.builder().token(
        settings.TELEGRAM_BOT_TOKEN
    ).request(request).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("login", login))
    application.add_handler(CommandHandler("logout", logout))
    application.add_handler(CommandHandler("markets", markets))
    application.add_handler(CommandHandler("market", market_detail))
    application.add_handler(CommandHandler("mybets", mybets))
    application.add_handler(CommandHandler("claimable", claimable))
    application.add_handler(CommandHandler("refundable", refundable))
    application.add_handler(CommandHandler("resolved", resolved))
    application.add_handler(CommandHandler("bet", bet))
    application.add_handler(CommandHandler("claim", claim))
    application.add_handler(CommandHandler("refund", refund))
    application.add_handler(CommandHandler("create", create))
    application.add_handler(CommandHandler("resolve", resolve))
    application.add_handler(CommandHandler("cancel", cancel))
    application.add_handler(CommandHandler("deposit", deposit))
    application.add_handler(CommandHandler("profile", profile))
    application.add_handler(CommandHandler("balance", balance))
    application.add_handler(CommandHandler("hot", hot))
    
    application.add_handler(CallbackQueryHandler(callback_handler))
    
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    logger.info("Starting Telegram bot...")
    application.run_polling(
        allowed_updates=['message', 'callback_query'],
        drop_pending_updates=True,
        poll_interval=1.0,
        timeout=30
    )

if __name__ == "__main__":
    main()
