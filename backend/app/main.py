from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.recommender import search_movies, hybrid_recommendation, get_content_recommendations
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

app = FastAPI()

# --- CONFIGURATION (Paste your keys here) ---
SUPABASE_URL = "https://zvopidktxwbicqkoxwhk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2b3BpZGt0eHdiaWNxa294d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTQ4MjgsImV4cCI6MjA4MjM5MDgyOH0.WSVHJoMwcUvCvs72zbwDejFJfMq-qwYz6zohy8xftZc"

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Allow frontend to talk to backend
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

# --- ROUTES ---

@app.get("/")
def home():
    return {"message": "Movie Recommendation API is Running!"}

@app.get("/search")
def search(query: str):
    return search_movies(query)

@app.post("/rate")
def rate_movie(payload: RatingPayload):
    # Save rating to Supabase
    try:
        data = supabase.table('ratings').insert({
            "user_id": payload.user_id,
            "movie_id": payload.movie_id,
            "rating": payload.rating
        }).execute()
        return {"message": "Rating saved!", "data": data}
    except Exception as e:
        return {"error": str(e)}

@app.get("/recommendations/{user_id}")
def get_recommendations(user_id: str):
    # 1. Fetch user's real history from Supabase
    response = supabase.table('ratings').select("*").eq('user_id', user_id).execute()
    user_history = response.data
    
    # 2. Generate Recommendations based on that history
    return hybrid_recommendation(user_id, user_history)