from fastapi import FastAPI, Form, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from langchain_openai import ChatOpenAI
from langchain_tavily import TavilySearch
from langgraph.prebuilt import create_react_agent
from dotenv import load_dotenv
from datetime import datetime
from supabase import create_client, Client
import json
import uuid
import os
import asyncpg
import httpx
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import base64
import re

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# ── ENV ────────────────────────────────────────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
TAVILY_API_KEY     = os.getenv("TAVILY_API_KEY")
SUPABASE_URL       = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY  = os.getenv("SUPABASE_ANON_KEY")
NEON_DATABASE_URL  = os.getenv("NEON_DATABASE_URL")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

if not OPENROUTER_API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY missing")
if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("SUPABASE keys missing")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

app = FastAPI(title="Guti 2.0 AI Platform", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MODEL LISTS BY TASK ────────────────────────────────────────────────────────
MODELS = {
    "general": {
        "auto":              "openrouter/auto",
        "gpt-oss-120b":      "openai/gpt-oss-120b:free",
        "deepseek-v4-flash": "deepseek/deepseek-v4-flash:free",
        "gemma-4-31b":       "google/gemma-4-31b-it:free",
        "minimax-m2.5":      "minimax/minimax-m2.5:free",
        "nemotron-nano-12b": "nvidia/nemotron-nano-12b-v2-vl:free",
        "gpt-oss-20b":       "openai/gpt-oss-20b:free",
        "owl-alpha":         "openrouter/owl-alpha",
    },
    "code": {
        "deepseek-v3":   "deepseek/deepseek-chat-v3-0324:free",
        "qwen-2.5-72b":  "qwen/qwen-2.5-72b-instruct:free",
        "gemma-3-27b":   "google/gemma-3-27b-it:free",
        "qwen3-8b":      "qwen/qwen3-8b:free",
    },
    "vision": {
        "llama-vision":   "meta-llama/llama-3.2-11b-vision-instruct:free",
        "gemma-3-12b":    "google/gemma-3-12b-it:free",
        "qwen-vl":        "qwen/qwen2.5-vl-7b-instruct:free",
        "nemotron-nano":  "nvidia/nemotron-nano-12b-v2-vl:free",
    },
    "research": {
        "qwen-2.5-72b":      "qwen/qwen-2.5-72b-instruct:free",
        "deepseek-v4-flash": "deepseek/deepseek-v4-flash:free",
        "gemma-4-31b":       "google/gemma-4-31b-it:free",
    },
}

DEFAULT_MODEL = "gpt-oss-120b"
OPENROUTER_BASE = "https://openrouter.ai/api/v1"

model_status: dict = {}
for task_models in MODELS.values():
    for k in task_models:
        if k not in model_status:
            model_status[k] = {"ok": True, "last_error": None, "error_time": None}

# ── NEON DB ────────────────────────────────────────────────────────────────────
db_pool = None

@app.on_event("startup")
async def startup():
    global db_pool
    if NEON_DATABASE_URL:
        try:
            db_pool = await asyncpg.create_pool(NEON_DATABASE_URL, min_size=1, max_size=5)
            print("✅ Neon DB connected")
        except Exception as e:
            print(f"⚠️ Neon DB failed: {e}")

@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()

async def db_execute(query: str, *args):
    if not db_pool:
        return None
    try:
        async with db_pool.acquire() as conn:
            return await conn.execute(query, *args)
    except Exception as e:
        print(f"DB error: {e}")
        return None

async def db_fetch(query: str, *args):
    if not db_pool:
        return []
    try:
        async with db_pool.acquire() as conn:
            return await conn.fetch(query, *args)
    except Exception as e:
        print(f"DB error: {e}")
        return []

# ── AUTH ───────────────────────────────────────────────────────────────────────
security = HTTPBearer(auto_error=False)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user = supabase.auth.get_user(credentials.credentials)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        user = supabase.auth.get_user(credentials.credentials)
        return user.user if user else None
    except Exception:
        return None

@app.post("/auth/register")
async def register(email: str = Form(...), password: str = Form(...)):
    try:
        res = supabase.auth.sign_up({"email": email, "password": password})
        if res.user:
            return {"message": "Registered! You can now log in.", "user_id": res.user.id}
        raise HTTPException(status_code=400, detail="Registration failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/login")
async def login(email: str = Form(...), password: str = Form(...)):
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        if res.user and res.session:
            return {
                "access_token":  res.session.access_token,
                "refresh_token": res.session.refresh_token,
                "user": {"id": res.user.id, "email": res.user.email},
            }
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.post("/auth/logout")
async def logout(user=Depends(get_current_user)):
    try:
        supabase.auth.sign_out()
    except Exception:
        pass
    return {"message": "Logged out"}

@app.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"id": user.id, "email": user.email}

