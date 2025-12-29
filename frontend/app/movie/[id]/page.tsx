"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Star, Play, Clock, Calendar, User, MessageSquare, Send, AlertTriangle, RefreshCw } from "lucide-react";

// --- CONFIGURATION ---
const API_URL = "/api"; 
const TMDB_API_KEY = "1e2f039872a06c3b7e7bbb5c2d93888b";

// Initialize Supabase
const supabaseUrl = "https://zvopidktxwbicqkoxwhk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2b3BpZGt0eHdiaWNxa294d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTQ4MjgsImV4cCI6MjA4MjM5MDgyOH0.WSVHJoMwcUvCvs72zbwDejFJfMq-qwYz6zohy8xftZc";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MovieDetail() {
  const { id } = useParams();
  const router = useRouter();
  
  // Data States
  const [movie, setMovie] = useState<any>(null);
  const [tmdbData, setTmdbData] = useState<any>(null);
  const [similar, setSimilar] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState<"cast" | "reviews">("cast");
  const [newReview, setNewReview] = useState("");
  const [userRating, setUserRating] = useState(0);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
        // 1. Fetch from Backend
        const res = await fetch(`${API_URL}/movie/${id}`);
        if (!res.ok) throw new Error("Backend Error");
        
        const data = await res.json();
        setMovie(data);
        setSimilar(data.similar || []);
        
        // 2. Fetch TMDB Data
        if (data.title) fetchTmdbData(data.title);

        // 3. Fetch Reviews
        const reviewRes = await fetch(`${API_URL}/reviews/${id}`);
        if (reviewRes.ok) setReviews(await reviewRes.json());

    } catch (err: any) {
        console.error(err);
        setError("Failed to load movie. Backend might be offline.");
    } finally {
        setLoading(false);
    }
  };

  const fetchTmdbData = async (title: string) => {
    const cleanTitle = title.replace(/\(\d{4}\)/, "").trim();
    try {
        const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${cleanTitle}`);
        const searchData = await searchRes.json();
        
        if (searchData.results?.[0]) {
          const tmdbId = searchData.results[0].id;
          const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=videos,credits`);
          setTmdbData(await detailRes.json());
        }
    } catch (e) { console.error(e); }
  };

  const submitReview = async () => {
    if(!session) return alert("Please log in to review");
    if(userRating === 0) return alert("Please give a star rating");
    if(!newReview.trim()) return alert("Please write something");

    try {
        await fetch(`${API_URL}/review`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: session.user.id,
                movie_id: Number(id),
                rating: userRating,
                review_text: newReview
            })
        });
        setNewReview("");
        // Refresh reviews locally
        const reviewRes = await fetch(`${API_URL}/reviews/${id}`);
        setReviews(await reviewRes.json());
        alert("Review posted!");
    } catch (e) { alert("Failed to post review"); }
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex justify-center items-center"><div className="animate-spin h-10 w-10 border-4 border-red-600 rounded-full border-t-transparent"></div></div>;

  if (error || !movie) return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-6 text-center">
        <AlertTriangle size={64} className="text-red-500 mb-4"/>
        <h1 className="text-2xl font-bold mb-2">Error Loading Movie</h1>
        <button onClick={() => window.location.reload()} className="bg-white text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-gray-200"><RefreshCw size={18}/> Retry</button>
        <button onClick={() => router.back()} className="mt-4 text-gray-500 hover:text-white underline">Go Back Home</button>
    </div>
  );

  const trailer = tmdbData?.videos?.results?.find((v:any) => v.type === "Trailer")?.key;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* HERO */}
      <div className="relative h-[70vh] w-full">
         <div className="absolute inset-0">
           {tmdbData?.backdrop_path && <img src={`https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}`} className="w-full h-full object-cover opacity-40"/>}
           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
         </div>
         <div className="relative z-10 max-w-7xl mx-auto p-6 h-full flex flex-col justify-end pb-12">
            <button onClick={() => router.back()} className="absolute top-6 left-6 flex items-center gap-2 text-gray-300 hover:text-white transition"><ArrowLeft/> Back</button>
            <h1 className="text-5xl md:text-7xl font-bold mb-4">{movie.title}</h1>
            <div className="flex items-center gap-6 text-gray-300 text-sm mb-6">
               {tmdbData?.release_date && <span className="flex items-center gap-1"><Calendar size={16}/> {tmdbData.release_date.split("-")[0]}</span>}
               {tmdbData?.runtime && <span className="flex items-center gap-1"><Clock size={16}/> {tmdbData.runtime} min</span>}
               <span className="bg-gray-800 px-2 py-1 rounded text-xs border border-gray-700">{movie.genres.split("|")[0]}</span>
            </div>
            <p className="max-w-2xl text-lg text-gray-300 mb-8 leading-relaxed line-clamp-3">{tmdbData?.overview || "No plot available."}</p>
            {trailer && <a href={`https://www.youtube.com/watch?v=${trailer}`} target="_blank" className="w-fit bg-red-600 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-red-700 transition hover:scale-105 shadow-lg shadow-red-900/50"><Play fill="currentColor" size={16}/> Watch Trailer</a>}
         </div>
      </div>

      {/* DETAILS */}
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-12">
         <div className="col-span-2 space-y-10">
            {/* TABS */}
            <div className="flex gap-8 border-b border-gray-800">
                <button onClick={() => setActiveTab("cast")} className={`pb-4 text-lg font-bold transition ${activeTab==="cast" ? "text-white border-b-2 border-red-600" : "text-gray-500"}`}>Cast & Crew</button>
                <button onClick={() => setActiveTab("reviews")} className={`pb-4 text-lg font-bold transition ${activeTab==="reviews" ? "text-white border-b-2 border-red-600" : "text-gray-500"}`}>Reviews ({reviews.length})</button>
            </div>

            {/* CAST */}
            {activeTab === "cast" && (
                <div className="animate-in fade-in duration-300">
                   <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                      {tmdbData?.credits?.cast?.slice(0, 8).map((actor:any) => (
                         <div key={actor.id} className="min-w-[100px] text-center">
                            <img src={actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : "https://via.placeholder.com/100"} className="w-20 h-20 rounded-full object-cover mx-auto mb-2 border border-gray-700"/>
                            <p className="text-sm font-bold">{actor.name}</p>
                            <p className="text-xs text-gray-500 truncate">{actor.character}</p>
                         </div>
                      ))}
                   </div>
                </div>
            )}

            {/* REVIEWS */}
            {activeTab === "reviews" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><MessageSquare size={18}/> Write a Review</h3>
                        <div className="flex gap-2 mb-4">
                            {[1,2,3,4,5].map(s => (
                                <button key={s} onClick={()=>setUserRating(s)} className={`hover:scale-110 transition ${userRating >= s ? "text-yellow-400" : "text-gray-600"}`}>
                                    <Star size={24} fill={userRating >= s ? "currentColor" : "none"}/>
                                </button>
                            ))}
                        </div>
                        <textarea value={newReview} onChange={(e)=>setNewReview(e.target.value)} className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-red-600 outline-none mb-4" rows={3} placeholder="What did you think?"/>
                        <button onClick={submitReview} className="bg-white text-black px-6 py-2 rounded-full font-bold text-sm hover:bg-gray-200 flex items-center gap-2">Post Review <Send size={14}/></button>
                    </div>

                    <div className="space-y-4">
                        {reviews.length === 0 && <p className="text-gray-500 text-center">No reviews yet. Be the first!</p>}
                        {reviews.map((r, i) => (
                            <div key={i} className="border-b border-gray-800 pb-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"><User size={14}/></div><span className="font-bold text-sm text-gray-300">User</span></div>
                                    <div className="flex text-yellow-500 gap-1">{[...Array(5)].map((_, idx) => <Star key={idx} size={12} fill={idx < r.rating ? "currentColor" : "none"} className={idx >= r.rating ? "text-gray-700" : ""}/>)}</div>
                                </div>
                                <p className="text-gray-400 text-sm leading-relaxed">{r.review_text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SIMILAR MOVIES (Now with Posters!) */}
            <div className="pt-10 border-t border-gray-800">
               <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Star className="text-yellow-500" fill="currentColor"/> Similar Movies</h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {similar.map((m:any) => (
                     <SimilarCard key={m.movieId} movie={m} router={router} />
                  ))}
               </div>
            </div>
         </div>

         {/* RIGHT INFO */}
         <div className="hidden md:block">
            <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 sticky top-6">
                <h3 className="font-bold mb-4 text-gray-400">Movie Info</h3>
                <div className="space-y-4 text-sm">
                   <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500">Director</span><span>{tmdbData?.credits?.crew?.find((c:any) => c.job === "Director")?.name || "Unknown"}</span></div>
                   <div className="flex justify-between border-b border-gray-800 pb-2"><span className="text-gray-500">Budget</span><span>${tmdbData?.budget ? (tmdbData.budget / 1000000).toFixed(1) + "M" : "N/A"}</span></div>
                   <div className="flex justify-between pt-2"><span className="text-gray-500">Rating</span><span className="text-yellow-500 font-bold">{tmdbData?.vote_average?.toFixed(1)} / 10</span></div>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
}

// ✅ NEW COMPONENT: Handles fetching posters for "Similar Movies"
function SimilarCard({ movie, router }: any) {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    if(!TMDB_API_KEY) return;
    const cleanTitle = movie.title.replace(/\(\d{4}\)/, "").trim();
    fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${cleanTitle}`)
      .then(r=>r.json()).then(d => d.results?.[0]?.poster_path && setPoster(`https://image.tmdb.org/t/p/w500${d.results[0].poster_path}`))
      .catch(e => {});
  }, [movie.title]);

  return (
    <div onClick={() => router.push(`/movie/${movie.movieId}`)} className="cursor-pointer bg-gray-900 rounded-lg p-2 hover:bg-gray-800 transition hover:-translate-y-1 border border-gray-800">
        <div className="aspect-[2/3] bg-gray-800 rounded mb-2 overflow-hidden">
            {poster ? <img src={poster} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-gray-700">{movie.title[0]}</div>}
        </div>
        <p className="font-bold text-sm truncate">{movie.title}</p>
        <p className="text-xs text-gray-500">{movie.genres.split("|")[0]}</p>
    </div>
  );
}