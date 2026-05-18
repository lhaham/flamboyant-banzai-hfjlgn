import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  MessageSquare,
  StickyNote,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  Users,
  Info,
  Send,
  Bot,
  User,
  Share2,
  Wand2,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  addDoc,
  updateDoc,
} from "firebase/firestore";

// --- Firebase Initialization Pattern ---
let app, auth, db, appId;
try {
  const firebaseConfig =
    typeof __firebase_config !== "undefined"
      ? JSON.parse(__firebase_config)
      : {};
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = typeof __app_id !== "undefined" ? __app_id : "rachel-plus-app";
} catch (e) {
  console.warn("Firebase initialization skipped for local dev/preview", e);
}

// --- Default Data ---
const INITIAL_ACTIVITIES = [
  {
    day: 0,
    time: "14:00",
    title: "אומנות/קומיקס",
    children: "כל הכיתה",
    type: "class",
  },
  {
    day: 0,
    time: "משתנה",
    title: "אנגלית",
    children: "גל, ארבל, נועם.ש, אדר",
    type: "group",
  },
  {
    day: 4,
    time: "משתנה",
    title: "חוג כדורגל",
    children: "הראל .כ, נועם.ש, דניל, גל",
    type: "group",
  },
  {
    day: 7,
    time: "החל מ-15:00",
    title: "שחרורים",
    children: "ניתן לשוחח עם רחלי",
    type: "info",
  },
];