# ── MODELS API ─────────────────────────────────────────────────────────────────
@app.get("/models")
def list_models():
    result = {}
    for task, task_models in MODELS.items():
        result[task] = []
        for key, model_id in task_models.items():
            status = model_status.get(key, {"ok": True})
            if not status["ok"] and status.get("error_time"):
                try:
                    elapsed = (datetime.utcnow() - datetime.fromisoformat(status["error_time"])).seconds
                    if elapsed > 300:
                        model_status[key] = {"ok": True, "last_error": None, "error_time": None}
                        status = model_status[key]
                except Exception:
                    pass
            result[task].append({"key": key, "id": model_id, "ok": status["ok"]})
    return result

# ── SESSIONS (in-memory + Neon) ────────────────────────────────────────────────
sessions: dict = {}
MAX_HISTORY = 40
MAX_SESSIONS = 200

def get_or_create_session(session_id: str) -> dict:
    if session_id not in sessions:
        if len(sessions) >= MAX_SESSIONS:
            oldest = min(sessions, key=lambda k: sessions[k]["created_at"])
            del sessions[oldest]
        sessions[session_id] = {
            "history":       [],
            "created_at":    datetime.utcnow().isoformat(),
            "message_count": 0,
            "model":         DEFAULT_MODEL,
            "type":          "chat",
        }
    return sessions[session_id]

def trim_history(history: list) -> list:
    return history[-MAX_HISTORY:] if len(history) > MAX_HISTORY else history

@app.get("/session/new")
def new_session(session_type: str = "chat"):
    session_id = str(uuid.uuid4())
    s = get_or_create_session(session_id)
    s["type"] = session_type
    return {"session_id": session_id}

@app.delete("/session/{session_id}")
def clear_session(session_id: str):
    if session_id in sessions:
        sessions[session_id]["history"] = []
        sessions[session_id]["message_count"] = 0
    return {"status": "cleared"}

# ── SAVE SESSION TO NEON ───────────────────────────────────────────────────────
async def save_session_to_neon(user_id: str, session_id: str, title: str, session_type: str):
    await db_execute("""
        INSERT INTO sessions (id, user_id, title, session_type, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET title = $3, updated_at = NOW()
    """, uuid.UUID(session_id), user_id, title[:80], session_type)

async def save_message_to_neon(session_id: str, user_id: str, role: str, content: str, model_used: str):
    await db_execute("""
        INSERT INTO messages (session_id, user_id, role, content, model_used, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
    """, uuid.UUID(session_id), user_id, role, content, model_used)

# ── CHAT HISTORY ───────────────────────────────────────────────────────────────
@app.get("/history/list")
async def list_history(user=Depends(get_current_user)):
    rows = await db_fetch("""
        SELECT id::text, title, session_type, updated_at
        FROM sessions WHERE user_id = $1
        ORDER BY updated_at DESC LIMIT 30
    """, str(user.id))
    return {"items": [dict(r) for r in rows]}

@app.delete("/history/{session_id}")
async def delete_history(session_id: str, user=Depends(get_current_user)):
    await db_execute("""
        DELETE FROM sessions WHERE id = $1 AND user_id = $2
    """, uuid.UUID(session_id), str(user.id))
    return {"ok": True}

@app.get("/history/{session_id}/messages")
async def get_session_messages(session_id: str, user=Depends(get_current_user)):
    rows = await db_fetch("""
        SELECT role, content, model_used, created_at
        FROM messages WHERE session_id = $1
        ORDER BY created_at ASC
    """, uuid.UUID(session_id))
    return {"messages": [dict(r) for r in rows]}

# ── SYSTEM PROMPTS ─────────────────────────────────────────────────────────────
CHAT_SYSTEM_PROMPT = """You are Guti 2.0 — an advanced AI assistant specializing in research, analysis, and problem-solving.

CRITICAL LANGUAGE RULE:
- Pure Bengali → respond in pure Bengali
- Pure English → respond in pure English  
- Banglish (mixed) → respond in Banglish, matching their exact style
- NEVER switch language on your own

RESEARCH PAPER CAPABILITIES:
- Find academic papers by topic, title, DOI, or abstract snippet
- Search arXiv, Semantic Scholar, Papers With Code
- Return: title, authors, year, direct link
- Never invent links

GENERAL CAPABILITIES:
- Answer from knowledge when appropriate
- Search web for current/realtime info
- Maintain conversation memory within session

RESPONSE STYLE:
- Conversational and natural
- Use markdown for structure
- Concise unless asked for detail"""

