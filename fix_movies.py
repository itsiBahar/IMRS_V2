import pandas as pd
import os

# Path to your working local file
source = 'backend/movies_metadata.pkl'
target = 'hf_deploy/app/movies.csv'

if os.path.exists(source):
    print(f"📖 Reading {source}...")
    df = pd.read_pickle(source)
    
    # Clean up data for CSV safety
    # Ensure genres are strings, not lists/objects
    if 'genres' in df.columns:
        df['genres'] = df['genres'].astype(str)
        
    print(f"💾 Saving to {target}...")
    df.to_csv(target, index=False)
    print("✅ Success! specific 'movies.csv' created.")
else:
    print(f"❌ Error: Could not find {source}")