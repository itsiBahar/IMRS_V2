"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Star, Film, LogOut, Mail, Lock, UserPlus, ArrowRight } from "lucide-react";

// USE YOUR LOCAL CODESPACE URL HERE (Port 8000)
const API_URL = "https://literate-space-waddle-8000.app.github.dev"; 

export default function Home() {
  const [session, setSession] = useState<any>(null);
  
  // App States
  const [view, setView] = useState<"home" | "onboarding">("home");
  const [movies, setMovies] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  
  // Auth States
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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

  // Check if user is new or has history
  const checkUserStatus = async (userId: string) => {
    const res = await fetch(`${API_URL}/recommendations/${userId}`);
    const data = await res.json();
    
    if (data.length === 0) {
      setView("onboarding");
      loadPopularMovies();
    } else {
      setView("home");
      setRecs(data);
    }
  };

  const loadPopularMovies = async () => {
    const res = await fetch(`${API_URL}/popular`);
    const data = await res.json();
    setMovies(data); // Re-using movies state for onboarding list
  };

  // --- AUTH HANDLERS ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let error;

    if (authMode === "signup") {
      const res = await supabase.auth.signUp({ email, password });
      error = res.error;
      if (!error) alert("Check your email to confirm signup!");
    } else if (authMode === "login") {
      const res = await supabase.auth.signInWithPassword({ email, password });
      error = res.error;
    } else if (authMode === "forgot") {
      const res = await supabase.auth.resetPasswordForEmail(email);
      error = res.error;
      if (!error) alert("Password reset link sent to email.");
    }

    if (error) alert(error.message);
    setLoading(false);
  };

  // --- APP HANDLERS ---
  const handleSearch = async () => {
    if(!search) return;
    const res = await fetch(`${API_URL}/search?query=${search}`);
    const data = await res.json();
    setMovies(data);
  };

  const rateMovie = async (movieId: number, rating: number) => {
    if (!session) return;
    
    // Optimistic UI: Remove from list if in onboarding
    if(view === "onboarding") {
      setMovies(movies.filter(m => m.movieId !== movieId));
    }

    await fetch(`${API_URL}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: session.user.id, movie_id: movieId, rating }),
    });

    // If in onboarding, count ratings or refresh recs
    if (view === "home") checkUserStatus(session.user.id);
  };

  const finishOnboarding = () => checkUserStatus(session.user.id);

  // --- RENDER: AUTH SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-gray-950 to-black text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900/80 backdrop-blur-md p-8 rounded-2xl border border-gray-800 shadow-2xl">
          <div className="flex justify-center mb-6">
            <Film size={48} className="text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">MovieMind AI</h1>
          <p className="text-center text-gray-400 mb-8 text-sm">
            {authMode === "login" ? "Welcome back, cinephile." : authMode === "signup" ? "Create your AI profile." : "Reset your password."}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-500" size={18} />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 focus:border-red-500 outline-none" required />
            </div>
            
            {authMode !== "forgot" && (
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 focus:border-red-500 outline-none" required />
              </div>
            )}

            <button disabled={loading} className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-bold transition flex justify-center">
              {loading ? "Processing..." : authMode === "login" ? "Sign In" : authMode === "signup" ? "Sign Up" : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-6 flex justify-between text-sm text-gray-400">
            {authMode === "login" ? (
              <>
                <button onClick={() => setAuthMode("signup")} className="hover:text-white">Create Account</button>
                <button onClick={() => setAuthMode("forgot")} className="hover:text-white">Forgot Password?</button>
              </>
            ) : (
              <button onClick={() => setAuthMode("login")} className="hover:text-white w-full text-center">Back to Login</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN APP ---
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-red-900">
      {/* Navbar */}
      <nav className="border-b border-gray-900 bg-black/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Film className="text-red-600" />
          <span className="font-bold text-xl tracking-tight">MovieMind</span>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="bg-gray-900 hover:bg-gray-800 p-2 rounded-full transition">
          <LogOut size={18} />
        </button>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        
        {/* VIEW: ONBOARDING */}
        {view === "onboarding" && (
          <div className="text-center py-10">
            <h2 className="text-3xl font-bold mb-2">Let's get to know you.</h2>
            <p className="text-gray-400 mb-8">Rate at least 3 movies so we can build your AI model.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
              {movies.map(m => (
                 <MovieCard key={m.movieId} movie={m} onRate={rateMovie} />
              ))}
            </div>
            <button onClick={finishOnboarding} className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition flex items-center gap-2 mx-auto">
              Get Recommendations <ArrowRight size={18}/>
            </button>
          </div>
        )}

        {/* VIEW: HOME DASHBOARD */}
        {view === "home" && (
          <>
            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto mb-12">
              <Search className="absolute left-4 top-4 text-gray-500" />
              <input 
                placeholder="Search for movies..." 
                className="w-full bg-gray-900 border border-gray-800 rounded-full py-4 pl-12 pr-4 focus:ring-2 focus:ring-red-900 outline-none transition"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>

            {/* Search Results */}
            {search && movies.length > 0 && (
              <section className="mb-12">
                <h3 className="text-gray-400 font-bold mb-4 uppercase text-sm tracking-wider">Search Results</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {movies.map(m => <MovieCard key={m.movieId} movie={m} onRate={rateMovie} />)}
                </div>
              </section>
            )}

            {/* Recommendations */}
            <section>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                Top Picks for You <span className="text-xs bg-green-900 text-green-400 px-2 py-0.5 rounded border border-green-800">AI Generated</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                 {recs.map((m, i) => (
                   <div key={m.movieId} className="group relative bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-red-800 transition shadow-lg">
                     {/* Pseudo Poster Placeholder */}
                     <div className="h-48 bg-gray-800 flex items-center justify-center text-gray-700 font-bold text-4xl select-none group-hover:bg-gray-700 transition">
                       {m.title[0]}
                     </div>
                     <div className="p-4">
                       <h3 className="font-bold text-sm truncate">{m.title}</h3>
                       <p className="text-xs text-gray-500 mb-2 truncate">{m.genres}</p>
                       <div className="flex justify-between items-center">
                         <span className="text-xs font-mono text-green-400">{m.score > 5 ? "98%" : "85%"} Match</span>
                         <div className="flex gap-0.5">
                           {[1,2,3,4,5].map(s => (
                             <button key={s} onClick={() => rateMovie(m.movieId, s)} className="text-gray-600 hover:text-yellow-500 text-xs">★</button>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// Sub-component for Cleaner Code
function MovieCard({ movie, onRate }: { movie: any, onRate: any }) {
  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 hover:scale-105 transition duration-300">
      <h4 className="font-bold text-sm h-10 overflow-hidden text-gray-200">{movie.title}</h4>
      <p className="text-xs text-gray-500 mb-3 truncate">{movie.genres}</p>
      <div className="flex justify-center gap-1 bg-black/30 p-1.5 rounded-lg">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} onClick={() => onRate(movie.movieId, star)} className="text-gray-600 hover:text-yellow-500 transition hover:scale-125">
            <Star size={14} fill="currentColor" />
          </button>
        ))}
      </div>
    </div>
  );
}