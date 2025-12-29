from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client, Client
from datetime import datetime
import pandas as pd
import os
import random
from thefuzz import process

# --- CONFIG ---
SUPABASE_URL = "https://zvopidktxwbicqkoxwhk.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2b3BpZGt0eHdiaWNxa294d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTQ4MjgsImV4cCI6MjA4MjM5MDgyOH0.WSVHJoMwcUvCvs72zbwDejFJfMq-qwYz6zohy8xftZc"

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"⚠️ Supabase Error: {e}")

# --- LOAD DATA ---
try:
    from app.recommender import get_popular_movies, hybrid_recommendation, movies, indices, cosine_sim
except ImportError:
    movies = pd.DataFrame(columns=['movieId', 'title', 'genres', 'popularity'])
    def get_popular_movies(n=10): return []
    def hybrid_recommendation(mid, history=[]): return []

# --- MODELS ---
class RatingPayload(BaseModel):
    user_id: str
    movie_id: int
    rating: float
class ProfilePayload(BaseModel):
    user_id: str
    genres: List[str]
class WatchlistPayload(BaseModel):
    user_id: str
    movie_id: int
    status: str
class ReviewPayload(BaseModel):
    user_id: str
    movie_id: int
    rating: float
    review_text: str

# --- ENDPOINTS ---

@app.get("/")
def home(): return {"status": "Online"}

@app.get("/popular")
def popular(): return get_popular_movies(n=12)

# ✅ FILTERED ONBOARDING (Prevents showing rated movies)
@app.get("/onboarding_movies/{user_id}")
def get_onboarding_movies(user_id: str, genres: str = ""):
    # 1. Get movies user already rated
    user_ratings = supabase.table('ratings').select("movie_id").eq('user_id', user_id).execute().data
    rated_ids = [r['movie_id'] for r in user_ratings]

    # 2. Filter DB
    mask = movies['genres'].str.contains("|".join(genres.split(",")), case=False, na=False)
    # Exclude rated movies
    mask = mask & (~movies['movieId'].isin(rated_ids))
    
    filtered = movies[mask].head(100) # Take top 100 candidates
    
    if filtered.empty: return []
    
    # Return random sample
    return filtered.sample(n=min(12, len(filtered)))[['movieId', 'title', 'genres']].to_dict('records')

@app.get("/user_taste_profile/{user_id}")
def get_user_taste_profile(user_id: str):
    response = supabase.table('ratings').select("*").eq('user_id', user_id).execute()
    ratings = response.data
    if not ratings: return {"top_genres": [], "total_watched": 0}
    genre_scores = {}
    total = 0
    for r in ratings:
        row = movies[movies['movieId'] == r['movie_id']]
        if not row.empty:
            for g in row.iloc[0]['genres'].split('|'):
                genre_scores[g] = genre_scores.get(g, 0) + r['rating']
                total += r['rating']
    profile = [{"genre": k, "score": int((v/total)*100)} for k,v in genre_scores.items()]
    profile.sort(key=lambda x: x['score'], reverse=True)
    return {"top_genres": profile[:5], "total_watched": len(ratings)}

@app.get("/recommendations/hidden_gems/{user_id}")
def get_hidden_gems(user_id: str):
    ratings = supabase.table('ratings').select("*").eq('user_id', user_id).execute().data
    if not ratings or len(ratings) < 3: return []
    liked_ids = [r['movie_id'] for r in ratings if r['rating'] >= 4.0]
    watched_ids = [r['movie_id'] for r in ratings]
    if not liked_ids: return []
    
    fav_genres = set()
    for mid in liked_ids:
        row = movies[movies['movieId'] == mid]
        if not row.empty:
            for g in row.iloc[0]['genres'].split('|'): fav_genres.add(g)

    mask = (~movies['movieId'].isin(watched_ids)) & (movies['genres'].apply(lambda x: any(g in x for g in fav_genres)))
    if 'popularity' in movies.columns: mask = mask & (movies['popularity'] < 20)
    
    candidates = movies[mask].head(100)
    if candidates.empty: return []
    
    gems = candidates.sample(n=min(10, len(candidates)))[['movieId', 'title', 'genres']].to_dict('records')
    for g in gems: g['reason'] = "💎 Hidden Gem"
    return gems

