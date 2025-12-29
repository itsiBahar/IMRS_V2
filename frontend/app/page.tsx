"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation"; 
import { supabase } from "@/lib/supabaseClient";
import { Search, Star, Film, RefreshCw, Sparkles, Eye, Clock, User, ChevronDown, Zap, Coffee, Moon, Sun, Gem, ArrowRight, Check, Wifi, WifiOff } from "lucide-react";

const API_URL = "/api"; 
const TMDB_API_KEY = "1e2f039872a06c3b7e7bbb5c2d93888b"; 
const ALL_GENRES = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"];
const MOODS = [
    { name: "Chill & Relax", icon: <Coffee size={14}/>, query: "Comedy|Family" },
    { name: "Adrenaline", icon: <Zap size={14}/>, query: "Action|Thriller" },
    { name: "Dark & Mysterious", icon: <Moon size={14}/>, query: "Horror|Mystery|Crime" },
    { name: "Feel Good", icon: <Sun size={14}/>, query: "Romance|Animation|Music" }
];

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<"loading" | "onboarding_genres" | "onboarding_rates" | "home">("loading");
  
  // Data
  const [movies, setMovies] = useState<any[]>([]); 
  const [recs, setRecs] = useState<any[]>([]);
  const [gems, setGems] = useState<any[]>([]); 
  const [recSource, setRecSource] = useState<string>(""); 
  const [timeRecs, setTimeRecs] = useState<any>(null); 
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [ratedCount, setRatedCount] = useState(0); 
  const [searchQuery, setSearchQuery] = useState(""); 
  
  // UI States
  const [isConnected, setIsConnected] = useState(false); // ✅ Restored
  const [refreshing, setRefreshing] = useState(false);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [watchlist, setWatchlist] = useState<Set<number>>(new Set());
  const [userRatings, setUserRatings] = useState<Map<number, number>>(new Map());
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ PREVENT LOOP: Ref to track if we already loaded data
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    checkConnection();
    
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
          setSession(session);
          if (!dataLoadedRef.current) checkUserProgress(session.user.id);
      } else {
          setView("loading"); // Show Login
      }
    });

    // 2. Listen for auth changes (Login/Logout ONLY)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
          setSession(session);
          if (!dataLoadedRef.current) checkUserProgress(session.user.id);
      } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setView("loading");
          dataLoadedRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkConnection = async () => {
      try {
          const res = await fetch(`${API_URL}/`);
          setIsConnected(res.ok);
      } catch (e) { setIsConnected(false); }
  };

  const checkUserProgress = async (userId: string) => {
    try {
        const statsRes = await fetch(`${API_URL}/user_stats/${userId}`);
        if(statsRes.ok) {
            const stats = await statsRes.json();
            const count = stats.rated_count || 0;
            setRatedCount(count);
            
            // Logic: If rated > 5, go home. Else onboarding.
            if (count >= 5) {
                setView("home");
                loadHomeData(userId);
            } else {
                setView("onboarding_genres");
            }
            dataLoadedRef.current = true; // Mark as loaded
        }
    } catch(e) { console.error(e); }
  };

  const loadOnboardingMovies = async () => {
      if(!session) return;
      setRefreshing(true);
      // timestamp forces fresh data
      const res = await fetch(`${API_URL}/onboarding_movies/${session.user.id}?genres=${selectedGenres.join(",")}&t=${Date.now()}`);
      if(res.ok) setMovies(await res.json());
      setRefreshing(false);
  };

  const finishOnboarding = () => {
      setView("home");
      loadHomeData(session.user.id);
  };

  const loadHomeData = async (userId: string) => {
    setRefreshing(true);
    try {
      const popRes = await fetch(`${API_URL}/popular`);
      if(popRes.ok) setMovies(await popRes.json());

      const recRes = await fetch(`${API_URL}/recommendations/${userId}`);
      if(recRes.ok) {
          const recData = await recRes.json();
          if (recData.length > 0 && recData[0].reason) {
             setRecSource(recData[0].reason.replace("Because you liked ", "").replace("Because you watched ", ""));
          }
          setRecs(recData);
      }

      const gemsRes = await fetch(`${API_URL}/recommendations/hidden_gems/${userId}`);
      if(gemsRes.ok) setGems(await gemsRes.json());
      
      const timeRes = await fetch(`${API_URL}/recommendations/time_aware`);
      if(timeRes.ok) setTimeRecs(await timeRes.json());

    } catch (e) { console.error("Error loading home:", e); }
    setRefreshing(false);
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if(e) e.preventDefault();
    const q = overrideQuery || searchQuery;
    if(!q.trim()) { if(session) loadHomeData(session.user.id); return; }
    
    const res = await fetch(`${API_URL}/search?query=${q.split("|")[0]}`); 
    if(res.ok) {
        setMovies(await res.json());
        setRecs([]); setGems([]); setTimeRecs(null);
    }
  };

  const handleAction = async (movieId: number, action: 'rate' | 'watch' | 'later', value?: any) => {
    if (!session) return; 
    if (action === 'rate') {
          setUserRatings(prev => new Map(prev).set(movieId, value));
          await fetch(`${API_URL}/rate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: session.user.id, movie_id: movieId, rating: value }) });
          setRatedCount(prev => prev + 1);
          if(view === 'home') setMovies(prev => prev.filter(m => m.movieId !== movieId));
    } 
    if (action === 'watch') {
          setWatched(prev => new Set(prev).add(movieId));
          await fetch(`${API_URL}/watchlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: session.user.id, movie_id: movieId, status: 'watched' }) });
    }
    if (action === 'later') {
          setWatchlist(prev => new Set(prev).add(movieId));
          await fetch(`${API_URL}/watchlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: session.user.id, movie_id: movieId, status: 'plan_to_watch' }) });
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === "signup") {
      const { data } = await supabase.auth.signUp({ email, password });
      if (data.session) { setSession(data.session); setView("onboarding_genres"); }
    } else {
      const { data } = await supabase.auth.signInWithPassword({ email, password });
      if (data.session) { setSession(data.session); checkUserProgress(data.session.user.id); }
    }
  };

  const getTimeTitle = (context: string) => {
      if (context.includes("Late Night")) return "Late Night Vibes 🌙";
      if (context.includes("Weeknights")) return "Unwind After Work 🛋️";
      if (context.includes("Weekend")) return "Weekend Binge List 🍿";
      return "Curated For Now";
  };

  // --- LOGIN VIEW ---
  if (!session) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        {/* Connection Badge */}
       <div className={`fixed top-4 right-4 flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border ${isConnected ? "bg-green-900/30 border-green-800 text-green-400" : "bg-red-900/30 border-red-800 text-red-400"}`}>
          {isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>} {isConnected ? "System Online" : "System Offline"}
       </div>

       <div className="w-full max-w-md bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl">
           <h1 className="text-3xl font-bold text-center mb-6 text-red-600">MovieMind</h1>
           <form onSubmit={handleAuth} className="space-y-4">
             <input className="w-full bg-gray-800 p-3 rounded text-white border border-gray-700 outline-none focus:border-red-600 transition" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
             <input className="w-full bg-gray-800 p-3 rounded text-white border border-gray-700 outline-none focus:border-red-600 transition" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
             <button className="w-full bg-red-600 p-3 rounded font-bold hover:bg-red-700 transition cursor-pointer">{authMode === "login" ? "Sign In" : "Sign Up"}</button>
           </form>
           <button onClick={() => setAuthMode(authMode==="login"?"signup":"login")} className="w-full text-center mt-4 text-gray-400 text-sm hover:text-white cursor-pointer">
             {authMode==="login" ? "New? Create Account" : "Login"}
           </button>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-32">
      
      {/* SCREEN 1: GENRES */}
      {view === "onboarding_genres" && (
        <div className="max-w-4xl mx-auto p-10 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h1 className="text-4xl font-bold mb-4">Choose your vibe</h1>
            <p className="text-gray-500 mb-8">Select at least 1 genre to get started</p>
            <div className="flex flex-wrap gap-3 justify-center mb-10">
                {ALL_GENRES.map(g => (
                    <button key={g} onClick={() => selectedGenres.includes(g) ? setSelectedGenres(p=>p.filter(x=>x!==g)) : setSelectedGenres(p=>[...p,g])} className={`px-6 py-3 rounded-full border transition cursor-pointer ${selectedGenres.includes(g) ? "bg-red-600 border-red-600" : "border-gray-700 text-gray-400"}`}>{g}</button>
                ))}
            </div>
            <button onClick={async () => {
                    if(selectedGenres.length === 0) return alert("Select at least 1!");
                    await fetch(`${API_URL}/profile`, { method: "POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ user_id: session.user.id, genres: selectedGenres })});
                    loadOnboardingMovies();
                    setView("onboarding_rates");
            }} className="bg-white text-black px-12 py-3 rounded-lg font-bold text-lg hover:bg-gray-200 transition shadow-xl flex items-center gap-2 mx-auto cursor-pointer">
                Next <ArrowRight size={20}/>
            </button>
        </div>
      )}

      {/* SCREEN 2: RATING */}
      {view === "onboarding_rates" && (
        <div className="max-w-6xl mx-auto p-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold mb-2">Rate movies you've seen</h1>
                <div className="w-64 h-2 bg-gray-800 rounded-full mx-auto mt-4 overflow-hidden">
                    <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${Math.min((ratedCount / 5) * 100, 100)}%` }}></div>
                </div>
                <p className="text-sm text-gray-400 mt-2 font-mono">
                    {ratedCount >= 5 ? "Criteria met. You can finish or keep rating." : `${ratedCount} / 5 Rated`}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-24">
                {movies.map(m=><MovieCard key={m.movieId} movie={m} onAction={handleAction} router={router} userRating={userRatings.get(m.movieId)}/>)}
            </div>
            
            {/* ✅ FIXED BOTTOM BAR */}
            <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-gray-800 p-4 flex justify-center gap-4 z-50">
                {/* Shuffle */}
                <button onClick={loadOnboardingMovies} className="bg-gray-900 border border-gray-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition cursor-pointer flex items-center gap-2">
                    <RefreshCw size={18} className={refreshing ? "animate-spin" : ""}/> 
                    {refreshing ? "Loading..." : "Shuffle"}
                </button>

                {/* Finish */}
                {ratedCount >= 5 && (
                    <button onClick={finishOnboarding} className="bg-white text-black px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-gray-200 transition cursor-pointer flex items-center gap-2">
                        Finish & Start <Check size={20}/>
                    </button>
                )}
            </div>
        </div>
      )}

      {/* DASHBOARD (HOME) */}
      {view === "home" && (
        <>
           <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex justify-between items-center">
             <div className="flex items-center gap-6">
                 <h1 className="text-xl font-bold text-red-600 flex items-center gap-2 cursor-pointer" onClick={() => {setSearchQuery(""); loadHomeData(session.user.id);}}>
                    <Film/> MovieMind
                 </h1>
                 
                 {/* ✅ RESTORED CONNECTION INDICATOR */}
                 <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-red-500"}`} title={isConnected ? "Online" : "Offline"}></div>

                 <div className="relative group hidden md:block z-50">
                     <button className="flex items-center gap-1 text-gray-300 hover:text-white font-medium text-sm py-2 cursor-pointer">Browse <ChevronDown size={14}/></button>
                     <div className="absolute top-full left-0 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden hidden group-hover:block transition-all pt-2">
                         <div className="p-3 bg-gray-950/50">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Moods</p>
                            {MOODS.map(m => (
                                <button key={m.name} onClick={()=>{setSearchQuery(m.query); handleSearch(undefined, m.query);}} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800 text-gray-300 hover:text-white rounded-lg flex items-center gap-2 cursor-pointer">{m.icon} {m.name}</button>
                            ))}
                         </div>
                         <div className="p-3 border-t border-gray-800">
                             <p className="text-xs font-bold text-gray-500 uppercase mb-2">Genres</p>
                             <div className="grid grid-cols-2 gap-1">
                                {["Action", "Comedy", "Sci-Fi", "Horror", "Romance", "Drama"].map(g => (
                                    <button key={g} onClick={()=>{setSearchQuery(g); handleSearch(undefined, g);}} className="text-left px-2 py-1 text-xs hover:bg-gray-800 text-gray-400 hover:text-white rounded cursor-pointer">{g}</button>
                                ))}
                             </div>
                         </div>
                     </div>
                 </div>
                 <button onClick={() => router.push("/library")} className="text-sm font-medium text-gray-300 hover:text-white hidden md:block cursor-pointer">My Library</button>
             </div>
             <div className="flex items-center gap-4">
                 <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-2.5 text-gray-500" size={16}/>
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Search..." className="bg-gray-900 border border-gray-700 rounded-full py-2 pl-10 pr-4 text-sm focus:border-red-600 outline-none w-64 transition"/>
                 </div>
                 <button onClick={() => router.push("/profile")} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition cursor-pointer"><User size={16}/></button>
             </div>
           </nav>

           <div className="pt-24 max-w-7xl mx-auto p-6">
               {recs.length > 0 && (
                 <div className="mb-12">
                   <div className="flex items-center justify-between mb-6">
                       <h2 className="text-2xl font-bold flex items-center gap-2">
                           <Sparkles className="text-yellow-500"/> Top Picks For You
                           {recSource && <span className="text-sm font-normal text-gray-400 bg-gray-900 px-3 py-1 rounded-full ml-2 border border-gray-800">Because you liked <span className="text-white font-bold">{recSource}</span></span>}
                       </h2>
                       <button onClick={()=>loadHomeData(session.user.id)} className={`p-2 rounded-full hover:bg-gray-800 text-gray-400 transition cursor-pointer ${refreshing ? "animate-spin text-white" : ""}`} title="Refresh"><RefreshCw size={20}/></button>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-6">{recs.map(m => <MovieCard key={m.movieId} movie={m} onAction={handleAction} router={router} isWatched={watched.has(m.movieId)} isLater={watchlist.has(m.movieId)} userRating={userRatings.get(m.movieId)}/>)}</div>
                 </div>
               )}

                {gems.length > 0 && (
                 <div className="mb-12">
                   <h2 className="text-2xl font-bold flex items-center gap-2 mb-6 text-purple-400">
                       <Gem size={24}/> Hidden Gems For You
                       <span className="text-sm font-normal text-gray-400 bg-gray-900 px-3 py-1 rounded-full ml-2 border border-gray-800">Highly rated, less known</span>
                   </h2>
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-6">{gems.map(m => <MovieCard key={m.movieId} movie={m} onAction={handleAction} router={router} isWatched={watched.has(m.movieId)} isLater={watchlist.has(m.movieId)} userRating={userRatings.get(m.movieId)}/>)}</div>
                 </div>
               )}

                {timeRecs && timeRecs.movies && timeRecs.movies.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400"><Clock size={20}/> {getTimeTitle(timeRecs.context)}</h2>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">{timeRecs.movies.map((m: any) => <MovieCard key={m.movieId} movie={m} onAction={handleAction} router={router} isWatched={watched.has(m.movieId)} isLater={watchlist.has(m.movieId)} userRating={userRatings.get(m.movieId)}/>)}</div>
                    </div>
                )}

               <h2 className="text-xl font-bold mb-6 text-gray-400">{searchQuery ? `Results for "${searchQuery}"` : "Trending Now"}</h2>
               <div className="grid grid-cols-2 md:grid-cols-5 gap-6 opacity-80">
                   {movies.length > 0 ? movies.slice(0, 10).map(m => <MovieCard key={m.movieId} movie={m} onAction={handleAction} router={router} isWatched={watched.has(m.movieId)} isLater={watchlist.has(m.movieId)} userRating={userRatings.get(m.movieId)}/>) : <div className="text-gray-500 col-span-full text-center">No movies found.</div>}
               </div>
            </div>
        </>
      )}
    </div>
  );
}