DATA_SYSTEM_PROMPT = """You are a data analysis expert. Analyze datasets and write Python pandas code.

RULES:
1. Write clean Python code in ```python ``` blocks
2. The dataframe is already loaded as `df` — do NOT import pandas or load files
3. Use matplotlib for charts — save with: plt.savefig('output.png', dpi=100, bbox_inches='tight', facecolor='#1a1a2e')
4. Always print() results so they show in output
5. Respond in the same language as the user (Bengali/English/Banglish)
6. After the code block, give a brief explanation

IMPORTANT: Write only executable code. No placeholders."""

# ── LLM HELPER ─────────────────────────────────────────────────────────────────
def get_llm(model_key: str, task: str = "general") -> ChatOpenAI:
    task_models = MODELS.get(task, MODELS["general"])
    model_id = task_models.get(model_key) or MODELS["general"].get(model_key) or MODELS["general"][DEFAULT_MODEL]
    return ChatOpenAI(
        model=model_id,
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE,
        streaming=False,
        temperature=0.7,
        max_tokens=4096,
    )

async def call_openrouter(messages: list, model_key: str, task: str = "general", max_tokens: int = 2048) -> dict:
    task_models = MODELS.get(task, MODELS["general"])
    model_id = task_models.get(model_key) or MODELS["general"].get(model_key) or list(task_models.values())[0]
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://guti2.app",
        "X-Title": "Guti 2.0",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{OPENROUTER_BASE}/chat/completions",
            headers=headers,
            json={"model": model_id, "messages": messages, "max_tokens": max_tokens},
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "content": data["choices"][0]["message"]["content"],
            "model_used": model_id,
        }

