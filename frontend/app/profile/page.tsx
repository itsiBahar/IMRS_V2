"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, User, Trash2, Activity, Film, LogOut, AlertTriangle, BadgeCheck, BarChart3 } from "lucide-react";

const API_URL = "/api";
const supabase = createClient("https://zvopidktxwbicqkoxwhk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2b3BpZGt0eHdiaWNxa294d2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTQ4MjgsImV4cCI6MjA4MjM5MDgyOH0.WSVHJoMwcUvCvs72zbwDejFJfMq-qwYz6zohy8xftZc");

export default function Profile() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [stats, setStats] = useState({ rated_count: 0, persona: "Loading..." });
  const [tasteProfile, setTasteProfile] = useState<any>({ top_genres: [] }); // ✅ NEW
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
          fetchStats(session.user.id);
          fetchTaste(session.user.id);
      }
    });
  }, []);

  const fetchStats = async (userId: string) => {
    const res = await fetch(`${API_URL}/user_stats/${userId}`);
    setStats(await res.json());
  };

  // ✅ Fetch Taste DNA
  const fetchTaste = async (userId: string) => {
    const res = await fetch(`${API_URL}/user_taste_profile/${userId}`);
    setTasteProfile(await res.json());
  };

  const handleReset = async () => {
    if(!confirm("Delete all history? This will wipe your Persona and Recommendations.")) return;
    setLoading(true);
    await fetch(`${API_URL}/user_data/${session.user.id}`, { method: "DELETE" });
    setLoading(false);
    alert("Profile Wiped. You are now a blank slate.");
    window.location.href = "/";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!session) return <div className="p-10 text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans p-6">
      <button onClick={() => router.back()} className="mb-8 flex items-center gap-2 text-gray-400 hover:text-white transition cursor-pointer"><ArrowLeft size={20}/> Back</button>
      
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-6 mb-10 bg-gradient-to-r from-gray-900 to-black p-6 rounded-2xl border border-gray-800">
            <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-700 shadow-xl">
                <User size={48} className="text-gray-400"/>
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1">{session.user.email.split("@")[0]}</h1>
                <div className="inline-flex items-center gap-2 bg-red-900/30 text-red-400 px-3 py-1 rounded-full text-sm font-bold border border-red-900/50">
                    <BadgeCheck size={14}/> {stats.persona || "Newcomer"}
                </div>
            </div>
        </div>

        {/* ✅ TASTE DNA VISUALIZATION */}
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 mb-10">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-xl"><BarChart3 size={20} className="text-blue-500"/> Your Taste DNA</h3>
            {tasteProfile.top_genres.length > 0 ? (
                <div className="space-y-4">
                    {tasteProfile.top_genres.map((g: any, i: number) => (
                        <div key={g.genre}>
                            <div className="flex justify-between text-sm mb-1 font-medium">
                                <span>{g.genre}</span>
                                <span className="text-gray-400">{g.score}%</span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2.5">
                                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${g.score}%`, opacity: 1 - (i * 0.15) }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 text-sm">Rate more movies to generate your DNA!</p>
            )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800"><div className="flex items-center gap-2 text-gray-400 mb-2"><Activity size={18}/> Movies Rated</div><div className="text-4xl font-bold">{stats.rated_count}</div></div>
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800"><div className="flex items-center gap-2 text-gray-400 mb-2"><Film size={18}/> Status</div><div className="text-xl font-bold text-green-500">Active</div></div>
        </div>

        <div className="border-t border-gray-800 pt-8">
            <h3 className="text-red-500 font-bold mb-4 flex items-center gap-2"><AlertTriangle size={18}/> Danger Zone</h3>
            <button onClick={handleReset} disabled={loading} className="w-full bg-red-900/20 border border-red-900 text-red-500 p-4 rounded-lg flex items-center justify-between hover:bg-red-900/40 transition mb-4 group cursor-pointer"><span>Reset Algorithm Data</span>{loading ? <span className="animate-pulse">Deleting...</span> : <Trash2 size={18}/>}</button>
            <button onClick={handleLogout} className="w-full bg-gray-900 border border-gray-800 text-gray-300 p-4 rounded-lg flex items-center justify-between hover:bg-gray-800 transition cursor-pointer"><span>Sign Out</span><LogOut size={18}/></button>
        </div>
      </div>
    </div>
  );
}