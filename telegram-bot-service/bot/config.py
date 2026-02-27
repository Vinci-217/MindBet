import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_PROXY: str = ""
    
    BACKEND_API_URL: str = "http://localhost:8080"
    AI_SERVICE_URL: str = "http://localhost:8003"
    MINI_APP_URL: str = "http://43.139.143.247"
    
    JWT_SECRET: str = ""
    
    class Config:
        env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
        env_file_encoding = "utf-8"

settings = Settings()
