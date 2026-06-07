from fastapi import FastAPI, Form, HTTPException, Depends
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

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

OPENROUTER_API_KEY  = os.getenv("OPENROUTER_API_KEY")
TAVILY_API_KEY      = os.getenv("TAVILY_API_KEY")
SUPABASE_URL        = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY   = os.getenv("SUPABASE_ANON_KEY")

if not OPENROUTER_API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY missing")
if not TAVILY_API_KEY:
    raise RuntimeError("TAVILY_API_KEY missing")
if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("SUPABASE_URL / SUPABASE_ANON_KEY missing")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

app = FastAPI(title="Agent Guti Research API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FREE_MODELS = {
    "auto":              "openrouter/auto",              # auto-select best
    "nemotron-nano-12b": "nvidia/nemotron-nano-12b-v2-vl:free",  # fastest
    "gpt-oss-120b":      "openai/gpt-oss-120b:free",    # most reliable
    "gpt-oss-20b":       "openai/gpt-oss-20b:free",     # lightweight
    "deepseek-v4-flash": "deepseek/deepseek-v4-flash:free",  # 1M context
    "gemma-4-31b":       "google/gemma-4-31b-it:free",  # Google
    "minimax-m2.5":      "minimax/minimax-m2.5:free",   # strong general
    "owl-alpha":         "openrouter/owl-alpha",         # agentic
}

DEFAULT_MODEL = "gpt-oss-120b"

model_status: dict = {
    k: {"ok": True, "last_error": None, "error_time": None}
    for k in FREE_MODELS
}

search_tool = TavilySearch(max_results=6, tavily_api_key=TAVILY_API_KEY)

SYSTEM_PROMPT = """You are Agent Guti — an advanced AI research assistant specializing in academic paper discovery and web research.

CRITICAL LANGUAGE RULE:
- Pure Bengali → respond in pure Bengali
- Pure English → respond in pure English
- Banglish (mixed) → respond in Banglish, matching their exact style
- Mirror tone exactly: casual হলে casual, formal হলে formal
- NEVER switch language on your own

RESEARCH PAPER CAPABILITIES (highest priority):
You are an expert at finding academic research papers. When a user:

1. Gives a TOPIC (e.g. "transformers in NLP", "climate change ML") →
   - Search for top papers on that topic
   - Return: paper title, authors, year, direct link (arXiv / DOI / Semantic Scholar)
   - Format as a clean numbered list with clickable links

2. Gives a PAPER TITLE →
   - Search for the exact paper
   - Return: full title, authors, year, abstract summary, direct arXiv/DOI link

3. Gives a DOI or arXiv ID (e.g. "1706.03762" or "10.1145/...") →
   - Find and return the direct paper link, title, authors, abstract

4. Gives an ABSTRACT SNIPPET →
   - Identify the paper and return full details + link

PAPER SEARCH STRATEGY:
- Always use web search to find papers
- Prefer arXiv.org links (free PDF access)
- Also check: Semantic Scholar, Papers With Code, Google Scholar
- Return ONLY working links found via search — never invent links
- If paper has GitHub code, mention it too

GENERAL CAPABILITIES:
1. Answer from training knowledge when appropriate
2. Search web for current/realtime info
3. Maintain conversation memory within session
4. For news, prices, recent events → always web search first

RESPONSE STYLE:
- Conversational and natural, not robotic
- Use markdown for structure
- Paper lists: numbered, with title + authors + year + link
- Concise unless asked for detail"""


def get_llm(model_key: str) -> ChatOpenAI:
    model_id = FREE_MODELS.get(model_key, FREE_MODELS[DEFAULT_MODEL])
    return ChatOpenAI(
        model=model_id,
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        streaming=False,
        temperature=0.7,
        max_tokens=4096,
    )


sessions: dict = {}
MAX_HISTORY  = 40
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
        }
    return sessions[session_id]


def trim_history(history: list) -> list:
    return history[-MAX_HISTORY:] if len(history) > MAX_HISTORY else history


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
            return {
                "message": "Registered! You can now log in.",
                "user_id": res.user.id,
            }
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


@app.get("/models")
def list_models():
    result = []
    for key, model_id in FREE_MODELS.items():
        status = model_status.get(key, {"ok": True})
        if not status["ok"] and status.get("error_time"):
            try:
                elapsed = (datetime.utcnow() - datetime.fromisoformat(status["error_time"])).seconds
                if elapsed > 300:
                    model_status[key] = {"ok": True, "last_error": None, "error_time": None}
                    status = model_status[key]
            except Exception:
                pass
        result.append({
            "key":        key,
            "model_id":   model_id,
            "ok":         status["ok"],
            "last_error": status.get("last_error"),
            "error_time": status.get("error_time"),
        })
    return {"models": result}


@app.post("/models/{model_key}/reset")
def reset_model_status(model_key: str):
    if model_key not in model_status:
        raise HTTPException(status_code=404, detail="Model not found")
    model_status[model_key] = {"ok": True, "last_error": None, "error_time": None}
    return {"message": f"{model_key} reset to OK"}


@app.get("/session/new")
def new_session():
    session_id = str(uuid.uuid4())
    get_or_create_session(session_id)
    return {"session_id": session_id}


@app.get("/session/{session_id}/history")
def get_history(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]


@app.delete("/session/{session_id}")
def clear_session(session_id: str):
    if session_id in sessions:
        sessions[session_id]["history"]       = []
        sessions[session_id]["message_count"] = 0
    return {"status": "cleared"}


