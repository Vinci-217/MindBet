import httpx
import json
import logging
from typing import List, Dict, Optional
from app.config import settings

logger = logging.getLogger(__name__)

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

class LLMClient:
    def __init__(self):
        self.api_url = settings.AI_API_URL
        self.api_key = settings.AI_API_KEY
        self.model = settings.AI_MODEL
    
    async def chat(
        self, 
        messages: List[Dict[str, str]], 
        temperature: float = 0.7,
        max_tokens: int = 2000
    ) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.api_url,
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    async def analyze_hot_events(self) -> Dict:
        messages = [
            {
                "role": "system",
                "content": """你是一个专业的热点事件分析师。请分析当前的热点话题，并生成适合预测市场的问题。
输出格式要求：
1. 标题：简短概括热点
2. 摘要：100字以内的摘要
3. 预测问题：3个可以用于预测市场的二元问题（是/否类型）"""
            },
            {
                "role": "user", 
                "content": "请分析今天的热点事件，重点关注：加密货币、体育赛事、科技新闻、国际政治等领域。"
            }
        ]
        
        result = await self.chat(messages)
        return {
            "title": "今日热点",
            "summary": result[:200],
            "analysis": result
        }
    
    async def generate_market_topics(self, discussions: List[str]) -> List[Dict]:
        discussion_text = "\n".join(discussions[-50:])
        
        messages = [
            {
                "role": "system",
                "content": """你是一个预测市场议题生成专家。根据用户讨论内容，生成适合的预测市场议题。
输出格式要求（JSON数组）：
[{
    "question": "问题标题",
    "description": "详细描述",
    "category": "分类",
    "deadline_suggestion": "建议截止时间"
}]"""
            },
            {
                "role": "user",
                "content": f"根据以下讨论内容生成预测市场议题：\n\n{discussion_text}"
            }
        ]
        
        result = await self.chat(messages)
        return [{"question": "示例问题", "description": result, "category": "general"}]
    
    async def summarize_discussions(self, messages: List[str]) -> str:
        text = "\n".join(messages[-100:])
        
        prompt = f"""请总结以下群聊讨论内容，提取关键观点和讨论热点：

{text}

请用简洁的语言总结：1. 主要讨论话题 2. 不同观点 3. 讨论结论"""

        result = await self.chat([{"role": "user", "content": prompt}])
        return result
    
    async def generate_emotional_feedback(
        self, 
        user_address: str,
        total_bets: int,
        win_bets: int,
        total_pnl: int,
        recent_results: List[str]
    ) -> str:
        win_rate = (win_bets / total_bets * 100) if total_bets > 0 else 0
        
        messages = [
            {
                "role": "system",
                "content": """你是一个友好的预测市场助手，根据用户的战绩提供情绪价值反馈。
要鼓励用户，给出建设性建议，保持积极正面的态度。"""
            },
            {
                "role": "user",
                "content": f"""用户战绩：
- 总下注次数：{total_bets}
- 获胜次数：{win_bets}
- 胜率：{win_rate:.1f}%
- 累计盈亏：{total_pnl} USDC
- 最近结果：{', '.join(recent_results)}

请给用户一些鼓励和建议。"""
            }
        ]
        
        return await self.chat(messages)
    
    async def recognize_intent(self, message: str) -> Dict:
        if self.api_key and self.api_key != "your_ai_api_key" and not self.api_key.startswith("your_"):
            try:
                return await self._recognize_intent_with_llm(message)
            except Exception as e:
                logger.warning(f"LLM intent recognition failed, falling back to keywords: {e}")
        
        return self._recognize_intent_with_keywords(message)
    
    def _recognize_intent_with_keywords(self, message: str) -> Dict:
        message_lower = message.lower()
        
        for command, keywords in INTENT_KEYWORDS.items():
            for keyword in keywords:
                if keyword.lower() in message_lower:
                    return {
                        "has_intent": True,
                        "command": command,
                        "args": [],
                        "confidence": 0.8,
                        "reply": None
                    }
        
        return {
            "has_intent": False,
            "command": None,
            "args": [],
            "confidence": 0.0,
            "reply": f"你好！我是 MindBet 预测市场助手。\n\n你可以用自然语言和我交流，例如：\n• \"我要登录\"\n• \"有什么市场\"\n• \"查看余额\"\n\n输入 /help 查看所有可用命令。"
        }
    
    async def _recognize_intent_with_llm(self, message: str) -> Dict:
        messages = [
            {
                "role": "system",
                "content": """你是一个意图识别助手。分析用户消息，判断是否包含执行预测市场【操作】的意图。

**重要：以下情况不是命令意图，应返回 has_intent: false**
- 询问某事会不会发生（如"比特币会涨吗"、"特朗普会当选吗"）
- 询问概率/可能性
- 闲聊、问候
- 询问功能

**只有明确的操作请求才是命令意图：**
- login: 绑定钱包 (触发词: 登录、绑定钱包、连接钱包)
- logout: 解绑钱包 (触发词: 解绑、退出登录)
- markets: 查看市场列表 (触发词: 有什么市场、查看市场列表)
- market <id>: 查看特定市场详情 (需要市场ID)
- bet: 下注操作 (触发词: 我要下注、帮我下注)
- profile: 查看战绩 (触发词: 我的战绩、个人资料)
- balance: 查看余额 (触发词: 我的余额、钱包余额)
- mybets: 查看下注记录 (触发词: 我的下注记录)
- help: 帮助 (触发词: 怎么用、使用说明)

输出要求：必须严格输出JSON格式：
{
    "has_intent": true或false,
    "command": "命令名或null",
    "args": [],
    "confidence": 0.0到1.0,
    "reply": "无意图时的简短回复"
}

示例：
"比特币会涨到10万吗" → {"has_intent": false, "command": null, "args": [], "confidence": 0.9, "reply": null}
"我要登录" → {"has_intent": true, "command": "login", "args": [], "confidence": 0.95, "reply": null}
"有什么市场" → {"has_intent": true, "command": "markets", "args": [], "confidence": 0.9, "reply": null}
"你好" → {"has_intent": false, "command": null, "args": [], "confidence": 0.9, "reply": "你好！我是MindBet预测市场助手，有什么可以帮你的吗？"}"""
            },
            {
                "role": "user",
                "content": message
            }
        ]
        
        result = await self.chat(messages, temperature=0.3)
        
        try:
            json_match = result
            if "```json" in result:
                json_match = result.split("```json")[1].split("```")[0]
            elif "```" in result:
                json_match = result.split("```")[1].split("```")[0]
            
            parsed = json.loads(json_match.strip())
            
            if "has_intent" not in parsed:
                parsed["has_intent"] = False
            if "command" not in parsed:
                parsed["command"] = None
            if "args" not in parsed:
                parsed["args"] = []
            if "confidence" not in parsed:
                parsed["confidence"] = 0.0
            if "reply" not in parsed:
                parsed["reply"] = None
                
            return parsed
        except json.JSONDecodeError:
            return {
                "has_intent": False,
                "command": None,
                "args": [],
                "confidence": 0.0,
                "reply": "抱歉，我没理解您的意思。输入 /help 查看可用命令。"
            }

llm_client = LLMClient()
