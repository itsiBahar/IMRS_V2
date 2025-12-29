from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.recommender import search_movies, hybrid_recommendation, get_popular_movies
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

app = FastAPI()

# PASTE YOUR SUPABASE KEYS HERE
SUPABASE_URL = "https://zvopidktxwbicqkoxwhk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2b3BpZGt0eHdiaWNxa294d2hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjgxNDgyOCwiZXhwIjoyMDgyMzkwODI4fQ.cdTu1OH_XFhsgEjMJns9_riuIphDHe7_lnJ9OUn86Sc"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RatingPayload(BaseModel):
    user_id: str
    movie_id: int
    rating: float

class WatchlistPayload(BaseModel):
    user_id: str
    movie_id: int
    status: str # 'watched' or 'plan_to_watch'

@app.get("/")
def home(): return {"status": "Online"}

@app.get("/search")
def search(query: str): return search_movies(query)

@app.get("/popular")
def popular():
    # Returns 12 random popular movies
    return get_popular_movies(n=12)

@app.get("/user_stats/{user_id}")
def user_stats(user_id: str):
    # Check how many movies the user has actually rated
    res = supabase.table('ratings').select('*', count='exact').eq('user_id', user_id).execute()
    return {"rated_count": res.count}

# In backend/app/main.py

@app.post("/rate")
def rate_movie(payload: RatingPayload):
    try:
        # Try to save data
        response = supabase.table('ratings').upsert({
            "user_id": payload.user_id, 
            "movie_id": payload.movie_id, 
            "rating": payload.rating
        }, on_conflict="user_id, movie_id").execute()
        
        return {"message": "Saved", "data": response.data}

    except Exception as e:
        # If it crashes, print the error to the Terminal AND send it to the Frontend
        print(f"\n🔥 CRITICAL ERROR: {str(e)}\n")
        raise HTTPException(status_code=400, detail=f"Database Error: {str(e)}")

@app.post("/watchlist")
def update_watchlist(payload: WatchlistPayload):
    supabase.table('watchlist').upsert({
        "user_id": payload.user_id, "movie_id": payload.movie_id, "status": payload.status
    }, on_conflict="user_id, movie_id").execute()
    return {"message": "Added to watchlist"}

@app.get("/watchlist/{user_id}")
def get_watchlist(user_id: str):
    res = supabase.table('watchlist').select('*').eq('user_id', user_id).execute()
    # We need to fetch movie details for these IDs
    # (In a real app, we'd do a SQL join, but for now let's use the frontend to map IDs)
    return res.data

@app.get("/recommendations/{user_id}")
def get_recommendations(user_id: str):
    # Fetch history
    response = supabase.table('ratings').select("*").eq('user_id', user_id).execute()
    history = response.data
    
    # If less than 3 ratings, return empty to trigger Onboarding
    if len(history) < 3:
        return []
        
    return hybrid_recommendation(user_id, history)