@app.get("/recommendations/{user_id}")
def recommend(user_id: str):
    user_ratings = supabase.table('ratings').select("*").eq('user_id', user_id).execute().data
    
    # Exclude watched movies from recommendations is handled inside hybrid_recommendation usually, 
    # but we should ensure the seed movie logic works
    if user_ratings:
        recent = user_ratings[-1]
        good = [r for r in user_ratings if r['rating'] >= 3.0]
        random.shuffle(good)
        seed = recent if (random.random() > 0.5) else (good[0] if good else recent)
        
        try:
            new_recs = hybrid_recommendation(seed['movie_id'], user_ratings)
            if new_recs:
                random.shuffle(new_recs)
                row = movies[movies['movieId'] == seed['movie_id']]
                title = row.iloc[0]['title'] if not row.empty else "recent activity"
                for m in new_recs: m['reason'] = f"Because you watched {title}"
                return new_recs[:10]
        except: pass

    recs = get_popular_movies(n=12)
    for m in recs: m['reason'] = "🔥 Trending Worldwide"
    return recs

@app.get("/user_stats/{user_id}")
def user_stats(user_id: str):
    res = supabase.table('ratings').select('*', count='exact').eq('user_id', user_id).execute()
    count = res.count
    persona = "Movie Buff 🎬" if count > 20 else "Casual Watcher 🍿" if count > 5 else "Newcomer 🐣"
    return {"rated_count": count, "persona": persona}

@app.get("/search")
def search_movies(query: str):
    if movies.empty: return []
    best_genre, score = process.extractOne(query, ["Action", "Comedy", "Horror", "Drama", "Sci-Fi", "Romance"])
    if score > 85:
        mask = movies['genres'].str.contains(best_genre, case=False, na=False)
        results = movies[mask]
        if 'popularity' in movies.columns: results = results.sort_values('popularity', ascending=False)
        results = results.head(50).sample(n=min(20, 50))
    else:
        matches = process.extract(query, movies['title'].tolist(), limit=20)
        matched_titles = [m[0] for m in matches if m[1] > 60]
        results = movies[movies['title'].isin(matched_titles)]
    return results[['movieId', 'title', 'genres']].to_dict('records')

@app.get("/recommendations/time_aware")
def get_time_aware_recs():
    now = datetime.now()
    hour = now.hour
    day = now.weekday()
    context = ""
    mask = None
    if hour >= 23 or hour < 4:
        context = "Late Night Thrills 🌙"
        mask = movies['genres'].str.contains('Thriller|Mystery|Horror', case=False, na=False)
    elif day < 4: 
        context = "Short & Sweet for Weeknights 🛋️"
        mask = movies['genres'].str.contains('Comedy|Family|Animation', case=False, na=False)
    else: 
        context = "Weekend Blockbusters 🍿"
        mask = movies['genres'].str.contains('Adventure|Sci-Fi|Action', case=False, na=False)
    
    filtered = movies[mask]
    if filtered.empty: filtered = movies.head(50)
    results = filtered.sample(n=min(12, len(filtered)))[['movieId', 'title', 'genres']].to_dict('records')
    return {"context": context, "movies": results}

@app.post("/rate")
def rate_movie(payload: RatingPayload):
    supabase.table('ratings').upsert(payload.dict(), on_conflict="user_id, movie_id").execute()
    return {"message": "Saved"}

@app.post("/watchlist")
def update_watchlist(payload: WatchlistPayload):
    supabase.table('watchlist').upsert(payload.dict(), on_conflict="user_id, movie_id").execute()
    return {"message": "Saved"}

@app.post("/profile")
def update_profile(payload: ProfilePayload):
    supabase.table('profiles').upsert({"id": payload.user_id, "favorite_genres": payload.genres}).execute()
    return {"message": "Updated"}

@app.get("/movie/{movie_id}")
def get_movie_details(movie_id: int):
    movie = movies[movies['movieId'] == movie_id].iloc[0]
    similar = []
    try:
        if movie_id in indices:
            sim_scores = sorted(list(enumerate(cosine_sim[indices[movie_id]])), key=lambda x: x[1], reverse=True)[1:7]
            similar = movies.iloc[[i[0] for i in sim_scores]][['movieId', 'title', 'genres']].to_dict('records')
    except: pass
    return {"movieId": int(movie['movieId']), "title": movie['title'], "genres": movie['genres'], "similar": similar}

@app.get("/reviews/{movie_id}")
def get_reviews(movie_id: int):
    return supabase.table('reviews').select("*").eq('movie_id', movie_id).order('created_at', desc=True).limit(20).execute().data

@app.post("/review")
def add_review(payload: ReviewPayload):
    supabase.table('reviews').upsert(payload.dict(), on_conflict="user_id, movie_id").execute()
    return {"message": "Saved"}

@app.delete("/user_data/{user_id}")
def reset_user_data(user_id: str):
    try:
        supabase.table('ratings').delete().eq('user_id', user_id).execute()
        supabase.table('watchlist').delete().eq('user_id', user_id).execute()
        supabase.table('reviews').delete().eq('user_id', user_id).execute()
        supabase.table('profiles').delete().eq('id', user_id).execute()
        return {"message": "Reset"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))