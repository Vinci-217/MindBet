import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    AI_API_URL: str = "https://api.hunyuan.cloud.tencent.com/v1/chat/completions"
    AI_API_KEY: str = ""
    AI_MODEL: str = "hunyuan-lite"
    
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""
    MYSQL_DATABASE: str = "mindbet"
    
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    JWT_SECRET: str = ""
    
    class Config:
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
