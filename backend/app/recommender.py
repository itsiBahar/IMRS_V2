import joblib
import pandas as pd
import os

# Get the path to the backend folder (one level up from 'app')
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

print("Loading ML Models... this might take a minute.")

# Load the models using absolute paths
svd = joblib.load(os.path.join(BASE_DIR, 'svd_model.pkl'))
cosine_sim = joblib.load(os.path.join(BASE_DIR, 'cosine_sim.pkl'))
movies = joblib.load(os.path.join(BASE_DIR, 'movies_metadata.pkl'))
indices = joblib.load(os.path.join(BASE_DIR, 'indices.pkl'))

print("Models Loaded Successfully!")

def get_content_recommendations(movie_id, top_n=10):
    """Find similar movies based on Genes/TF-IDF"""
    if movie_id not in indices:
        return []
    
    idx = indices[movie_id]
    
    # Get similarity scores
    sim_scores = list(enumerate(cosine_sim[idx]))
    sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
    sim_scores = sim_scores[1:top_n+1]
    
    movie_indices = [i[0] for i in sim_scores]
    return movies.iloc[movie_indices][['movieId', 'title', 'genres']].to_dict('records')

def hybrid_recommendation(user_id, user_ratings_history, top_n=12):
    """
    Hybrid Logic:
    1. If user is new (no ratings), return random popular movies.
    2. If user has ratings, combine SVD Score + Content Similarity Boost.
    """
    
    # Cold Start (New User)
    if not user_ratings_history:
        return movies.sample(n=top_n)[['movieId', 'title', 'genres']].to_dict('records')

    # Get movies the user hasn't seen yet
    rated_movie_ids = set([r['movie_id'] for r in user_ratings_history])
    all_movie_ids = movies['movieId'].unique()
    movies_to_predict = [mid for mid in all_movie_ids if mid not in rated_movie_ids]
    
    predictions = []
    
    # We grab the movies the user rated highly (>= 4 stars) to use for Content Boosting
    liked_movies = [r['movie_id'] for r in user_ratings_history if r['rating'] >= 4.0]
    
    # Limit prediction to 500 candidates for speed
    import random
    candidates = random.sample(list(movies_to_predict), min(len(movies_to_predict), 500))
    
    for mid in candidates:
        # 1. SVD Score (Collaborative Filtering)
        est = svd.predict(uid=0, iid=mid).est 
        
        # 2. Content Boost (Content-Based Filtering)
        boost = 0
        if mid in indices and liked_movies:
            idx = indices[mid]
            # Compare this candidate movie to the last movie the user liked
            last_liked_id = liked_movies[-1]
            if last_liked_id in indices:
                last_liked_idx = indices[last_liked_id]
                sim_score = cosine_sim[idx][last_liked_idx]
                boost = sim_score * 0.5 # Add a small boost for similarity
        
        final_score = est + boost
        predictions.append((mid, final_score))
        
    # Sort by highest score
    predictions.sort(key=lambda x: x[1], reverse=True)
    top_candidates = predictions[:top_n]
    
    # Format result
    results = []
    for mid, score in top_candidates:
        movie_row = movies[movies['movieId'] == mid].iloc[0]
        results.append({
            "movieId": int(movie_row['movieId']),
            "title": movie_row['title'],
            "genres": movie_row['genres'],
            "score": round(score, 2)
        })
        
    return results

def search_movies(query):
    """Simple search function"""
    mask = movies['title'].str.contains(query, case=False, na=False)
    return movies[mask].head(10)[['movieId', 'title', 'genres']].to_dict('records')