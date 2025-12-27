"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Star, Film, LogOut, Activity, Sparkles, ArrowRight } from "lucide-react";

// 1. YOUR BACKEND URL (From Ports Tab)
const API_URL = "https://ubiquitous-halibut-pp6v7vjg6gq36pr5-8000.app.github.dev"; 

// 2. YOUR TMDB API KEY (Get from themoviedb.org -> Settings -> API)
// If you leave this blank, it will show colored boxes instead of posters.
const TMDB_API_KEY = "1e2f039872a06c3b7e7bbb5c2d93888b"; 

const GENRES = ["Action", "Comedy", "Drama", "Horror", "Romance", "Sci-Fi", "Thriller"];

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<"home" | "onboarding">("home");
  const [movies, setMovies] = useState<any[]>([]); 
  const [recs, setRecs] = useState<any[]>([]);     
  const [search, setSearch] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [ratedCount, setRatedCount] = useState(0); // Track ratings for onboarding

  // Auth State
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkConnection();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) checkUserStatus(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if(session) checkUserStatus(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkConnection = async () => {
    try {
      const res = await fetch(`${API_URL}/`);
      if (res.ok) setIsConnected(true);
    } catch (e) { setIsConnected(false); }
  };

  const checkUserStatus = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/recommendations/${userId}`);
      const data = await res.json();
      
      // If user has NO recommendations, they are new -> Onboarding
      if (Array.isArray(data) && data.length === 0) {
        setView("onboarding");
        loadPopularMovies();
      } else {
        setView("home");
        setRecs(data);
        loadPopularMovies(); 
      }
    } catch (e) { console.error(e); }
  };

  const loadPopularMovies = async () => {
    const res = await fetch(`${API_URL}/popular`);
    const data = await res.json();
    setMovies(data);
  };

  const handleSearch = async () => {
    if(!search) return;
    try {
      const res = await fetch(`${API_URL}/search?query=${search}`);
      const data = await res.json();
      setMovies(data);
    } catch (e) { alert("Search failed."); }
  };

  const rateMovie = async (movieId: number, rating: number) => {
    if (!session) return;
    
    // Increment local counter for Onboarding
    setRatedCount(prev => prev + 1);

    // Optimistic UI: Remove from onboarding list to show progress
    if(view === "onboarding") {
      setMovies(prev => prev.filter(m => m.movieId !== movieId));
    }

    await fetch(`${API_URL}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session.user.id, movie_id: movieId, rating }),
    });

    if (view === "home") {
        const res = await fetch(`${API_URL}/recommendations/${session.user.id}`);
        const data = await res.json();
        setRecs(data);
    }
  };

  const finishOnboarding = () => {
     if (ratedCount < 3) {
        alert(`Please rate ${3 - ratedCount} more movies first!`);
        return;
     }
     setView("home");
     checkUserStatus(session.user.id);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (!error && data.session) { setSession(data.session); checkUserStatus(data.session.user.id); }
      else if (error) alert(error.message);
      else alert("Check email or try logging in.");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
      if (data.session) { setSession(data.session); checkUserStatus(data.session.user.id); }
    }
    setLoading(false);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
        <div className={`fixed top-4 right-4 flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono ${isConnected ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"}`}>
           <Activity size={12}/> {isConnected ? "System Online" : "Backend Offline"}
        </div>
        <div className="w-full max-w-md bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl">
           <h1 className="text-3xl font-bold text-center mb-6 text-red-600">MovieMind AI</h1>
           <form onSubmit={handleAuth} className="space-y-4">
             <input className="w-full bg-gray-800 p-3 rounded text-white border border-gray-700" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
             <input className="w-full bg-gray-800 p-3 rounded text-white border border-gray-700" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
             <button disabled={loading} className="w-full bg-red-600 p-3 rounded font-bold hover:bg-red-700 transition">{loading ? "..." : authMode === "login" ? "Sign In" : "Sign Up"}</button>
           </form>
           <button onClick={() => setAuthMode(authMode==="login"?"signup":"login")} className="w-full text-center mt-4 text-gray-400 text-sm hover:text-white">
             {authMode==="login" ? "Create Account" : "Back to Login"}
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20">
      <nav className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-50 px-6 py-4 flex justify-between items-center backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Film className="text-red-600" />
          <span className="font-bold text-xl">MovieMind</span>
        </div>
        <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`} title="Backend Status"></div>
            <button onClick={() => supabase.auth.signOut()} className="bg-gray-800 p-2 rounded-full"><LogOut size={16}/></button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {view === "onboarding" && (
          <div className="text-center py-8 animate-in fade-in duration-700">
            <h1 className="text-4xl font-bold mb-3">Welcome to MovieMind.</h1>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Rate at least 3 movies to unlock your feed. <br/>
              <span className="text-red-500 font-bold">Rated: {ratedCount} / 3</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-10">
               {movies.map(m => <MovieCard key={m.movieId} movie={m} onRate={rateMovie} />)}
            </div>
            <button onClick={finishOnboarding} className={`fixed bottom-8 right-8 px-8 py-4 rounded-full font-bold shadow-2xl transition flex items-center gap-2 ${ratedCount >= 3 ? "bg-white text-black hover:scale-105" : "bg-gray-700 text-gray-400 cursor-not-allowed"}`}>
              {ratedCount >= 3 ? "Enter App" : "Rate more to continue"} <ArrowRight size={20}/>
            </button>
          </div>
        )}

        {view === "home" && (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="relative max-w-3xl mx-auto mb-8">
              <Search className="absolute left-4 top-4 text-gray-500" />
              <input 
                placeholder="Search movies..." 
                className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-red-600 outline-none text-lg"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex gap-2 justify-center mb-12 flex-wrap">
              {GENRES.map(g => (
                <button key={g} onClick={() => { setSearch(g); handleSearch(); }} className="px-4 py-2 rounded-full bg-gray-900 border border-gray-800 hover:border-red-600 hover:text-red-500 transition text-sm font-medium">
                  {g}
                </button>
              ))}
            </div>

            {search && (
                <div className="mb-12">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Search size={20}/> Search Results</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {movies.length > 0 ? movies.map(m => <MovieCard key={m.movieId} movie={m} onRate={rateMovie} />) : <p className="text-gray-500">No movies found.</p>}
                    </div>
                </div>
            )}

            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Sparkles className="text-yellow-500" /> Top Picks For You
              </h2>
              {recs.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                   {recs.map(m => <RecommendationCard key={m.movieId} movie={m} onRate={rateMovie} />)}
                </div>
              ) : (
                <div className="bg-gray-900 p-8 rounded-xl text-center border border-dashed border-gray-800">
                    <p className="text-gray-400">Not enough data yet. Search and rate more movies!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- SMART COMPONENTS ---

// 1. Interactive Star Rating (Fixes visual issue)
function StarRating({ onRate }: { onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  const [selected, setSelected] = useState(0);

  const handleClick = (star: number) => {
    setSelected(star);
    onRate(star);
  };

  return (
    <div className="flex gap-1 bg-black/40 p-1.5 rounded-lg justify-center backdrop-blur-sm" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => handleClick(star)}
          onMouseEnter={() => setHover(star)}
          className="transition-transform hover:scale-110"
        >
          <Star 
            size={16} 
            className={`${star <= (hover || selected) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`} 
          />
        </button>
      ))}
    </div>
  );
}

// 2. Poster Fetcher (Uses TMDB)
function MoviePoster({ title }: { title: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!TMDB_API_KEY) return;
    
    // Clean title (remove year, e.g. "Toy Story (1995)" -> "Toy Story")
    const cleanTitle = title.replace(/\(\d{4}\)/, "").trim();
    
    fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${cleanTitle}`)
      .then(res => res.json())
      .then(data => {
        if (data.results && data.results[0]?.poster_path) {
          setImgUrl(`https://image.tmdb.org/t/p/w500${data.results[0].poster_path}`);
        }
      })
      .catch(err => console.error("Poster err"));
  }, [title]);

  if (imgUrl) {
    return <img src={imgUrl} alt={title} className="w-full h-full object-cover rounded-lg" />;
  }

  // Fallback if no key or no image found
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-700 font-bold text-4xl select-none">
      {title[0]}
    </div>
  );
}