@app.post("/chat")
async def chat(
    message:    str = Form(...),
    session_id: str = Form(default="default"),
    model_key:  str = Form(default=DEFAULT_MODEL),
    user=Depends(get_optional_user),
):
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    if model_key not in FREE_MODELS:
        model_key = DEFAULT_MODEL

    session      = get_or_create_session(session_id)
    chat_history = trim_history(session["history"])
    session["model"] = model_key

    user_message = {"role": "user", "content": message}

    def generate():
        status = model_status.get(model_key, {"ok": True})
        if not status["ok"]:
            try:
                elapsed = (datetime.utcnow() - datetime.fromisoformat(status["error_time"])).seconds
                if elapsed <= 300:
                    msg = f"⏳ Model **{model_key}** is currently busy. Please wait or switch to another model."
                    yield f"data: {json.dumps({'error': 'rate_limit', 'model': model_key, 'message': msg})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                else:
                    model_status[model_key] = {"ok": True, "last_error": None, "error_time": None}
            except Exception:
                pass

        try:
            llm   = get_llm(model_key)
            agent = create_react_agent(model=llm, tools=[search_tool], prompt=SYSTEM_PROMPT)

            response     = agent.invoke({"messages": chat_history + [user_message]})
            final_answer = response["messages"][-1].content

            model_status[model_key] = {"ok": True, "last_error": None, "error_time": None}

            session["history"].append({"role": "user",      "content": message})
            session["history"].append({"role": "assistant", "content": final_answer})
            session["message_count"] += 1

            if user:
                try:
                    supabase.table("chat_logs").insert({
                        "user_id":    str(user.id),
                        "session_id": session_id,
                        "model":      model_key,
                        "message":    message[:500],
                        "response":   final_answer[:1000],
                        "created_at": datetime.utcnow().isoformat(),
                    }).execute()
                except Exception:
                    pass

            chunk_size = 40
            for i in range(0, len(final_answer), chunk_size):
                yield f"data: {json.dumps({'text': final_answer[i:i+chunk_size]})}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            err_str = str(e).lower()
            is_rate = any(x in err_str for x in [
                "rate limit", "429", "too many", "quota",
                "overloaded", "capacity", "credits",
            ])
            if is_rate:
                model_status[model_key] = {
                    "ok":         False,
                    "last_error": "Rate limit / overloaded",
                    "error_time": datetime.utcnow().isoformat(),
                }
                msg = f"⏳ Model **{model_key}** hit rate limit. Switch to another model from the sidebar, or wait ~5 minutes."
                yield f"data: {json.dumps({'error': 'rate_limit', 'model': model_key, 'message': msg})}\n\n"
            else:
                yield f"data: {json.dumps({'error': 'general', 'message': f'Error: {str(e)}'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/admin/stats")
async def admin_stats(user=Depends(get_current_user)):
    try:
        res = supabase.table("chat_logs").select("model, created_at, user_id").execute()
        model_counts = {}
        user_set = set()
        for row in res.data:
            m = row["model"]
            model_counts[m] = model_counts.get(m, 0) + 1
            user_set.add(row["user_id"])
        return {
            "total_messages":  len(res.data),
            "unique_users":    len(user_set),
            "model_usage":     model_counts,
            "active_sessions": len(sessions),
            "model_status":    model_status,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/users")
async def admin_users(user=Depends(get_current_user)):
    try:
        res = supabase.table("chat_logs").select(
            "user_id, created_at, model, session_id"
        ).order("created_at", desc=True).execute()
        users_seen = {}
        for row in res.data:
            uid = row["user_id"]
            if uid not in users_seen:
                users_seen[uid] = {
                    "user_id":     uid,
                    "messages":    0,
                    "last_active": row["created_at"],
                    "models_used": set(),
                }
            users_seen[uid]["messages"]    += 1
            users_seen[uid]["last_active"]  = max(users_seen[uid]["last_active"], row["created_at"])
            users_seen[uid]["models_used"].add(row["model"])
        return {
            "total_users": len(users_seen),
            "users": [
                {**v, "models_used": list(v["models_used"])}
                for v in users_seen.values()
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def root():
    return {"status": "running", "agent": "Agent Guti Research", "version": "2.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy", "sessions": len(sessions), "time": datetime.utcnow().isoformat()}


# ── Chat History (titles) ──────────────────────────────────────────────────────
@app.post("/history/save")
async def save_history_title(
    title:      str = Form(...),
    session_id: str = Form(...),
    user=Depends(get_current_user),
):
    try:
        # Only insert if THIS USER hasn't saved this session yet
        existing = supabase.table("chat_history")            .select("session_id")            .eq("session_id", session_id)            .eq("user_id", str(user.id))            .execute()
        if not existing.data:
            supabase.table("chat_history").insert({
                "user_id":    str(user.id),
                "session_id": session_id,
                "title":      title[:60],
                "updated_at": datetime.utcnow().isoformat(),
            }).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/history/list")
async def list_history(user=Depends(get_current_user)):
    try:
        res = supabase.table("chat_history")\
            .select("session_id, title, updated_at")\
            .eq("user_id", str(user.id))\
            .order("updated_at", desc=True)\
            .limit(20)\
            .execute()
        return {"items": res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/history/{session_id}")
async def delete_history(session_id: str, user=Depends(get_current_user)):
    try:
        supabase.table("chat_history")\
            .delete()\
            .eq("session_id", session_id)\
            .eq("user_id", str(user.id))\
            .execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))