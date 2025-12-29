"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Clock, Eye, Star, Trash2, Film, AlertCircle } from "lucide-react";

// ✅ CONFIG
const API_URL = "/api";
const TMDB_API_KEY = "1e2f039872a06c3b7e7bbb5c2d93888b";

// Supabase Init
const supabaseUrl = "https://zvopidktxwbicqkoxwhk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2b3BpZGt0eHdiaWNxa294d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTQ4MjgsImV4cCI6MjA4MjM5MDgyOH0.WSVHJoMwcUvCvs72zbwDejFJfMq-qwYz6zohy8xftZc";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Library() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"watchlist" | "watched" | "rated">("watchlist");
  const [movies, setMovies] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) fetchLibrary(session.user.id, activeTab);
    });
  }, [activeTab]);

  const fetchLibrary = async (userId: string, tab: string) => {
    setLoading(true);
    let data = [];
    
    // ✅ FIX: Use .from() instead of .table()
    if (tab === "rated") {
        const { data: rated } = await supabase.from("ratings").select("movie_id, rating").eq("user_id", userId);
        data = rated || [];
    } else {
        const status = tab === "watchlist" ? "plan_to_watch" : "watched";
        const { data: list } = await supabase.from("watchlist").select("movie_id").eq("user_id", userId).eq("status", status);
        data = list || [];
    }

    // Fetch details for each movie
    const fullMovies = await Promise.all(data.map(async (item: any) => {
        const res = await fetch(`${API_URL}/movie/${item.movie_id}`);
        const movie = await res.json();
        return { ...movie, user_rating: item.rating }; // Attach rating if exists
    }));
    
    setMovies(fullMovies);
    setLoading(false);
  };

  const removeItem = async (movieId: number) => {
    if(!confirm("Remove from library?")) return;
    
    // ✅ FIX: Use .from() instead of .table()
    if (activeTab === "rated") {
        await supabase.from("ratings").delete().eq("user_id", session.user.id).eq("movie_id", movieId);
    } else {
        await supabase.from("watchlist").delete().eq("user_id", session.user.id).eq("movie_id", movieId);
    }
    // Remove from UI instantly
    setMovies(prev => prev.filter(m => m.movieId !== movieId));
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition cursor-pointer">
            <ArrowLeft size={20}/> Back Home
        </button>

        <h1 className="text-3xl font-bold mb-8 flex items-center gap-2"><Film className="text-red-600"/> My Library</h1>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-800 mb-8">
            <button onClick={() => setActiveTab("watchlist")} className={`pb-3 px-4 font-bold flex items-center gap-2 transition cursor-pointer ${activeTab==="watchlist" ? "text-red-500 border-b-2 border-red-500" : "text-gray-500 hover:text-white"}`}>
                <Clock size={18}/> Watchlist
            </button>
            <button onClick={() => setActiveTab("watched")} className={`pb-3 px-4 font-bold flex items-center gap-2 transition cursor-pointer ${activeTab==="watched" ? "text-green-500 border-b-2 border-green-500" : "text-gray-500 hover:text-white"}`}>
                <Eye size={18}/> History
            </button>
            <button onClick={() => setActiveTab("rated")} className={`pb-3 px-4 font-bold flex items-center gap-2 transition cursor-pointer ${activeTab==="rated" ? "text-yellow-500 border-b-2 border-yellow-500" : "text-gray-500 hover:text-white"}`}>
                <Star size={18}/> Rated
            </button>
        </div>

        {/* Content */}
        {loading ? <div className="text-gray-500 animate-pulse">Loading library...</div> : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {movies.length === 0 && (
                    <div className="col-span-full text-center text-gray-500 py-20">
                        <AlertCircle className="mx-auto mb-4" size={40}/>
                        <p>No movies found in this list.</p>
                    </div>
                )}
                {movies.map(m => (
                    <LibraryCard key={m.movieId} movie={m} onRemove={removeItem} router={router} showRating={activeTab === "rated"} />
                ))}
            </div>
        )}
    </div>
  );
}

function LibraryCard({ movie, onRemove, router, showRating }: any) {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    if(!TMDB_API_KEY) return;
    const cleanTitle = movie.title.replace(/\(\d{4}\)/, "").trim();
    fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${cleanTitle}`)
      .then(r=>r.json()).then(d => d.results?.[0]?.poster_path && setPoster(`https://image.tmdb.org/t/p/w500${d.results[0].poster_path}`))
      .catch(e => {});
  }, [movie.title]);

  return (
    <div onClick={() => router.push(`/movie/${movie.movieId}`)} className="cursor-pointer bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition group relative hover:-translate-y-1">
        <div className="aspect-[2/3] bg-gray-800 relative">
             {/* ✅ REMOVE BUTTON */}
             <button onClick={(e) => { e.stopPropagation(); onRemove(movie.movieId); }} className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white p-2 rounded-full z-20 transition opacity-0 group-hover:opacity-100 cursor-pointer">
                <Trash2 size={16}/>
             </button>

             {/* RATING BADGE */}
             {showRating && (
                <div className="absolute top-2 left-2 bg-yellow-500/90 text-black text-xs font-bold px-2 py-1 rounded-md z-20 flex items-center gap-1">
                    {movie.user_rating} <Star size={10} fill="black"/>
                </div>
             )}

             {poster ? <img src={poster} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-gray-700">{movie.title[0]}</div>}
        </div>
        <div className="p-3">
            <h4 className="font-bold text-sm truncate">{movie.title}</h4>
            <p className="text-xs text-gray-500">{movie.genres.split("|")[0]}</p>
        </div>
    </div>
  );
}