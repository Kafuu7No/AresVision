"""
AI 解读页 — API 路由
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/ai", tags=["AI 解读"])


class ChatRequest(BaseModel):
    question: str
    context: dict | None = None


class ChatResponse(BaseModel):
    answer: str


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(request: Request, body: ChatRequest):
    """
    AI 问答接口。
    前端传入用户问题 + 可选的预测结果摘要上下文。
    返回大模型生成的自然语言解读。
    """
    try:
        ai = request.app.state.ai_service
        answer = await ai.chat(body.question, body.context)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 服务错误: {e}")
