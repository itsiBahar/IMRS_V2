"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Star, Film, LogOut, Activity, RefreshCw, Eye, Clock, Check, ArrowRight } from "lucide-react";

// 1. YOUR BACKEND URL (From Ports Tab)
const API_URL = "https://ubiquitous-halibut-pp6v7vjg6gq36pr5-8000.app.github.dev"; 

// 2. YOUR TMDB API KEY (Get from themoviedb.org -> Settings -> API)
// If you leave this blank, it will show colored boxes instead of posters.
const TMDB_API_KEY = "1e2f039872a06c3b7e7bbb5c2d93888b"; 

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<"onboarding" | "home">("home");
  const [movies, setMovies] = useState<any[]>([]); 
  const [recs, setRecs] = useState<any[]>([]);     
  const [watchlist, setWatchlist] = useState<Set<number>>(new Set());
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [ratedCount, setRatedCount] = useState(0); 
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) refreshUserData(session.user.id);
    });
  }, []);

  const refreshUserData = async (userId: string) => {
    // 1. Get Real Rated Count from Server
    const statsRes = await fetch(`${API_URL}/user_stats/${userId}`);
    const stats = await statsRes.json();
    setRatedCount(stats.rated_count || 0);

    // 2. Get Watchlist
    // (In a real app we would fetch the list and populate the sets)
    
    // 3. Decide View
    if (stats.rated_count < 3) {
        setView("onboarding");
        shuffleMovies();
    } else {
        setView("home");
        const recRes = await fetch(`${API_URL}/recommendations/${userId}`);
        const recData = await recRes.json();
        setRecs(recData);
        shuffleMovies();
    }
  };

  const shuffleMovies = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/popular`);
    const data = await res.json();
    setMovies(data);
    setLoading(false);
  };

  const handleAction = async (movieId: number, action: 'rate' | 'watch' | 'later', value?: any) => {
    if (!session) return;

    if (action === 'rate') {
        await fetch(`${API_URL}/rate`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: session.user.id, movie_id: movieId, rating: value })
        });
        setRatedCount(prev => prev + 1);
        if(view === "onboarding") setMovies(prev => prev.filter(m => m.movieId !== movieId));
    } 
    
    if (action === 'watch') {
        await fetch(`${API_URL}/watchlist`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: session.user.id, movie_id: movieId, status: 'watched' })
        });
        setWatched(prev => new Set(prev).add(movieId));
    }

    if (action === 'later') {
        await fetch(`${API_URL}/watchlist`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: session.user.id, movie_id: movieId, status: 'plan_to_watch' })
        });
        setWatchlist(prev => new Set(prev).add(movieId));
    }
  };

  const finishOnboarding = () => {
     if (ratedCount < 3) return alert("Rate 3 movies first!");
     refreshUserData(session.user.id);
  };

  const handleSearch = async () => {
    if(!search) return;
    const res = await fetch(`${API_URL}/search?query=${search}`);
    setMovies(await res.json());
  };

  // --- RENDER ---
  if (!session) return <LoginScreen onLogin={() => window.location.reload()} />;

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-20">
      <nav className="p-6 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-black/80 z-50 backdrop-blur-md">
        <h1 className="text-xl font-bold flex items-center gap-2 text-red-600"><Film/> MovieMind</h1>
        <div className="flex gap-4 items-center">
            <span className="text-sm text-gray-400">Ratings: {ratedCount}</span>
            <button onClick={() => supabase.auth.signOut()}><LogOut size={18}/></button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        
        {view === "onboarding" && (
          <div className="text-center py-8">
             <h1 className="text-4xl font-bold mb-2">Build Your Profile</h1>
             <p className="text-gray-400 mb-8">Rate 3 movies you know.</p>
             
             {/* PROGRESS BAR */}
             <div className="w-64 h-2 bg-gray-800 rounded-full mx-auto mb-8 overflow-hidden">
                <div className="h-full bg-red-600 transition-all duration-500" style={{width: `${Math.min((ratedCount/3)*100, 100)}%`}}></div>
             </div>

             <div className="flex justify-end mb-4">
                <button onClick={shuffleMovies} className="flex items-center gap-2 text-sm text-blue-400 hover:text-white">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Shuffle Movies
                </button>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {movies.map(m => (
                    <MovieCard key={m.movieId} movie={m} 
                        onAction={handleAction} 
                        isWatched={watched.has(m.movieId)}
                        isLater={watchlist.has(m.movieId)}
                    />
                ))}
             </div>

             <button onClick={finishOnboarding} disabled={ratedCount < 3} className={`fixed bottom-8 right-8 px-8 py-4 rounded-full font-bold flex items-center gap-2 shadow-xl ${ratedCount>=3 ? "bg-white text-black" : "bg-gray-800 text-gray-500"}`}>
                {ratedCount >= 3 ? "Complete Setup" : `Rate ${Math.max(0, 3-ratedCount)} more`} <ArrowRight/>
             </button>
          </div>
        )}

        {view === "home" && (
           <div className="space-y-12">
              {/* SEARCH */}
              <div className="relative max-w-2xl mx-auto">
                 <Search className="absolute left-4 top-4 text-gray-500"/>
                 <input className="w-full bg-gray-900 border border-gray-800 p-4 pl-12 rounded-full focus:ring-2 focus:ring-red-600 outline-none" 
                    placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleSearch()}/>
              </div>

              {/* RESULTS / SHUFFLE */}
              <div>
                 <div className="flex justify-between items-end mb-4">
                    <h2 className="text-xl font-bold flex gap-2"><Activity className="text-blue-500"/> {search ? "Results" : "Discover"}</h2>
                    {!search && <button onClick={shuffleMovies} className="text-sm text-gray-400 hover:text-white flex gap-1 items-center"><RefreshCw size={14}/> Refresh</button>}
                 </div>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {movies.map(m => <MovieCard key={m.movieId} movie={m} onAction={handleAction} isWatched={watched.has(m.movieId)} isLater={watchlist.has(m.movieId)}/>)}
                 </div>
              </div>

              {/* RECOMMENDATIONS */}
              {recs.length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold mb-4 flex gap-2"><Star className="text-yellow-500"/> Recommended</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {recs.map(m => <MovieCard key={m.movieId} movie={m} onAction={handleAction} isWatched={watched.has(m.movieId)} isLater={watchlist.has(m.movieId)}/>)}
                    </div>
                  </div>
              )}
           </div>
        )}
      </main>
    </div>
  );
}

// --- SUB COMPONENTS ---

function LoginScreen({onLogin}: {onLogin: ()=>void}) {
    // (Reuse the previous simple login UI here)
    return <div className="text-center p-10 text-white">Please Login</div>
}

function MovieCard({ movie, onAction, isWatched, isLater }: any) {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    if(!TMDB_API_KEY) return;
    const cleanTitle = movie.title.replace(/\(\d{4}\)/, "").trim();
    fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${cleanTitle}`)
      .then(r=>r.json()).then(d => d.results?.[0]?.poster_path && setPoster(`https://image.tmdb.org/t/p/w500${d.results[0].poster_path}`));
  }, [movie.title]);

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition group relative">
       <div className="aspect-[2/3] bg-gray-800 relative">
          {poster ? <img src={poster} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-700">{movie.title[0]}</div>}
          
          {/* OVERLAY ACTIONS */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
             <div className="flex gap-2">
                <button onClick={()=>onAction(movie.movieId, 'watch')} className={`p-2 rounded-full ${isWatched?'bg-green-600':'bg-gray-700 hover:bg-green-600'}`} title="Watched"><Eye size={16}/></button>
                <button onClick={()=>onAction(movie.movieId, 'later')} className={`p-2 rounded-full ${isLater?'bg-blue-600':'bg-gray-700 hover:bg-blue-600'}`} title="Watch Later"><Clock size={16}/></button>
             </div>
             <div className="flex gap-1">
                {[1,2,3,4,5].map(s => <button key={s} onClick={()=>onAction(movie.movieId, 'rate', s)} className="text-white hover:text-yellow-400 hover:scale-125 transition"><Star size={18}/></button>)}
             </div>
          </div>
       </div>
       <div className="p-3">
          <h4 className="font-bold text-sm truncate">{movie.title}</h4>
          <p className="text-xs text-gray-500 truncate">{movie.genres}</p>
       </div>
    </div>
  );
}