function MovieCard({ movie, onRate }: { movie: any, onRate: any }) {
  return (
    <div className="bg-gray-900 p-3 rounded-xl border border-gray-800 hover:border-gray-600 transition group">
      <div className="aspect-[2/3] w-full rounded-lg mb-3 overflow-hidden bg-gray-800">
        <MoviePoster title={movie.title} />
      </div>
      <h4 className="font-bold text-sm leading-tight h-10 overflow-hidden text-gray-200">{movie.title}</h4>
      <p className="text-xs text-gray-500 mb-3 truncate">{movie.genres}</p>
      <StarRating onRate={(r) => onRate(movie.movieId, r)} />
    </div>
  );
}

function RecommendationCard({ movie, onRate }: { movie: any, onRate: any }) {
  return (
    <div className="relative group bg-gray-900 p-3 rounded-xl border border-gray-800 hover:border-green-500/50 transition hover:-translate-y-1 shadow-xl">
      <div className="absolute top-2 right-2 z-10 bg-green-900/90 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded border border-green-700 backdrop-blur-sm shadow-lg">
        {movie.score > 2 ? "98%" : "85%"} MATCH
      </div>
      <div className="aspect-[2/3] w-full rounded-lg mb-3 overflow-hidden bg-gray-800 shadow-inner">
        <MoviePoster title={movie.title} />
      </div>
      <h3 className="font-bold text-sm leading-tight mb-1 truncate">{movie.title}</h3>
      <p className="text-xs text-gray-500 mb-3 truncate">{movie.genres}</p>
      <StarRating onRate={(r) => onRate(movie.movieId, r)} />
    </div>
  );
}