const DAYS_OF_WEEK = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"];

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("planner");
  const [activities, setActivities] = useState([]);
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // State עבור העברת טקסט מפתק ישירות ל-AI
  const [aiQuery, setAiQuery] = useState(null);

  // --- Auth & Firebase Data Sync ---
  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== "undefined" &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const activitiesRef = collection(
      db,
      "artifacts",
      appId,
      "users",
      user.uid,
      "activities"
    );
    const notesRef = collection(
      db,
      "artifacts",
      appId,
      "users",
      user.uid,
      "notes"
    );

    setIsLoading(true);

    const unsubActivities = onSnapshot(activitiesRef, (snapshot) => {
      if (snapshot.empty && activities.length === 0) {
        INITIAL_ACTIVITIES.forEach(
          async (act) => await addDoc(activitiesRef, act)
        );
      } else {
        const acts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setActivities(acts);
      }
      setIsLoading(false);
    });

    const unsubNotes = onSnapshot(notesRef, (snapshot) => {
      const fetchedNotes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotes(fetchedNotes);
    });

    return () => {
      unsubActivities();
      unsubNotes();
    };
  }, [user]);

  useEffect(() => {
    if (!app) {
      setActivities(
        INITIAL_ACTIVITIES.map((a, i) => ({ id: i.toString(), ...a }))
      );
      setNotes([
        {
          id: "1",
          text: "ברוכה הבאה לרחל+! כאן תוכלי לרשום פתקים חשובים.",
          color: "bg-yellow-200",
        },
      ]);
      setIsLoading(false);
    }
  }, []);

  // --- Handlers ---
  const handleAddActivity = async (newActivity) => {
    if (user && db) {
      await addDoc(
        collection(db, "artifacts", appId, "users", user.uid, "activities"),
        newActivity
      );
    } else {
      setActivities([
        ...activities,
        { id: Date.now().toString(), ...newActivity },
      ]);
    }
  };

  const handleUpdateActivity = async (id, updatedData) => {
    if (user && db) {
      await updateDoc(
        doc(db, "artifacts", appId, "users", user.uid, "activities", id),
        updatedData
      );
    } else {
      setActivities(
        activities.map((a) => (a.id === id ? { ...a, ...updatedData } : a))
      );
    }
  };

  const handleDeleteActivity = async (id) => {
    if (user && db) {
      await deleteDoc(
        doc(db, "artifacts", appId, "users", user.uid, "activities", id)
      );
    } else {
      setActivities(activities.filter((a) => a.id !== id));
    }
  };

  const handleAddNote = async (note) => {
    if (user && db) {
      await addDoc(
        collection(db, "artifacts", appId, "users", user.uid, "notes"),
        note
      );
    } else {
      setNotes([...notes, { id: Date.now().toString(), ...note }]);
    }
  };

  const handleDeleteNote = async (id) => {
    if (user && db) {
      await deleteDoc(
        doc(db, "artifacts", appId, "users", user.uid, "notes", id)
      );
    } else {
      setNotes(notes.filter((n) => n.id !== id));
    }
  };

  // מעבר מהיר ל-AI עם שאילתה מהפתק
  const handleConsultAI = (text) => {
    setAiQuery(
      `בהקשר לפתק הזה: "${text}" - תן לי בבקשה עצה, רעיון או תזכורת רלוונטית.`
    );
    setActiveTab("ai");
  };

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col"
      dir="rtl"
    >
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              <span className="text-xl font-bold tracking-wider">
                רחל<span className="text-yellow-300">+</span>
              </span>
            </div>
            <span className="text-sm opacity-80 hidden sm:block font-medium">
              המערכת המושלמת שלך
            </span>
          </div>

          <nav className="flex gap-1 sm:gap-2">
            <NavButton
              icon={<Calendar size={20} />}
              label="תכנון שבועי"
              isActive={activeTab === "planner"}
              onClick={() => setActiveTab("planner")}
            />
            <NavButton
              icon={<StickyNote size={20} />}
              label="פתקים"
              isActive={activeTab === "notes"}
              onClick={() => setActiveTab("notes")}
            />
            <NavButton
              icon={<Wand2 size={20} />}
              label="ייעוץ AI"
              isActive={activeTab === "ai"}
              onClick={() => setActiveTab("ai")}
            />
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-indigo-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {activeTab === "planner" && (
              <PlannerView
                activities={activities}
                onAdd={handleAddActivity}
                onUpdate={handleUpdateActivity}
                onDelete={handleDeleteActivity}
              />
            )}
            {activeTab === "notes" && (
              <NotesView
                notes={notes}
                onAdd={handleAddNote}
                onDelete={handleDeleteNote}
                onConsultAI={handleConsultAI}
              />
            )}
            {activeTab === "ai" && (
              <AIView
                activities={activities}
                notes={notes}
                onAddActivity={handleAddActivity}
                aiQuery={aiQuery}
                setAiQuery={setAiQuery}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function NavButton({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium
        ${
          isActive
            ? "bg-white text-indigo-700 shadow-md transform scale-105"
            : "text-indigo-50 hover:bg-white/10"
        }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// --- PLANNER VIEW ---
function PlannerView({ activities, onAdd, onUpdate, onDelete }) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState("all");

  const generalInfos = activities.filter((a) => a.day === 7);
  const currentDayIndex = new Date().getDay();

  // פונקציית שיתוף הלו"ז היומי לוואטסאפ
  const shareDailySchedule = () => {
    const todayIndex = currentDayIndex === 6 ? 0 : currentDayIndex; // מגן משבת
    const todayName = DAYS_OF_WEEK[todayIndex];
    const todaysActs = activities
      .filter((a) => a.day === todayIndex)
      .sort((a, b) => a.time.localeCompare(b.time));

    if (todaysActs.length === 0) {
      alert("אין פעילויות מתוכננות להיום!");
      return;
    }

    let text = `*הלו"ז שלנו ליום ${todayName} בצהרון רחל+* 🌟\n\n`;
    todaysActs.forEach((a) => {
      text += `⏰ *${a.time}* | ${a.title}\n👥 עבור: ${a.children}\n\n`;
    });
    text += `המשך יום נפלא! ✨`;

    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      "_blank"
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {generalInfos.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
          <Info className="text-blue-500 mt-1 shrink-0" size={24} />
          <div>
            <h3 className="font-semibold text-blue-800">הודעות כלליות:</h3>
            {generalInfos.map((info) => (
              <div
                key={info.id}
                className="text-blue-900 mt-1 flex justify-between items-center group"
              >
                <span>
                  <span className="font-medium">{info.title}:</span>{" "}
                  {info.children} {info.time !== "משתנה" && `(${info.time})`}
                </span>
                <button
                  onClick={() => onDelete(info.id)}
                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <button
            onClick={() => setSelectedDayFilter("all")}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedDayFilter === "all"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            כל השבוע
          </button>
          {DAYS_OF_WEEK.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDayFilter(idx)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedDayFilter === idx
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {day}'
            </button>
          ))}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={shareDailySchedule}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors flex-1 md:flex-none justify-center font-medium"
          >
            <Share2 size={18} />
            <span className="hidden sm:inline">שתפי להורים</span>
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm transition-colors flex-1 md:flex-none justify-center font-medium"
          >
            <Plus size={18} />
            <span>הוספת פעילות</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <ActivityEditor
          onSave={(data) => {
            onAdd(data);
            setIsAdding(false);
          }}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {/* Days Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DAYS_OF_WEEK.map((dayName, idx) => {
          if (selectedDayFilter !== "all" && selectedDayFilter !== idx)
            return null;

          const isToday = currentDayIndex === idx;
          const dayActivities = activities
            .filter((a) => a.day === idx)
            .sort((a, b) => a.time.localeCompare(b.time));

          return (
            <div
              key={idx}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col h-full transition-all duration-300 ${
                isToday
                  ? "border-indigo-400 ring-2 ring-indigo-500/20 shadow-md"
                  : "border-slate-200"
              }`}
            >
              <div
                className={`py-3 px-4 flex justify-between items-center ${
                  isToday
                    ? "bg-indigo-50 border-b border-indigo-100"
                    : "bg-slate-50 border-b border-slate-200"
                }`}
              >
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  יום {dayName}
                  {isToday && (
                    <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-md font-extrabold animate-pulse">
                      היום!
                    </span>
                  )}
                </h2>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full">
                  {dayActivities.length} פעילויות
                </span>
              </div>

              <div className="p-4 flex-1 space-y-4">
                {dayActivities.length === 0 ? (
                  <div className="text-center text-slate-400 py-8 text-sm">
                    אין פעילויות מתוכננות ליום זה
                  </div>
                ) : (
                  dayActivities.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      onUpdate={(data) => onUpdate(activity.id, data)}
                      onDelete={() => onDelete(activity.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityCard({ activity, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <ActivityEditor
        activity={activity}
        onSave={(d) => {
          onUpdate(d);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="group relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="text-slate-400 hover:text-indigo-600 transition-colors p-1 bg-white rounded-md shadow-sm border border-slate-100"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={onDelete}
          className="text-slate-400 hover:text-red-600 transition-colors p-1 bg-white rounded-md shadow-sm border border-slate-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="pr-2">
        <h3 className="font-bold text-indigo-900 text-lg mb-1 pr-2 border-r-4 border-indigo-400">
          {activity.title}
        </h3>
        <div className="space-y-2 mt-3">
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <Clock size={16} className="mt-0.5 text-indigo-400" />
            <span>{activity.time}</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded-lg">
            <Users size={16} className="mt-0.5 text-emerald-500 shrink-0" />
            <span className="leading-tight">{activity.children}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityEditor({ activity, onSave, onCancel }) {
  const [title, setTitle] = useState(activity?.title || "");
  const [day, setDay] = useState(
    activity?.day !== undefined ? activity.day : 0
  );
  const [time, setTime] = useState(activity?.time || "");
  const [children, setChildren] = useState(activity?.children || "");

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title, day: Number(day), time: time || "משתנה", children });
  };

  return (
    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 shadow-inner mb-4 animate-in fade-in zoom-in-95">
      <div className="space-y-3">
        <input
          type="text"
          placeholder="שם הפעילות (למשל: כדורגל)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900"
        />
        <div className="flex gap-3">
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="flex-1 p-2 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {DAYS_OF_WEEK.map((d, i) => (
              <option key={i} value={i}>
                יום {d}'
              </option>
            ))}
            <option value={7}>הודעה כללית</option>
          </select>
          <input
            type="text"
            placeholder="שעה"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="flex-1 p-2 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <textarea
          placeholder="שמות הילדים (מופרדים בפסיק)..."
          value={children}
          onChange={(e) => setChildren(e.target.value)}
          className="w-full p-2 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
        />
        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2"
          >
            <Check size={18} /> שמירה
          </button>
        </div>
      </div>
    </div>
  );
}

// --- NOTES VIEW ---
function NotesView({ notes, onAdd, onDelete, onConsultAI }) {
  const [newNoteText, setNewNoteText] = useState("");
  const colors = [
    "bg-yellow-200",
    "bg-blue-200",
    "bg-green-200",
    "bg-pink-200",
    "bg-purple-200",
  ];
  const [selectedColor, setSelectedColor] = useState(colors[0]);

  const handleAdd = () => {
    if (!newNoteText.trim()) return;
    onAdd({
      text: newNoteText,
      color: selectedColor,
      date: new Date().toISOString(),
    });
    setNewNoteText("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <textarea
          placeholder="מה תרצי לזכור, רחלי?"
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          className={`w-full p-4 rounded-xl resize-none min-h-[100px] focus:outline-none ${selectedColor} bg-opacity-30 border-2 border-transparent focus:border-indigo-300 transition-colors font-medium`}
        />
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-8 h-8 rounded-full ${color} ${
                  selectedColor === color
                    ? "ring-2 ring-offset-2 ring-indigo-500"
                    : "hover:scale-110"
                } transition-all`}
              />
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={!newNoteText.trim()}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            הדבק פתק
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className={`${note.color} p-5 rounded-xl shadow-md transform rotate-1 hover:rotate-0 hover:scale-105 transition-all duration-200 relative group`}
          >
            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={() => onConsultAI(note.text)}
                title="התייעצי עם AI על הפתק"
                className="p-1.5 bg-white/60 rounded-full text-indigo-700 hover:bg-indigo-500 hover:text-white transition-colors"
              >
                <Wand2 size={14} />
              </button>
              <button
                onClick={() => onDelete(note.id)}
                title="מחק פתק"
                className="p-1.5 bg-white/60 rounded-full text-slate-700 hover:bg-red-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-slate-800 font-medium whitespace-pre-wrap">
              {note.text}
            </p>
            <div className="text-[10px] text-slate-500/70 mt-4 text-left">
              {note.date ? new Date(note.date).toLocaleDateString("he-IL") : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- AI VIEW (Gemini Context-Aware & Auto-Planner) ---
function AIView({ activities, notes, onAddActivity, aiQuery, setAiQuery }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "שלום רחלי! אני ה-AI שלך. אני יכול לייעץ לך, וגם לעדכן לך אוטומטית את הלו\"ז! פשוט תגידי לי 'תוסיף מחר חוג...' ואני אטפל בזה.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => scrollToBottom(), [messages, isTyping]);

  // זיהוי אוטומטי אם הגענו מהפתקים - מפעיל מיד את הבוט!
  useEffect(() => {
    if (aiQuery) {
      handleSend(aiQuery);
      setAiQuery(null);
    }
  }, [aiQuery]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
    }
  };

  const handleSend = async (overrideText = null) => {
    const userText = (overrideText || input).trim();
    if (!userText || isTyping) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setInput("");
    setIsTyping(true);

    try {
      const apiKey = "AIzaSyBJE0XUBaVreY8z0LSMXdvVUl3Gx3kM03Q";
      const modelName = "gemini-2.5-flash";

      const now = new Date();
      const currentDayIndex = now.getDay();
      const currentDay =
        DAYS_OF_WEEK[currentDayIndex === 6 ? 0 : currentDayIndex];
      const currentDate = now.toLocaleDateString("he-IL");

      // הזרקת מידע האפליקציה!
      const activitiesContext = activities
        .map(
          (a) =>
            `- יום ${DAYS_OF_WEEK[a.day] || "כללי"} בשעה ${a.time}: ${
              a.title
            } (עבור: ${a.children})`
        )
        .join("\n");
      const notesContext = notes.map((n) => `- ${n.text}`).join("\n");

      const systemPrompt = `את עוזרת אישית חכמה וסבלנית בשם 'רחל+ Bot' שעוזרת לרחלי, מנהלת צהרון.
תעני בעברית בלבד, בצורה מקצועית, חמה ומעודדת.

הקשר זמן עכשווי: היום יום ${currentDay}, התאריך ${currentDate}.
אם שואלים אותך על "מחר", חשבי איזה יום מגיע אחרי ${currentDay}.

הלו"ז המעודכן בצהרון כרגע:
${activitiesContext || "אין פעילויות."}

הפתקים שרחלי כתבה לעצמה:
${notesContext || "אין פתקים."}

!!! יכולת קסם - הוספת פעילויות ללו"ז !!!
אם רחלי מבקשת ממך להוסיף, לקבוע או לשבץ משהו בלו"ז (למשל: "תוסיף מחר חוג ציור ב-14:00 לכולם"), תעני לה בשמחה, ובנוסף, ממש בסוף התשובה שלך, תוסיפי את הפקודה הבאה בדיוק בפורמט הזה:
$$$ADD:day|time|title|children$$$
- day: חייב להיות מספר! 0 לראשון, 1 לשני, 2 לשלישי, 3 לרביעי, 4 לחמישי, 5 לשישי.
- time: שעה (למשל "14:00").
- title: שם הפעילות.
- children: למי מיועד (ברירת מחדל: "כולם").
לדוגמה: $$$ADD:2|15:00|חוג מדעים|כל הכיתה$$$
אל תסבירי ששמת את הפקודה, המערכת תזהה אותה.`;

      const maxHistory = 10;
      const history = messages.slice(-maxHistory).map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [
          {
            text: String(msg.text).replace(/[\u0000-\u001F\u007F-\u009F]/g, ""),
          },
        ],
      }));
      history.push({ role: "user", parts: [{ text: userText }] });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: history,
            systemInstruction: { parts: [{ text: systemPrompt }] },
          }),
        }
      );

      if (!response.ok) throw new Error(`Error: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      setMessages((prev) => [...prev, { role: "assistant", text: "" }]);

      let accumulatedText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const regex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        let match;
        let lastIndex = 0;
        let textParts = [];

        while ((match = regex.exec(buffer)) !== null) {
          try {
            textParts.push(JSON.parse(`"${match[1]}"`));
          } catch (e) {
            textParts.push(match[1]);
          }
          lastIndex = regex.lastIndex;
        }

        if (textParts.length > 0) {
          accumulatedText += textParts.join("");
          buffer = buffer.substring(lastIndex);

          // נסתיר את הקוד של הפקודה בזמן אמת מהמשתמש!
          const displaySafeText = accumulatedText.replace(
            /\$\$\$ADD:.*\$\$\$/g,
            ""
          );

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              text: displaySafeText,
            };
            return updated;
          });
        }
      }

      // --- עיבוד פקודות בסיום הכתיבה (Function Execution) ---
      const addRegex = /\$\$\$ADD:(\d+)\|([^|]+)\|([^|]+)\|([^$]+)\$\$\$/g;
      let commandMatch;
      while ((commandMatch = addRegex.exec(accumulatedText)) !== null) {
        const [fullMatch, dayStr, time, title, children] = commandMatch;
        const dayNum = parseInt(dayStr, 10);

        if (dayNum >= 0 && dayNum <= 6) {
          // קורא לפונקציה האמיתית של האפליקציה!
          onAddActivity({
            day: dayNum,
            time: time.trim(),
            title: title.trim(),
            children: children.trim(),
            type: "ai-generated",
          });
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "מצטערת רחלי, הייתה שגיאת תקשורת. נסי שוב!",
          },
        ]);
      }
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 h-[calc(100vh-120px)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
      <div className="bg-indigo-50 border-b border-indigo-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-full text-white">
            <Wand2 size={24} />
          </div>
          <div>
            <h2 className="font-bold text-indigo-900">רחל+ AI</h2>
            <p className="text-xs text-indigo-600">
              היועצת והמזכירה האישית שלך
            </p>
          </div>
        </div>

        {isTyping && (
          <button
            onClick={handleStopGeneration}
            className="flex items-center gap-1.5 text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
          >
            <X size={14} />
            <span>עצור כתיבה</span>
          </button>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 max-w-[85%] ${
              msg.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto"
            }`}
          >
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === "user"
                  ? "bg-indigo-200 text-indigo-700"
                  : "bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-sm"
              }`}
            >
              {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div
              className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm shadow-md"
                  : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm"
              }`}
            >
              {msg.text ||
                (idx === messages.length - 1 && isTyping
                  ? "מארגנת נתונים..."
                  : "")}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3 max-w-[85%] ml-auto">
            <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white">
              <Bot size={16} />
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-sm flex gap-1 items-center">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.4s" }}
              ></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="שאלי שאלה או בקשי ממני להוסיף משהו ללו״ז..."
            className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-0 rounded-xl p-3 resize-none h-14"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white p-3.5 rounded-xl transition-colors shadow-sm"
          >
            <Send size={20} className="transform rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
