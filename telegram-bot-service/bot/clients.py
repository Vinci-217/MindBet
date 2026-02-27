import httpx
from typing import Optional, Dict, Any
from bot.config import settings

class BackendClient:
    def __init__(self):
        self.base_url = settings.BACKEND_API_URL
        self.jwt_secret = settings.JWT_SECRET
    
    async def get_markets(
        self, 
        page: int = 1, 
        page_size: int = 10,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        params = {"page": page, "page_size": page_size}
        if status:
            params["status"] = status
            
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/markets",
                params=params
            )
            response.raise_for_status()
            return response.json()
    
    async def get_market(self, market_id: int) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/markets/{market_id}"
            )
            response.raise_for_status()
            return response.json()
    
    async def get_market_by_hash(self, content_hash: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/markets/{content_hash}"
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_profile(self, address: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/users/{address}/profile"
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_bets(
        self, 
        address: str, 
        page: int = 1, 
        page_size: int = 10
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/users/{address}/bets",
                params={"page": page, "page_size": page_size}
            )
            response.raise_for_status()
            return response.json()
    
    async def bind_wallet(
        self,
        telegram_id: int,
        wallet_address: str,
        signature: str,
        username: str = ""
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/telegram/bind",
                json={
                    "telegram_id": telegram_id,
                    "wallet_address": wallet_address,
                    "signature": signature,
                    "username": username
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def get_binding(
        self,
        telegram_id: int
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/telegram/binding",
                params={"telegram_id": telegram_id}
            )
            response.raise_for_status()
            return response.json()
    
    async def unbind_wallet(
        self,
        telegram_id: int
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/api/v1/telegram/binding",
                params={"telegram_id": telegram_id}
            )
            response.raise_for_status()
            return response.json()
    
    async def get_claimable_markets(
        self,
        telegram_id: int
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/telegram/claimable",
                params={"telegram_id": telegram_id}
            )
            response.raise_for_status()
            return response.json()
    
    async def get_refundable_markets(
        self,
        telegram_id: int
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/telegram/refundable",
                params={"telegram_id": telegram_id}
            )
            response.raise_for_status()
            return response.json()
    
    async def get_resolved_markets(
        self,
        page: int = 1,
        page_size: int = 10
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/telegram/resolved",
                params={"page": page, "page_size": page_size}
            )
            response.raise_for_status()
            return response.json()
    
    async def get_wallet_balance(
        self,
        telegram_id: int
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/telegram/balance",
                params={"telegram_id": telegram_id}
            )
            response.raise_for_status()
            return response.json()


class AIClient:
    def __init__(self):
        self.base_url = settings.AI_SERVICE_URL
    
    async def get_hot_events(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/ai/hot-events"
            )
            response.raise_for_status()
            return response.json()
    
    async def get_emotional_feedback(
        self,
        user_address: str,
        total_bets: int,
        win_bets: int,
        total_pnl: int,
        recent_results: list
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/ai/emotional-feedback",
                json={
                    "user_address": user_address,
                    "total_bets": total_bets,
                    "win_bets": win_bets,
                    "total_pnl": total_pnl,
                    "recent_results": recent_results
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def recognize_intent(self, message: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/ai/intent",
                json={"message": message}
            )
            response.raise_for_status()
            return response.json()

backend_client = BackendClient()
ai_client = AIClient()
