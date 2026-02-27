import asyncio
import os
import httpx

async def test_bot():
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "8583468831:AAGdoLZKOFaO1Bj0Zm8KDdIQv_O-QnXsR00")
    proxy = os.environ.get("TELEGRAM_PROXY", "http://localhost:7897")
    
    print(f"Token: {token[:20]}...")
    print(f"Proxy: {proxy}")
    
    proxies = {"http://": proxy, "https://": proxy}
    async with httpx.AsyncClient(proxies=proxies, timeout=30.0) as client:
        response = await client.get(f"https://api.telegram.org/bot{token}/getMe")
        print(f"getMe response: {response.json()}")
        
        response = await client.get(f"https://api.telegram.org/bot{token}/getUpdates?limit=5")
        data = response.json()
        print(f"Got {len(data.get('result', []))} updates")
        
        for update in data.get('result', []):
            print(f"  - Update ID: {update['update_id']}")
            if 'message' in update:
                print(f"    Message: {update['message'].get('text')}")
                chat_id = update['message']['chat']['id']
                response = await client.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json={"chat_id": chat_id, "text": "测试回复：收到你的消息！"}
                )
                print(f"    Send result: {response.json()}")

if __name__ == "__main__":
    asyncio.run(test_bot())
