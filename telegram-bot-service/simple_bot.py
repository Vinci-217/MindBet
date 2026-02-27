import asyncio
import os
import httpx
import sys
import traceback
import json
from dotenv import load_dotenv

load_dotenv()

AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8003")

INTENT_KEYWORDS = {
    "login": ["登录", "绑定钱包", "连接钱包", "我要登录", "login", "绑定"],
    "logout": ["解绑", "退出登录", "注销", "logout", "解除绑定"],
    "markets": ["市场", "有什么市场", "查看市场", "市场列表", "markets", "看市场"],
    "market": ["市场详情", "查看某个市场", "market"],
    "bet": ["下注", "我要下注", "投注", "bet", "买"],
    "claim": ["领奖", "领取奖金", "claim", "领钱"],
    "refund": ["退款", "领取退款", "refund"],
    "profile": ["战绩", "我的战绩", "个人资料", "我的数据", "profile", "个人信息"],
    "balance": ["余额", "我的余额", "钱包余额", "balance", "查余额"],
    "mybets": ["我的下注", "下注记录", "历史记录", "mybets", "投注记录"],
    "claimable": ["可领奖", "能领奖的", "claimable"],
    "refundable": ["可退款", "能退款的", "refundable"],
    "resolved": ["已结算", "结算了的", "resolved"],
    "help": ["帮助", "怎么用", "使用说明", "help", "教程"],
    "hot": ["热点", "今日热点", "热门", "hot"],
}

def recognize_intent(message: str) -> dict:
    message_lower = message.lower()
    
    for command, keywords in INTENT_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in message_lower:
                return {
                    "has_intent": True,
                    "command": command,
                    "args": [],
                    "confidence": 0.8
                }
    
    return {
        "has_intent": False,
        "command": None,
        "args": [],
        "confidence": 0.0
    }

async def recognize_intent_with_ai(client, message: str) -> dict:
    keyword_result = recognize_intent(message)
    if keyword_result.get("has_intent"):
        print(f"Keyword matched: {keyword_result.get('command')}", flush=True)
        return keyword_result
    
    print("No keyword match, trying LLM intent recognition...", flush=True)
    try:
        resp = await client.post(
            f"{AI_SERVICE_URL}/api/v1/ai/intent",
            json={"message": message},
            timeout=10.0
        )
        result = resp.json()
        if result.get("success"):
            return result.get("data", {})
    except Exception as e:
        print(f"AI intent recognition failed: {e}", flush=True)
    
    return {"has_intent": False, "command": None, "args": [], "confidence": 0.0}

async def chat_with_ai(client, message: str, username: str = "") -> str:
    try:
        system_prompt = """你是 MindBet 预测市场的 AI 助手，一个敢于预测的分析师。

**核心规则：当用户询问某事会不会发生/概率/可能性时，你必须给出预测！**

不要说"无法预测"、"不确定性太高"等拒绝话语。即使不确定，也要基于现有信息给出你的判断。

预测问题回复格式：
1. 简短分析（1-2句话）
2. 给出概率：
📊 YES: XX%
📊 NO: XX%
3. 引导用户到 MindBet

示例：
用户：比特币会涨到10万吗？
回复：比特币目前价格在6-7万美元区间，考虑到机构采用和减半效应，有一定上涨空间。
📊 YES: 35%
📊 NO: 65%
💡 你可以在 MindBet 上创建这个预测议题，让大家一起预测！

用户：特朗普会当选吗？
回复：特朗普目前民调领先，但选举结果仍存在变数。
📊 YES: 55%
📊 NO: 45%
💡 来 MindBet 参与这个话题的预测吧！

注意：你的预测只是参考，不构成投资建议。"""

        resp = await client.post(
            f"{AI_SERVICE_URL}/api/v1/ai/chat",
            json={
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                "temperature": 0.7,
                "max_tokens": 300
            },
            timeout=30.0
        )
        result = resp.json()
        if result.get("success"):
            return result.get("data", {}).get("content", "")
    except Exception as e:
        print(f"AI chat failed: {e}", flush=True)
    
    return None

