from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.services.llm_client import llm_client

router = APIRouter(prefix="/api/v1/ai", tags=["AI"])

class ChatRequest(BaseModel):
    messages: List[dict]
    temperature: float = 0.7
    max_tokens: int = 2000

class ChatResponse(BaseModel):
    success: bool
    data: dict

class GenerateTopicsRequest(BaseModel):
    discussions: List[str]

class EmotionalFeedbackRequest(BaseModel):
    user_address: str
    total_bets: int
    win_bets: int
    total_pnl: int
    recent_results: List[str] = []

class IntentRequest(BaseModel):
    message: str

class IntentResponse(BaseModel):
    success: bool
    data: dict

@router.get("/hot-events")
async def get_hot_events():
    try:
        result = await llm_client.analyze_hot_events()
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-topics")
async def generate_topics(request: GenerateTopicsRequest):
    try:
        topics = await llm_client.generate_market_topics(request.discussions)
        return {"success": True, "data": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        result = await llm_client.chat(
            request.messages,
            request.temperature,
            request.max_tokens
        )
        return {"success": True, "data": {"content": result}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/emotional-feedback")
async def emotional_feedback(request: EmotionalFeedbackRequest):
    try:
        feedback = await llm_client.generate_emotional_feedback(
            request.user_address,
            request.total_bets,
            request.win_bets,
            request.total_pnl,
            request.recent_results
        )
        return {"success": True, "data": {"feedback": feedback}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/summarize")
async def summarize_discussions(request: GenerateTopicsRequest):
    try:
        summary = await llm_client.summarize_discussions(request.discussions)
        return {"success": True, "data": {"summary": summary}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/intent", response_model=IntentResponse)
async def recognize_intent(request: IntentRequest):
    try:
        result = await llm_client.recognize_intent(request.message)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
