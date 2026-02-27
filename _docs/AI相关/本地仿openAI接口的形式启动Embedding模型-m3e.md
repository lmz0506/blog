---
layout: doc
title: 本地仿openAI接口
category: AI相关
date: '2026-02-27'
tags: []
---
```python
import os
import torch
from langchain_community.embeddings import HuggingFaceEmbeddings
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Union
from fastapi import FastAPI, HTTPException
import uvicorn
import threading
from pydantic import BaseModel
app = FastAPI()

## 启用 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
## 设置环境变量以指定使用的GPU
os.environ["CUDA_VISIBLE_DEVICES"] = "3"  # 使用第1块GPU
device = "cuda" if torch.cuda.is_available() else "cpu"
## 加载本地 embedding 模型
embeddings = {
    'm3e': HuggingFaceEmbeddings(
        model_name=r'G:\畅享\项目\2025\春晖路数智网格员\现场模型启动脚本\embedding模型及脚本\m3e-base',
        model_kwargs={"device": device},
    ),
}

mutex = threading.Lock()
THREAD_LOCK_MAX_WAIT_TIME_IN_SEC = 3


## 定义请求体模型，支持 input 为 str 或 list[str]
class EmbeddingRequest(BaseModel):
    input: Union[str, List[str]]
    model: str


@app.post("/v1/embeddings")
async def embedding_v1(item: EmbeddingRequest):
    input_texts = item.input
    model_name = item.model

    # 统一转为列表处理
    if isinstance(input_texts, str):
        input_texts = [input_texts]

    if not isinstance(input_texts, list):
        raise HTTPException(status_code=400, detail="input 必须是字符串或字符串数组")

    data = []

    if mutex.acquire(timeout=THREAD_LOCK_MAX_WAIT_TIME_IN_SEC):
        try:
            if model_name in embeddings:
                emb = embeddings[model_name]
                for idx, text in enumerate(input_texts):
                    vector = emb.embed_query(text)
                    data.append({
                        "object": "embedding",
                        "embedding": vector,
                        "index": idx
                    })
            else:
                raise HTTPException(status_code=400, detail=f"模型 {model_name} 不支持")
        finally:
            mutex.release()

    # 使用字符长度模拟 token 数量（如需精确统计可引入 tokenizer）
    total_tokens = sum(len(text) for text in input_texts)

    return {
        "object": "list",
        "data": data,
        "model": model_name,
        "usage": {
            "prompt_tokens": total_tokens,
            "total_tokens": total_tokens
        }
    }

if __name__ == '__main__':
    uvicorn.run(app="EmbeddingApi:app", host='0.0.0.0', port=6006, workers=2)

```