function MovieCard({ movie, onAction, router, isWatched, isLater, userRating }: any) {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    if(!TMDB_API_KEY) return;
    const cleanTitle = movie.title.replace(/\(\d{4}\)/, "").trim();
    fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${cleanTitle}`).then(r=>r.json()).then(d => d.results?.[0]?.poster_path && setPoster(`https://image.tmdb.org/t/p/w500${d.results[0].poster_path}`)).catch(e => {});
  }, [movie.title]);

  return (
    <div onClick={() => router.push(`/movie/${movie.movieId}`)} className="cursor-pointer bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition group relative hover:-translate-y-1">
       <div className="aspect-[2/3] bg-gray-800 relative">
          {poster ? <img src={poster} className="w-full h-full object-cover" alt={movie.title}/> : <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-700">{movie.title[0]}</div>}
          <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col items-center justify-center gap-4 p-4 z-10">
             <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); onAction(movie.movieId, 'watch'); }} className={`p-3 rounded-full transition cursor-pointer ${isWatched ? "bg-green-600 text-white" : "bg-gray-700 text-white hover:bg-green-600"}`}><Eye size={20}/></button>
                <button onClick={(e) => { e.stopPropagation(); onAction(movie.movieId, 'later'); }} className={`p-3 rounded-full transition cursor-pointer ${isLater ? "bg-blue-600 text-white" : "bg-gray-700 text-white hover:bg-blue-600"}`}><Clock size={20}/></button>
             </div>
             <div className="flex gap-1 justify-center flex-wrap px-2">
                {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={(e) => { e.stopPropagation(); onAction(movie.movieId, 'rate', s); }} className={`transition hover:scale-125 cursor-pointer ${userRating >= s ? "text-yellow-400" : "text-gray-600 hover:text-yellow-400"}`}>
                        <Star size={18} fill={userRating >= s ? "currentColor" : "none"} />
                    </button>
                ))}
             </div>
          </div>
       </div>
       <div className="p-3"><h4 className="font-bold text-sm truncate">{movie.title}</h4><p className="text-xs text-gray-500 truncate">{movie.genres?.split("|")[0]}</p></div>
    </div>
  );
}