# ── GENERAL CHAT ───────────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(
    message:    str = Form(...),
    session_id: str = Form(default="default"),
    model_key:  str = Form(default=DEFAULT_MODEL),
    user=Depends(get_optional_user),
):
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    if model_key not in MODELS["general"]:
        model_key = DEFAULT_MODEL

    session = get_or_create_session(session_id)
    chat_history = trim_history(session["history"])
    session["model"] = model_key

    user_message = {"role": "user", "content": message}
    search_tool = TavilySearch(max_results=6, tavily_api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None

    def generate():
        try:
            llm = get_llm(model_key, "general")
            tools = [search_tool] if search_tool else []
            agent = create_react_agent(model=llm, tools=tools, prompt=CHAT_SYSTEM_PROMPT)
            response = agent.invoke({"messages": chat_history + [user_message]})
            final_answer = response["messages"][-1].content

            model_status[model_key] = {"ok": True, "last_error": None, "error_time": None}
            session["history"].append({"role": "user", "content": message})
            session["history"].append({"role": "assistant", "content": final_answer})
            session["message_count"] += 1

            # Save to Neon (fire and forget via supabase fallback)
            if user:
                import asyncio
                try:
                    loop = asyncio.get_event_loop()
                    title = message[:60]
                    loop.run_until_complete(save_session_to_neon(
                        str(user.id), session_id, title, "chat"
                    ))
                    loop.run_until_complete(save_message_to_neon(
                        session_id, str(user.id), "user", message, model_key
                    ))
                    loop.run_until_complete(save_message_to_neon(
                        session_id, str(user.id), "assistant", final_answer, model_key
                    ))
                except Exception:
                    pass

            chunk_size = 40
            for i in range(0, len(final_answer), chunk_size):
                yield f"data: {json.dumps({'text': final_answer[i:i+chunk_size]})}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            err_str = str(e).lower()
            is_rate = any(x in err_str for x in ["rate limit", "429", "too many", "quota", "overloaded"])
            if is_rate:
                model_status[model_key] = {"ok": False, "last_error": "Rate limit", "error_time": datetime.utcnow().isoformat()}
                msg = f"⏳ Model **{model_key}** hit rate limit. Switch to another model."
                yield f"data: {json.dumps({'error': 'rate_limit', 'message': msg})}\n\n"
            else:
                yield f"data: {json.dumps({'error': 'general', 'message': f'Error: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

# ── DATA ANALYSIS ──────────────────────────────────────────────────────────────
uploaded_csvs: dict = {}  # session_id -> {df, filename, analysis}

def auto_analyze_csv(df: pd.DataFrame, filename: str) -> dict:
    """Auto analyze CSV — stats, types, missing values, smart column selection."""
    total_rows, total_cols = df.shape
    columns_info = []
    
    for col in df.columns:
        missing = int(df[col].isnull().sum())
        unique = int(df[col].nunique())
        col_info = {
            "name": col,
            "type": "numerical" if df[col].dtype in ['int64', 'float64'] else "categorical",
            "dtype": str(df[col].dtype),
            "missing": missing,
            "missing_pct": round(missing / total_rows * 100, 1),
            "unique_values": unique,
        }
        if df[col].dtype in ['int64', 'float64']:
            col_info.update({
                "min": round(float(df[col].min()), 2),
                "max": round(float(df[col].max()), 2),
                "mean": round(float(df[col].mean()), 2),
                "median": round(float(df[col].median()), 2),
                "std": round(float(df[col].std()), 2),
            })
        else:
            top = df[col].value_counts().head(5).to_dict()
            col_info["top_values"] = {str(k): int(v) for k, v in top.items()}
        columns_info.append(col_info)

    # Smart column importance scoring
    def score_col(c):
        s = (1 - df[c].isnull().mean()) * 10
        if df[c].dtype in ['int64', 'float64']:
            s += 5
            mean = df[c].mean()
            if mean != 0:
                s += min(df[c].std() / abs(mean), 5)
        return s

    sorted_cols = sorted(df.columns, key=score_col, reverse=True)
    top_cols = sorted_cols[:20]

    numerical_cols = [c["name"] for c in columns_info if c["type"] == "numerical"]
    categorical_cols = [c["name"] for c in columns_info if c["type"] == "categorical"]
    
    # Data quality score
    missing_score = 100 - (df.isnull().mean().mean() * 100)
    duplicate_score = 100 - (df.duplicated().sum() / total_rows * 100)
    quality_score = round((missing_score + duplicate_score) / 2)

    # Smart sample for large datasets
    is_large = total_rows > 100_000
    sample_df = df.sample(min(10_000, total_rows), random_state=42) if is_large else df

    return {
        "filename": filename,
        "total_rows": total_rows,
        "total_cols": total_cols,
        "numerical_cols": numerical_cols,
        "categorical_cols": categorical_cols,
        "top_important_cols": top_cols,
        "columns": columns_info,
        "quality_score": quality_score,
        "has_missing": any(c["missing"] > 0 for c in columns_info),
        "duplicate_rows": int(df.duplicated().sum()),
        "is_large_dataset": is_large,
        "sample_note": f"⚠️ Large dataset — analyzing {min(10_000, total_rows):,} sample rows" if is_large else None,
        "sample_data": df.head(5).fillna("").to_dict(orient="records"),
    }

def safe_exec_code(code: str, df: pd.DataFrame) -> dict:
    """Safely execute pandas code, capture output and charts."""
    import sys
    from io import StringIO
    
    old_stdout = sys.stdout
    sys.stdout = StringIO()
    chart_b64 = None
    error = None
    
    safe_globals = {
        "__builtins__": {
            "print": print, "len": len, "range": range, "list": list,
            "dict": dict, "str": str, "int": int, "float": float,
            "round": round, "sum": sum, "max": max, "min": min,
            "sorted": sorted, "enumerate": enumerate, "zip": zip,
            "type": type, "isinstance": isinstance, "abs": abs,
        },
        "pd": pd, "plt": plt, "df": df,
    }
    try:
        import numpy as np
        safe_globals["np"] = np
    except ImportError:
        pass
    
    try:
        exec(code, safe_globals)
        if plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#1a1a2e', edgecolor='none')
            buf.seek(0)
            chart_b64 = base64.b64encode(buf.read()).decode()
            plt.close('all')
    except Exception as e:
        error = str(e)
        plt.close('all')
    
    output = sys.stdout.getvalue()
    sys.stdout = old_stdout
    return {"output": output if output else None, "chart": chart_b64, "error": error}

@app.post("/data/upload")
async def upload_csv(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    user=Depends(get_optional_user),
):
    if not file.filename.endswith(('.csv', '.CSV')):
        raise HTTPException(status_code=400, detail="Only CSV files allowed")
    
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        try:
            df = pd.read_csv(io.BytesIO(content), encoding="latin-1")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Cannot read CSV: {str(e)}")
    
    analysis = auto_analyze_csv(df, file.filename)
    uploaded_csvs[session_id] = {"df": df, "filename": file.filename, "analysis": analysis, "bytes": content}
    
    # Save to Neon
    if user and db_pool:
        try:
            await db_execute("""
                INSERT INTO analysis_history (session_id, user_id, filename, total_rows, total_cols, analysis_result, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
            """, uuid.UUID(session_id), str(user.id), file.filename,
                analysis["total_rows"], analysis["total_cols"], json.dumps(analysis))
        except Exception:
            pass
    
    return {"ok": True, "analysis": analysis}

@app.post("/data/ask")
async def ask_data_question(
    question: str = Form(...),
    session_id: str = Form(...),
    model_key: str = Form(default="deepseek-v3"),
    user=Depends(get_optional_user),
):
    if session_id not in uploaded_csvs:
        raise HTTPException(status_code=400, detail="No CSV uploaded for this session. Upload a file first.")
    
    csv_data = uploaded_csvs[session_id]
    df = csv_data["df"]
    analysis = csv_data["analysis"]
    
    # Build compact context (token efficient)
    context = f"""Dataset: {analysis['filename']}
Rows: {analysis['total_rows']:,} | Columns: {analysis['total_cols']}
Numerical: {analysis['numerical_cols'][:10]}
Categorical: {analysis['categorical_cols'][:10]}
Quality Score: {analysis['quality_score']}/100

Column details (top 10):
{json.dumps(analysis['columns'][:10], ensure_ascii=False)}

Sample (3 rows):
{json.dumps(analysis['sample_data'][:3], ensure_ascii=False)}

User question: {question}

Write Python pandas code to answer this. df is already loaded."""

    messages = [
        {"role": "system", "content": DATA_SYSTEM_PROMPT},
        {"role": "user", "content": context}
    ]
    
    result = await call_openrouter(messages, model_key, task="code")
    ai_response = result["content"]
    model_used = result["model_used"]
    
    # Extract code
    code_match = re.search(r'```python\n(.*?)```', ai_response, re.DOTALL)
    
    if not code_match:
        return {"answer": ai_response, "code": None, "chart": None, "output": None, "model_used": model_used}
    
    code = code_match.group(1).strip()
    explanation = ai_response[ai_response.rfind('```')+3:].strip()
    
    exec_result = safe_exec_code(code, df.copy())
    
    # Save chart to Neon
    if user and db_pool and exec_result.get("chart"):
        try:
            await db_execute("""
                INSERT INTO charts (session_id, user_id, question, code_used, chart_data, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
            """, uuid.UUID(session_id), str(user.id), question, code, json.dumps({"has_chart": True}))
        except Exception:
            pass
    
    return {
        "answer": explanation or "Analysis complete.",
        "code": code,
        "output": exec_result.get("output"),
        "chart": exec_result.get("chart"),
        "error": exec_result.get("error"),
        "model_used": model_used,
    }

@app.post("/data/auto-insights")
async def auto_insights(
    session_id: str = Form(...),
    model_key: str = Form(default="deepseek-v3"),
    user=Depends(get_optional_user),
):
    """Auto generate 5 interesting insights from dataset."""
    if session_id not in uploaded_csvs:
        raise HTTPException(status_code=400, detail="No CSV uploaded.")
    
    analysis = uploaded_csvs[session_id]["analysis"]
    
    prompt = f"""Dataset: {analysis['filename']}
Rows: {analysis['total_rows']:,} | Columns: {analysis['total_cols']}
Numerical cols: {analysis['numerical_cols'][:8]}
Categorical cols: {analysis['categorical_cols'][:8]}
Column stats: {json.dumps(analysis['columns'][:8], ensure_ascii=False)}

Generate 5 interesting analytical questions/hypotheses about this dataset.
Format as JSON array: [{{"question": "...", "why_interesting": "...", "chart_type": "bar/line/scatter/pie"}}]
Respond ONLY with the JSON array, no other text."""

    messages = [{"role": "user", "content": prompt}]
    result = await call_openrouter(messages, model_key, task="code", max_tokens=800)
    
    try:
        clean = result["content"].strip()
        clean = re.sub(r'```json|```', '', clean).strip()
        insights = json.loads(clean)
        return {"insights": insights, "model_used": result["model_used"]}
    except Exception:
        return {"insights": [], "raw": result["content"], "model_used": result["model_used"]}

# ── IMAGE ANALYSIS ─────────────────────────────────────────────────────────────
@app.post("/image/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    question: str = Form(default="এই ছবিটা বিস্তারিত analyze করো।"),
    model_key: str = Form(default="llama-vision"),
    session_id: str = Form(default=""),
    user=Depends(get_optional_user),
):
    allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, GIF allowed")
    
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
    
    image_b64 = base64.b64encode(content).decode()
    vision_models = MODELS["vision"]
    model_id = vision_models.get(model_key, list(vision_models.values())[0])
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_id,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{file.content_type};base64,{image_b64}"}},
                {"type": "text", "text": question}
            ]
        }],
        "max_tokens": 1024,
    }
    
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(f"{OPENROUTER_BASE}/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    
    return {
        "analysis": data["choices"][0]["message"]["content"],
        "model_used": model_id,
    }

# ── AI HUMANIZER ───────────────────────────────────────────────────────────────
@app.post("/humanize")
async def humanize_text(
    text: str = Form(...),
    model_key: str = Form(default="deepseek-v3"),
    user=Depends(get_optional_user),
):
    prompt = f"""Rewrite the following AI-generated text to make it sound natural and human-written.

Rules:
- Vary sentence lengths (mix short and long)
- Add natural transitions and connectors
- Use contractions where appropriate
- Add subtle imperfections natural to human writing
- Keep the same meaning and language (Bengali/English/Banglish)
- Do NOT add new information

Text to humanize:
{text}

Provide ONLY the rewritten text, nothing else."""

    messages = [{"role": "user", "content": prompt}]
    result = await call_openrouter(messages, model_key, task="general", max_tokens=2000)
    return {"humanized": result["content"], "model_used": result["model_used"]}

# ── AI DETECTOR ────────────────────────────────────────────────────────────────
@app.post("/detect-ai")
async def detect_ai_text(
    text: str = Form(...),
    model_key: str = Form(default="deepseek-v3"),
    user=Depends(get_optional_user),
):
    prompt = f"""Analyze whether the following text was written by AI or a human.

Analyze these signals:
1. Sentence structure variety (AI tends to be uniform)
2. Vocabulary patterns (AI overuses certain words)
3. Natural flow and transitions
4. Presence of personal anecdotes or emotions
5. Logical structure (AI tends to be very structured)

Text to analyze:
{text[:3000]}

Respond in JSON format only:
{{"score": 0-100, "verdict": "AI Generated / Likely AI / Mixed / Likely Human / Human Written", "signals": ["signal1", "signal2", "signal3"], "explanation": "brief explanation in same language as text"}}"""

    messages = [{"role": "user", "content": prompt}]
    result = await call_openrouter(messages, model_key, task="general", max_tokens=500)
    
    try:
        clean = result["content"].strip()
        clean = re.sub(r'```json|```', '', clean).strip()
        detection = json.loads(clean)
        return {"detection": detection, "model_used": result["model_used"]}
    except Exception:
        return {"raw": result["content"], "model_used": result["model_used"]}

# ── VOICE (ELEVENLABS TTS) ─────────────────────────────────────────────────────
@app.post("/voice/speak")
async def text_to_speech(
    text: str = Form(...),
    voice_id: str = Form(default="21m00Tcm4TlvDq8ikWAM"),
    user=Depends(get_optional_user),
):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
    
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text[:500],
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers=headers,
            json=payload,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="TTS failed")
        audio_b64 = base64.b64encode(resp.content).decode()
    
    return {"audio_base64": audio_b64, "mime_type": "audio/mpeg"}

# ── HEALTH & STATS ─────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "running", "app": "Guti 2.0 AI Platform", "version": "2.0.0"}

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "sessions": len(sessions),
        "csv_sessions": len(uploaded_csvs),
        "db_connected": db_pool is not None,
        "time": datetime.utcnow().isoformat(),
    }

@app.get("/admin/stats")
async def admin_stats(user=Depends(get_current_user)):
    rows = await db_fetch("SELECT COUNT(*) as total FROM messages")
    sessions_rows = await db_fetch("SELECT COUNT(*) as total FROM sessions")
    return {
        "total_messages": rows[0]["total"] if rows else 0,
        "total_sessions": sessions_rows[0]["total"] if sessions_rows else 0,
        "active_sessions": len(sessions),
        "model_status": model_status,
    }