async def poll_bot():
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    proxy = os.environ.get("TELEGRAM_PROXY", "")
    backend_url = os.environ.get("BACKEND_API_URL", "http://localhost:8080")
    mini_app_url = os.environ.get("MINI_APP_URL", "")
    
    if not token:
        print("Error: TELEGRAM_BOT_TOKEN is not set!", flush=True)
        return
    
    bot_info_url = f"https://api.telegram.org/bot{token}/getMe"
    
    print(f"Starting polling...", flush=True)
    print(f"Backend: {backend_url}", flush=True)
    print(f"Mini App: {mini_app_url}", flush=True)
    print(f"AI Service: {AI_SERVICE_URL}", flush=True)
    
    telegram_client_kwargs = {"timeout": 60.0}
    if proxy:
        telegram_client_kwargs["proxies"] = {"http://": proxy, "https://": proxy}
        print(f"Using proxy: {proxy}", flush=True)
    
    async with httpx.AsyncClient(**telegram_client_kwargs) as telegram_client:
        async with httpx.AsyncClient(timeout=60.0) as backend_client:
            bot_info_resp = await telegram_client.get(bot_info_url)
            bot_info = bot_info_resp.json()
            bot_username = bot_info.get("result", {}).get("username", "")
            print(f"Bot username: @{bot_username}", flush=True)
            
            offset = 0
            
            while True:
                try:
                    url = f"https://api.telegram.org/bot{token}/getUpdates?timeout=30&offset={offset}"
                    response = await telegram_client.get(url)
                    data = response.json()
                    
                    if data.get("ok"):
                        updates = data.get("result", [])
                        if updates:
                            for update in updates:
                                offset = update["update_id"] + 1
                                message = update.get("message", {})
                                text = message.get("text", "")
                                chat = message.get("chat", {})
                                chat_id = chat.get("id")
                                chat_type = chat.get("type", "private")
                                user_id = message.get("from", {}).get("id")
                                username = message.get("from", {}).get("username", "")
                                
                                print(f"Received: {text} from chat_id={chat_id} (type={chat_type})", flush=True)
                                
                                processed_text = process_message(text, chat_type, bot_username)
                                
                                if processed_text is None:
                                    print(f"Ignored message (not mentioned in group)", flush=True)
                                    continue
                                
                                try:
                                    reply = await handle_command(processed_text, user_id, chat_id, username, backend_client, backend_url, mini_app_url, token)
                                    
                                    if reply:
                                        await send_message(telegram_client, token, chat_id, reply)
                                except Exception as e:
                                    print(f"Handle error: {e}", flush=True)
                                    traceback.print_exc()
                                    await send_message(telegram_client, token, chat_id, f"处理命令时出错: {str(e)}")
                    
                except Exception as e:
                    print(f"Poll error: {e}", flush=True)
                    traceback.print_exc()
                    await asyncio.sleep(5)

def process_message(text: str, chat_type: str, bot_username: str) -> str:
    if not text:
        return None
    
    if chat_type == "private":
        return text
    
    if bot_username.startswith("@"):
        bot_username = bot_username[1:]
    
    if text.startswith("/"):
        if "@" in text:
            parts = text.split("@", 1)
            cmd_part = parts[0]
            bot_part = parts[1].split()[0] if len(parts) > 1 else ""
            
            if bot_part.lower() == bot_username.lower():
                remaining = text.replace(f"@{bot_part}", "", 1).strip()
                return remaining if remaining else None
            else:
                return None
        return text
    
    mention = f"@{bot_username}"
    if mention.lower() in text.lower():
        text = text.replace(mention, "").replace(mention.lower(), "").strip()
        return text if text else None
    
    return None

async def handle_command(text, user_id, chat_id, username, client, backend_url, mini_app_url, token):
    parts = text.split()
    cmd = parts[0] if parts else ""
    args = parts[1:] if len(parts) > 1 else []
    
    print(f"Handling: {text}", flush=True)
    
    if cmd.startswith("/"):
        return await handle_slash_command(cmd, args, user_id, chat_id, username, client, backend_url, mini_app_url, token)
    else:
        return await handle_natural_language(text, user_id, chat_id, username, client, backend_url, mini_app_url, token)

