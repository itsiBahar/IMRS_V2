"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Star, LogOut, Film, Mail } from "lucide-react";

// ⚠️ REPLACE WITH YOUR BACKEND URL (FROM PORTS TAB, PORT 8000)
// Example: https://literate-space-waddle-8000.app.github.dev
const API_URL = "https://ubiquitous-halibut-pp6v7vjg6gq36pr5-8000.app.github.dev"; 

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  
  // NEW: State for Email Login
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
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

  // --- NEW LOGIN FUNCTION (Magic Link) ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      alert("Error logging in: " + error.message);
    } else {
      setMagicLinkSent(true);
    }
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setMagicLinkSent(false);
    setEmail("");
  };

  // --- APP FUNCTIONS ---
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
    await fetch(`${API_URL}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        user_id: session.user.id, 
        movie_id: movieId, 
        rating 
      }),
    });
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

  // --- LOGIN SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-bold text-red-600 mb-6">MovieMind AI 🧠</h1>
        <p className="mb-8 text-gray-400 text-center max-w-md">
          Collaborative Filtering + Content-Based Recommendation System.
        </p>
        
        <div className="bg-gray-900 p-8 rounded-xl border border-gray-800 w-full max-w-sm">
          {!magicLinkSent ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <label className="text-sm font-bold text-gray-400">Sign in with Email</label>
              <input 
                type="email" 
                placeholder="student@university.edu" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="p-3 rounded bg-gray-800 border border-gray-700 focus:border-red-500 outline-none text-white"
                required
              />
              <button 
                type="submit" 
                disabled={loading}
                className="bg-red-600 text-white p-3 rounded font-bold hover:bg-red-700 transition flex justify-center items-center gap-2"
              >
                {loading ? "Sending..." : <><Mail size={18}/> Send Magic Link</>}
              </button>
            </form>
          ) : (
            <div className="text-center">
              <div className="mx-auto bg-green-900/30 text-green-400 w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-green-800">
                <Mail />
              </div>
              <h3 className="text-xl font-bold mb-2">Check your email!</h3>
              <p className="text-gray-400 text-sm">We sent a login link to <br/><span className="text-white">{email}</span></p>
              <button onClick={() => setMagicLinkSent(false)} className="mt-6 text-sm text-gray-500 hover:text-white underline">
                Try a different email
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- MAIN APP SCREEN ---
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
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
        {/* SEARCH SECTION */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Search className="text-blue-400"/> Search & Rate
          </h2>
          <div className="flex gap-2 mb-6">
            <input 
              className="flex-1 p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none"
              placeholder="Search movies (e.g. Inception)..." 
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

        {/* RECOMMENDATIONS SECTION */}
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