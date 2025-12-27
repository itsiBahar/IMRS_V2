import joblib
import pandas as pd
import os
import random

# Get the path to the backend folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

print("Loading Content-Based Models...")

# Load ONLY the lightweight models
# (We removed svd_model.pkl)
cosine_sim = joblib.load(os.path.join(BASE_DIR, 'cosine_sim.pkl'))
movies = joblib.load(os.path.join(BASE_DIR, 'movies_metadata.pkl'))
indices = joblib.load(os.path.join(BASE_DIR, 'indices.pkl'))

print("Models Loaded Successfully!")

def search_movies(query):
    """Simple search function"""
    mask = movies['title'].str.contains(query, case=False, na=False)
    return movies[mask].head(10)[['movieId', 'title', 'genres']].to_dict('records')

def hybrid_recommendation(user_id, user_ratings_history, top_n=12):
    """
    Lite Mode Logic (Content-Based Only):
    1. If user has no history -> Return Popular/Random movies.
    2. If user has history -> Find movies similar to the ones they rated 5 stars.
    """
    
    # COLD START: No history, return random mix
    if not user_ratings_history:
        return movies.sample(n=top_n)[['movieId', 'title', 'genres']].to_dict('records')

    # Get movies the user LIKED (4.0 or higher)
    liked_movies = [r['movie_id'] for r in user_ratings_history if r['rating'] >= 4.0]
    
    # If user has history but no 'Likes', just use their last watched movie
    if not liked_movies:
        liked_movies = [user_ratings_history[-1]['movie_id']]

    # Content-Based Logic
    similar_scores = []
    
    # Look at the last 3 liked movies to find similarities
    for movie_id in liked_movies[-3:]:
        if movie_id in indices:
            idx = indices[movie_id]
            # Get similarity scores from the matrix
            sim_scores = list(enumerate(cosine_sim[idx]))
            # Get top 5 similar for each liked movie
            sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
            similar_scores.extend(sim_scores[1:6])
            
    # Sort all collected candidates by score
    similar_scores = sorted(similar_scores, key=lambda x: x[1], reverse=True)
    
    # Remove duplicates (using a set)
    seen = set()
    final_recs = []
    
    for idx, score in similar_scores:
        movie_id = movies.iloc[idx]['movieId']
        # Don't recommend movies they already watched
        has_watched = any(r['movie_id'] == movie_id for r in user_ratings_history)
        
        if movie_id not in seen and not has_watched:
            seen.add(movie_id)
            final_recs.append({
                "movieId": int(movie_id),
                "title": movies.iloc[idx]['title'],
                "genres": movies.iloc[idx]['genres'],
                "score": round(score * 100, 0) # Score as percentage
            })
            
        if len(final_recs) >= top_n:
            break
            
    # If we still don't have enough, fill with random ones
    if len(final_recs) < top_n:
        remaining = top_n - len(final_recs)
        extras = movies.sample(n=remaining)[['movieId', 'title', 'genres']].to_dict('records')
        for m in extras:
            m['score'] = 0
            final_recs.append(m)

    return final_recs