async def handle_natural_language(text, user_id, chat_id, username, client, backend_url, mini_app_url, token):
    print(f"Natural language input: {text}", flush=True)
    
    intent = await recognize_intent_with_ai(client, text)
    print(f"Intent result: {intent}", flush=True)
    
    has_intent = intent.get("has_intent", False)
    command = intent.get("command")
    args = intent.get("args", [])
    confidence = intent.get("confidence", 0)
    
    if has_intent and command and confidence > 0.6:
        print(f"Executing command: {command} with args: {args}", flush=True)
        return await handle_slash_command(f"/{command}", args, user_id, chat_id, username, client, backend_url, mini_app_url, token)
    else:
        print(f"No intent found, calling AI chat...", flush=True)
        ai_reply = await chat_with_ai(client, text, username)
        
        if ai_reply:
            return ai_reply
        else:
            return f"""你好 {username}！我是 MindBet 预测市场助手。

AI 服务暂时不可用。你可以使用以下命令：
• /markets - 查看市场
• /login - 绑定钱包
• /help - 查看帮助"""

async def handle_slash_command(cmd, args, user_id, chat_id, username, client, backend_url, mini_app_url, token):
    print(f"Handling command: {cmd}", flush=True)
    
    if cmd == "/start" or cmd == "/help":
        return """🎰 欢迎来到 MindBet!

MindBet 是基于 Monad 链的去中心化预测市场平台，使用 MON 代币进行交易。

快速开始:
1️⃣ 绑定钱包: /login
2️⃣ 查看市场: /markets
3️⃣ 开始下注: /bet <hash> <yes/no> <金额>

可用命令:
/help - 查看所有命令
/markets - 查看活跃市场
/market <hash> - 查看市场详情
/mybets - 查看我的下注
/claimable - 查看可领奖议题
/refundable - 查看可退款议题
/resolved - 查看已结算议题
/bet <hash> <yes/no> <amount> - 下注
/claim <hash> - 领取奖金
/refund <hash> - 领取退款
/create - 创建议题指南
/resolve <hash> <yes/no> - 结算议题
/cancel <hash> - 取消议题
/profile - 查看我的战绩
/balance - 查询钱包余额
/login - 绑定钱包
/logout - 解绑钱包

开始预测吧! 🎯"""

    elif cmd == "/login":
        login_url = f"{mini_app_url}/bind?telegram_id={user_id}&username={username}"
        return f"""🔐 绑定钱包

请点击下方链接连接钱包并绑定到您的 Telegram 账号。

🔗 [点击绑定钱包]({login_url})

绑定后即可使用 Bot 进行交易!"""

    elif cmd == "/logout":
        try:
            resp = await client.get(f"{backend_url}/api/v1/telegram/binding", params={"telegram_id": user_id})
            result = resp.json()
            if result.get("success"):
                wallet = result.get("data", {}).get("wallet_address", "")
                if wallet:
                    resp = await client.delete(f"{backend_url}/api/v1/telegram/binding", params={"telegram_id": user_id})
                    if resp.json().get("success"):
                        return "✅ 钱包已解绑。使用 /login 重新绑定。"
            return "您还未绑定钱包。"
        except Exception as e:
            print(f"Logout error: {e}", flush=True)
            return f"错误: {str(e)}"

    elif cmd == "/markets":
        try:
            print(f"Fetching markets from {backend_url}...", flush=True)
            resp = await client.get(f"{backend_url}/api/v1/markets", params={"status": "0"})
            print(f"Response status: {resp.status_code}", flush=True)
            print(f"Response text: {resp.text[:200]}", flush=True)
            result = resp.json()
            if result.get("success"):
                markets = result.get("data", {}).get("list", [])
                if markets:
                    reply = "📊 活跃市场\n\n"
                    for m in markets[:5]:
                        title = m.get("title", "N/A")[:30]
                        hash_short = m.get("content_hash", "")[:10]
                        yes_pool = float(m.get("total_yes_pool", 0)) / 1e18
                        no_pool = float(m.get("total_no_pool", 0)) / 1e18
                        reply += f"🟢 #{hash_short} {title}\n"
                        reply += f"   💰 YES: {yes_pool:.2f} | NO: {no_pool:.2f} MON\n\n"
                    reply += "使用 /market <hash> 查看详情"
                    return reply
                else:
                    return "暂无活跃的市场。\n\n使用 /create 了解如何创建议题。"
            return "获取市场失败。"
        except Exception as e:
            print(f"Markets error: {e}", flush=True)
            traceback.print_exc()
            return f"错误: {str(e)}"

    elif cmd == "/market":
        if not args:
            return "用法: /market <content_hash>\n\n使用 /markets 查看市场列表。"
        try:
            content_hash = args[0]
            resp = await client.get(f"{backend_url}/api/v1/markets/{content_hash}")
            result = resp.json()
            if result.get("success"):
                m = result.get("data", {})
                status_map = {0: "🟢 进行中", 1: "🔴 已封盘", 2: "✅ 已结算", 3: "❌ 已取消"}
                status = status_map.get(m.get("status"), "未知")
                yes_pool = float(m.get("total_yes_pool", 0)) / 1e18
                no_pool = float(m.get("total_no_pool", 0)) / 1e18
                total = yes_pool + no_pool
                yes_odds = (yes_pool / total * 100) if total > 0 else 50
                no_odds = 100 - yes_odds
                
                reply = f"""📊 市场 #{content_hash[:10]}

{m.get('title', 'N/A')}

📝 {m.get('description', '暂无描述')[:150]}

状态: {status}
截止时间: {m.get('deadline', 'N/A')}

💰 奖池:
• YES: {yes_pool:.4f} MON ({yes_odds:.1f}%)
• NO: {no_pool:.4f} MON ({no_odds:.1f}%)

📍 创建者: {m.get('creator_address', '')[:10]}...

使用 /bet {content_hash} yes/no <金额> 下注"""
                return reply
            return "市场不存在。"
        except Exception as e:
            print(f"Market error: {e}", flush=True)
            return f"错误: {str(e)}"

    elif cmd == "/mybets":
        try:
            print(f"Fetching binding for user {user_id}...", flush=True)
            resp = await client.get(f"{backend_url}/api/v1/telegram/binding", params={"telegram_id": user_id})
            print(f"Binding response: {resp.text[:200]}", flush=True)
            result = resp.json()
            if not result.get("success"):
                return "请先绑定钱包: /login"
            wallet = result.get("data", {}).get("wallet_address", "")
            resp = await client.get(f"{backend_url}/api/v1/users/{wallet}/bets")
            result = resp.json()
            if result.get("success"):
                bets = result.get("data", {}).get("list", [])
                if bets:
                    reply = "📊 我的下注\n\n"
                    for bet in bets[:10]:
                        outcome = "YES" if bet.get("outcome") == 1 else "NO"
                        amount = float(bet.get("amount", 0)) / 1e18
                        tx_type_map = {1: "创建", 2: "下注", 3: "领奖", 4: "押金退款", 5: "退款"}
                        tx_type = tx_type_map.get(bet.get("tx_type"), "其他")
                        reply += f"📌 {tx_type}: {outcome} {amount:.4f} MON\n"
                    return reply
                return "您还没有下注记录。"
            return "获取下注记录失败。"
        except Exception as e:
            print(f"Mybets error: {e}", flush=True)
            traceback.print_exc()
            return f"错误: {str(e)}"

    elif cmd == "/claimable":
        try:
            resp = await client.get(f"{backend_url}/api/v1/telegram/claimable", params={"telegram_id": user_id})
            result = resp.json()
            if result.get("success"):
                markets = result.get("data", {}).get("list", [])
                if markets:
                    reply = "💰 可领奖议题\n\n"
                    for m in markets[:5]:
                        hash_short = m.get("content_hash", "")[:10]
                        title = m.get("title", "N/A")[:25]
                        reply += f"🟢 #{hash_short} {title}\n"
                        reply += f"   [使用 /claim {m.get('content_hash')[:10]} 领取]\n\n"
                    return reply
                return "暂无可领奖的议题。"
            return "请先绑定钱包: /login"
        except Exception as e:
            print(f"Claimable error: {e}", flush=True)
            return f"错误: {str(e)}"

    elif cmd == "/refundable":
        try:
            resp = await client.get(f"{backend_url}/api/v1/telegram/refundable", params={"telegram_id": user_id})
            result = resp.json()
            if result.get("success"):
                markets = result.get("data", {}).get("list", [])
                if markets:
                    reply = "🔄 可退款议题\n\n"
                    for m in markets[:5]:
                        hash_short = m.get("content_hash", "")[:10]
                        title = m.get("title", "N/A")[:25]
                        reply += f"🔴 #{hash_short} {title}\n"
                        reply += f"   [使用 /refund {m.get('content_hash')[:10]} 退款]\n\n"
                    return reply
                return "暂无可退款的议题。"
            return "请先绑定钱包: /login"
        except Exception as e:
            print(f"Refundable error: {e}", flush=True)
            return f"错误: {str(e)}"

    elif cmd == "/resolved":
        try:
            resp = await client.get(f"{backend_url}/api/v1/telegram/resolved", params={"page": 1, "page_size": 5})
            result = resp.json()
            if result.get("success"):
                markets = result.get("data", {}).get("list", [])
                if markets:
                    reply = "✅ 已结算议题\n\n"
                    for m in markets[:5]:
                        hash_short = m.get("content_hash", "")[:10]
                        title = m.get("title", "N/A")[:25]
                        result_emoji = "YES ✅" if m.get("result") == 1 else "NO ❌"
                        reply += f"🟢 #{hash_short} {title}\n"
                        reply += f"   结果: {result_emoji}\n\n"
                    return reply
                return "暂无已结算的市场。"
            return "获取失败。"
        except Exception as e:
            print(f"Resolved error: {e}", flush=True)
            return f"错误: {str(e)}"

    elif cmd == "/bet":
        if len(args) < 3:
            return """用法: /bet <content_hash> <yes/no> <金额>

示例: /bet 0x1234abcd yes 1.5

使用 /markets 查看市场列表。"""
        content_hash = args[0]
        bet_type = args[1].lower()
        amount = args[2]
        
        if bet_type not in ["yes", "no"]:
            return "下注类型必须是 yes 或 no"
        
        sign_url = f"{mini_app_url}/sign?action=bet&market_id={content_hash}&bet_type={bet_type}&amount={amount}"
        return f"""🎯 下注确认

市场: #{content_hash[:10]}
方向: {bet_type.upper()}
金额: {amount} MON

请点击下方链接确认交易:

🔗 [点击确认下注]({sign_url})

交易需要钱包签名确认。"""

    elif cmd == "/claim":
        if not args:
            return "用法: /claim <content_hash>\n\n使用 /claimable 查看可领奖议题。"
        content_hash = args[0]
        sign_url = f"{mini_app_url}/sign?action=claim&market_id={content_hash}"
        return f"""💰 领取奖金

市场: #{content_hash[:10]}

请点击下方链接确认领取:

🔗 [点击确认领取]({sign_url})

交易需要钱包签名确认。"""

    elif cmd == "/refund":
        if not args:
            return "用法: /refund <content_hash>\n\n使用 /refundable 查看可退款议题。"
        content_hash = args[0]
        sign_url = f"{mini_app_url}/sign?action=refund&market_id={content_hash}"
        return f"""🔄 领取退款

市场: #{content_hash[:10]}

请点击下方链接确认退款:

🔗 [点击确认退款]({sign_url})

交易需要钱包签名确认。"""

    elif cmd == "/create":
        return f"""📝 创建议题指南

创建议题需要通过网页端操作:

1. 访问首页连接钱包
2. 点击"创建议题"
3. 填写议题信息:
   - 标题(简洁明了)
   - 描述(详细说明)
   - 截止时间
   - 分类
4. 支付押金(1 MON)
5. 确认交易

创建者可在议题结算后取回押金。
如果议题被取消，押金将退还。

访问: {mini_app_url}

开始创建你的预测议题吧! 🎯"""

    elif cmd == "/resolve":
        if len(args) < 2:
            return "用法: /resolve <content_hash> <yes/no>\n\n只有创建者可以结算议题。"
        content_hash = args[0]
        result = args[1].lower()
        if result not in ["yes", "no"]:
            return "结果必须是 yes 或 no"
        sign_url = f"{mini_app_url}/sign?action=resolve&market_id={content_hash}&result={result}"
        return f"""✅ 结算议题

市场: #{content_hash[:10]}
结果: {result.upper()}

请点击下方链接确认结算:

🔗 [点击确认结算]({sign_url})

只有创建者可以结算议题。"""

    elif cmd == "/cancel":
        if not args:
            return "用法: /cancel <content_hash>\n\n只有创建者可以取消议题。"
        content_hash = args[0]
        sign_url = f"{mini_app_url}/sign?action=cancel&market_id={content_hash}"
        return f"""❌ 取消议题

市场: #{content_hash[:10]}

请点击下方链接确认取消:

🔗 [点击确认取消]({sign_url})

只有创建者可以取消议题。取消后押金退还，所有下注退款。"""

    elif cmd == "/profile":
        try:
            print(f"Profile: Fetching binding for user {user_id}...", flush=True)
            resp = await client.get(f"{backend_url}/api/v1/telegram/binding", params={"telegram_id": user_id})
            print(f"Profile binding response status: {resp.status_code}", flush=True)
            print(f"Profile binding response text: {resp.text}", flush=True)
            result = resp.json()
            if not result.get("success"):
                return "请先绑定钱包: /login"
            wallet = result.get("data", {}).get("wallet_address", "")
            print(f"Profile: Fetching profile for wallet {wallet}...", flush=True)
            resp = await client.get(f"{backend_url}/api/v1/users/{wallet}/profile")
            print(f"Profile response status: {resp.status_code}", flush=True)
            print(f"Profile response text: {resp.text}", flush=True)
            result = resp.json()
            if result.get("success"):
                profile = result.get("data", {})
                win_rate = 0
                if profile.get("total_bets", 0) > 0:
                    win_rate = profile.get("win_bets", 0) / profile.get("total_bets", 1) * 100
                pnl = float(profile.get("total_pnl", 0)) / 1e18
                volume = float(profile.get("total_volume", 0)) / 1e18
                pnl_emoji = "📈" if pnl >= 0 else "📉"
                return f"""👤 用户资料

📍 钱包地址: {wallet[:10]}...{wallet[-8:]}

📊 统计数据:
• 总下注次数: {profile.get('total_bets', 0)}
• 获胜次数: {profile.get('win_bets', 0)}
• 胜率: {win_rate:.1f}%
• 总交易量: {volume:.4f} MON

{pnl_emoji} 盈亏: {pnl:+.4f} MON"""
            return "用户资料不存在。"
        except Exception as e:
            print(f"Profile error: {e}", flush=True)
            traceback.print_exc()
            return f"错误: {str(e)}"

    elif cmd == "/balance":
        try:
            print(f"Balance: Fetching for user {user_id}...", flush=True)
            print(f"Balance: Backend URL = {backend_url}", flush=True)
            url = f"{backend_url}/api/v1/telegram/balance?telegram_id={user_id}"
            print(f"Balance: Request URL = {url}", flush=True)
            resp = await client.get(url)
            print(f"Balance response status: {resp.status_code}", flush=True)
            print(f"Balance response text: {resp.text}", flush=True)
            result = resp.json()
            if result.get("success"):
                data = result.get("data", {})
                wallet = data.get("wallet_address", "")
                if wallet:
                    wallet_short = wallet[:10] + "..." + wallet[-8:]
                else:
                    wallet_short = "未绑定"
                balance = data.get("balance", "0")
                return f"""💰 钱包余额

📍 钱包地址: {wallet_short}

💎 MON 余额: {balance} MON

📊 查看交易记录: /mybets"""
            return "请先绑定钱包: /login"
        except Exception as e:
            print(f"Balance error: {e}", flush=True)
            traceback.print_exc()
            return f"错误: {str(e)}"

    elif cmd == "/hot":
        return """🔥 今日热点

暂无热点数据。

使用 /markets 查看所有活跃市场。"""

    else:
        return f"未知命令: {cmd}\n\n使用 /help 查看可用命令。"

async def send_message(client, token, chat_id, text):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        response = await client.post(url, json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown"
        })
        result = response.json()
        if not result.get("ok"):
            print(f"Markdown failed: {result}, trying plain text...", flush=True)
            response = await client.post(url, json={
                "chat_id": chat_id,
                "text": text
            })
            result = response.json()
        print(f"Sent reply: {result.get('ok')}", flush=True)
    except Exception as e:
        print(f"Send error: {e}", flush=True)
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(poll_bot())
