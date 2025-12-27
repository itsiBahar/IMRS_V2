from fastapi import FastAPI
from pydantic import BaseModel
from app.recommender import search_movies, hybrid_recommendation, get_popular_movies
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

app = FastAPI()

# PASTE YOUR SUPABASE KEYS HERE
SUPABASE_URL = "https://zvopidktxwbicqkoxwhk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2b3BpZGt0eHdiaWNxa294d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTQ4MjgsImV4cCI6MjA4MjM5MDgyOH0.WSVHJoMwcUvCvs72zbwDejFJfMq-qwYz6zohy8xftZc"
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

@app.get("/")
def home():
    return {"status": "Hybrid ML Brain is Active"}

@app.get("/search")
def search(query: str):
    return search_movies(query)

@app.get("/popular")
def popular():
    return get_popular_movies()

@app.post("/rate")
def rate_movie(payload: RatingPayload):
    try:
        # Upsert: Update if exists, Insert if new
        supabase.table('ratings').upsert({
            "user_id": payload.user_id, 
            "movie_id": payload.movie_id, 
            "rating": payload.rating
        }, on_conflict="user_id, movie_id").execute()
        return {"message": "Saved"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/recommendations/{user_id}")
def get_recommendations(user_id: str):
    response = supabase.table('ratings').select("*").eq('user_id', user_id).execute()
    return hybrid_recommendation(user_id, response.data)