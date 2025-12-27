"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Star, LogOut, Film } from "lucide-react";

// ⚠️ REPLACE THIS WITH YOUR BACKEND URL (FROM PORTS TAB, PORT 8000)
const API_URL = "https://ubiquitous-halibut-pp6v7vjg6gq36pr5-8000.app.github.dev"; 

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [movies, setMovies] = useState<any[]>([]); // Search results
  const [recs, setRecs] = useState<any[]>([]);     // Recommendations
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) fetchRecs(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if(session) fetchRecs(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async () => supabase.auth.signInWithOAuth({ provider: 'github' }); // Using GitHub for easy demo
  const logout = async () => supabase.auth.signOut();

  // --- FUNCTIONS ---

  const handleSearch = async () => {
    if(!search) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/search?query=${search}`);
      const data = await res.json();
      setMovies(data);
    } catch (e) {
      console.error("Backend offline?", e);
    }
    setLoading(false);
  };

  const rateMovie = async (movieId: number, rating: number) => {
    if (!session) return alert("Please login to rate!");
    
    // Optimistic UI update (optional)
    alert(`Rated ${rating} Stars! Updating recommendations...`);

    await fetch(`${API_URL}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: session.user.id, 
        movie_id: movieId, 
        rating 
      }),
    });
    
    // Refresh recommendations after rating
    fetchRecs(session.user.id);
  };

  const fetchRecs = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/recommendations/${userId}`);
      const data = await res.json();
      setRecs(data);
    } catch (e) {
      console.error("Error fetching recs", e);
    }
  };

  // --- UI RENDER ---

  if (!session) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-bold text-red-600 mb-6">MovieMind AI 🧠</h1>
        <p className="mb-8 text-gray-400 text-center max-w-md">
          A Machine Learning project that learns your taste. <br/>
          Collaborative Filtering + Content-Based Analysis.
        </p>
        <button onClick={login} className="bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition">
          Login with GitHub to Start
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Header */}
      <nav className="border-b border-gray-800 p-6 flex justify-between items-center bg-gray-900 sticky top-0 z-50">
        <div className="flex items-center gap-2">
           <Film className="text-red-500" />
           <h1 className="text-xl font-bold">MovieMind <span className="text-xs bg-red-600 px-2 py-0.5 rounded text-white ml-2">v2.0</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 hidden sm:block">{session.user.email}</span>
          <button onClick={logout} className="p-2 bg-gray-800 rounded-full hover:bg-red-900 transition"><LogOut size={18}/></button>
        </div>
      </nav>

      <main className="p-6 max-w-6xl mx-auto">
        
        {/* Search Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Search className="text-blue-400"/> Search & Rate
          </h2>
          <div className="flex gap-2 mb-6">
            <input 
              className="flex-1 p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
              placeholder="Search for movies you have watched (e.g., Avengers, Frozen)..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} disabled={loading} className="bg-blue-600 px-6 rounded-lg font-bold hover:bg-blue-500 transition">
              {loading ? "..." : "Search"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {movies.map((m) => (
              <div key={m.movieId} className="bg-gray-900 p-4 rounded-xl border border-gray-800">
                <h3 className="font-bold text-lg text-gray-100">{m.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{m.genres}</p>
                <div className="flex gap-1 justify-center bg-gray-800 p-2 rounded-lg">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => rateMovie(m.movieId, star)} className="hover:scale-125 transition">
                      <Star size={20} className="text-yellow-500 fill-yellow-500/20 hover:fill-yellow-500" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recommendations Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="text-3xl">✨</span> Recommended for You
          </h2>
          
          {recs.length === 0 ? (
            <div className="text-center p-10 bg-gray-900 rounded-xl border border-dashed border-gray-700">
              <p className="text-gray-400">Rate some movies above to get AI recommendations!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recs.map((m) => (
                <div key={m.movieId} className="relative group bg-gradient-to-br from-gray-900 to-gray-800 p-5 rounded-xl border border-gray-700 hover:border-green-500 transition-all hover:-translate-y-1 shadow-lg">
                  <div className="absolute top-2 right-2 bg-green-900/50 text-green-400 text-xs font-mono px-2 py-1 rounded border border-green-700/50">
                    {m.score} Match
                  </div>
                  <h3 className="font-bold text-lg mt-4 leading-tight min-h-[3rem]">{m.title}</h3>
                  <p className="text-xs text-gray-400 mt-2">{m.genres}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}