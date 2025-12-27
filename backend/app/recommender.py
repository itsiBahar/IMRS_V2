import joblib
import pandas as pd
import os
import random

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

print("Loading FULL Hybrid Models (SVD + Content)...")
svd = joblib.load(os.path.join(BASE_DIR, 'svd_model.pkl'))
cosine_sim = joblib.load(os.path.join(BASE_DIR, 'cosine_sim.pkl'))
movies = joblib.load(os.path.join(BASE_DIR, 'movies_metadata.pkl'))
indices = joblib.load(os.path.join(BASE_DIR, 'indices.pkl'))
print("Models Loaded.")

def search_movies(query):
    mask = movies['title'].str.contains(query, case=False, na=False)
    return movies[mask].head(20)[['movieId', 'title', 'genres']].to_dict('records')

def get_popular_movies(n=20):
    """Return a mix of popular genres for the onboarding screen"""
    # A simple way to get diverse movies is to sample
    return movies.sample(n=n)[['movieId', 'title', 'genres']].to_dict('records')

def hybrid_recommendation(user_id, user_ratings_history, top_n=12):
    # COLD START: User has rated 0 movies
    if not user_ratings_history:
        return [] # Return empty list to trigger "Onboarding Mode" in Frontend

    rated_movie_ids = set([r['movie_id'] for r in user_ratings_history])
    all_movie_ids = movies['movieId'].unique()
    movies_to_predict = [mid for mid in all_movie_ids if mid not in rated_movie_ids]
    
    # Speed up: Only predict for a random sample of 1000 movies
    candidates = random.sample(list(movies_to_predict), min(len(movies_to_predict), 1000))
    
    liked_movies = [r['movie_id'] for r in user_ratings_history if r['rating'] >= 4.0]
    predictions = []

    for mid in candidates:
        # 1. Collaborative Score (SVD)
        # We use a dummy uid because SVD was trained on integers, but we just need the model weights
        est = svd.predict(uid=0, iid=mid).est 
        
        # 2. Content Boost
        boost = 0
        if mid in indices and liked_movies:
            idx = indices[mid]
            # Check similarity with the last movie user liked
            last_liked = liked_movies[-1]
            if last_liked in indices:
                sim_score = cosine_sim[idx][indices[last_liked]]
                boost = sim_score * 1.5 
        
        final_score = est + boost
        predictions.append((mid, final_score))
        
    predictions.sort(key=lambda x: x[1], reverse=True)
    top_candidates = predictions[:top_n]
    
    results = []
    for mid, score in top_candidates:
        row = movies[movies['movieId'] == mid].iloc[0]
        results.append({
            "movieId": int(row['movieId']),
            "title": row['title'],
            "genres": row['genres'],
            "score": round(score, 2)
        })
    return results