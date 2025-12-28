import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  BookOpen, 
  BrainCircuit, 
  GraduationCap, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles,
  Search,
  History,
  Info,
  Layers,
  Network,
  Share2,
  Workflow,
  Lock,
  CreditCard,
  Smartphone,
  ShieldCheck,
  Zap,
  Check,
  Calendar,
  BarChart3,
  Clock,
  User,
  LogOut,
  Star,
  Trophy,
  ArrowRight,
  Banknote,
  FileText,
  PenTool,
  ClipboardList,
  Moon,
  Sun
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
interface Subtopic { id: string; title: string; description: string; }
interface Chapter { id: string; form: 4 | 5; number: number; title: string; subtopics: Subtopic[]; isFree?: boolean; }
interface Flashcard { id: string; question: string; answer: string; subtopicId: string; }
interface CardProgress { cardId: string; easeFactor: number; interval: number; nextReview: number; lastReview: number; repetitions: number; }
interface MindMapData { title: string; description: string; branches: { branchTitle: string; details: string[]; }[]; }

interface EssayGuideData {
  topic: string;
  sampleQuestion: string;
  framework: {
    part: string;
    content: string;
    technique: 'Fakta' | 'Huraian' | 'Contoh' | 'Inferens';
  }[];
  modelAnswer: string;
  keyVocabulary: string[];
}

// --- Textbook Data ---
const ALL_CHAPTERS: Chapter[] = [
  { id: 'f4-1', form: 4, number: 1, title: 'Warisan Negara Bangsa', isFree: true, subtopics: [
    { id: '1.1', title: 'Latar Belakang Negara Bangsa Sebelum Kedatangan Barat', description: 'Ciri-ciri negara bangsa Kerajaan Alam Melayu.' },
    { id: '1.2', title: 'Ciri-ciri Negara Bangsa Kesultanan Melayu Melaka', description: 'Wilayah pengaruh, kedaulatan, rakyat dan undang-undang.' },
  ]},
  { id: 'f4-2', form: 4, number: 2, title: 'Kebangkitan Nasionalisme', subtopics: [
    { id: '2.1', title: 'Maksud Nasionalisme', description: 'Pendapat tokoh dan perkembangan idea nasionalisme.' },
    { id: '2.2', title: 'Perkembangan Idea Nasionalisme di Barat', description: 'Revolusi Keagungan, Amerika & Perancis.' },
  ]},
  { id: 'f5-1', form: 5, number: 1, title: 'Kedaulatan Negara', isFree: true, subtopics: [
    { id: '1.1', title: 'Konsep Kedaulatan', description: 'Takrif dan jenis-jenis kedaulatan.' },
  ]},
];

// --- AI Service ---
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const generateEssayGuide = async (topic: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Hasilkan panduan menulis esei sejarah SPM untuk topik: ${topic}. 
    Berikan satu soalan esei (Paper 2), rangka jawapan menggunakan teknik FHCI (Fakta, Huraian, Contoh, Inferens), contoh jawapan lengkap yang cemerlang, dan senarai glosari kata kunci sejarah. 
    Format JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          sampleQuestion: { type: Type.STRING },
          framework: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                part: { type: Type.STRING },
                content: { type: Type.STRING },
                technique: { type: Type.STRING, enum: ['Fakta', 'Huraian', 'Contoh', 'Inferens'] }
              }
            }
          },
          modelAnswer: { type: Type.STRING },
          keyVocabulary: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["topic", "sampleQuestion", "framework", "modelAnswer", "keyVocabulary"]
      }
    }
  });
  return JSON.parse(response.text || '{}') as EssayGuideData;
};

const generateFlashcards = async (chapter: string, subtopicTitle: string, subtopicId: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Hasilkan 5 kad imbasan (flashcards) untuk subtopik sejarah: ${subtopicTitle} dalam ${chapter}. Format JSON array of objects dengan kunci "question" and "answer". Jawab dalam Bahasa Melayu.`,
    config: { responseMimeType: "application/json" }
  });
  const data = JSON.parse(response.text || '[]');
  return data.map((item: any, idx: number) => ({ ...item, id: `card-${subtopicId}-${idx}-${Date.now()}`, subtopicId })) as Flashcard[];
};

const generateMindMap = async (topic: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Hasilkan peta minda (mind map) dalam format JSON untuk topik sejarah: ${topic}. Jawab dalam Bahasa Melayu.`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || '{}') as MindMapData;
};

// --- SRS Logic ---
const calculateNextReview = (rating: number, currentProgress?: CardProgress): CardProgress => {
  let { interval, easeFactor, repetitions } = currentProgress || { interval: 0, easeFactor: 2.5, repetitions: 0 };
  if (rating >= 3) {
    if (repetitions === 0) interval = 1; else if (repetitions === 1) interval = 4; else interval = Math.round(interval * easeFactor);
    repetitions++;
  } else { repetitions = 0; interval = 1; }
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (4 - rating) * (0.08 + (4 - rating) * 0.02)));
  const now = Date.now();
  return { cardId: currentProgress?.cardId || '', interval, easeFactor, repetitions, lastReview: now, nextReview: now + interval * 24 * 60 * 60 * 1000 };
};

const App = () => {
  // Navigation & User State
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [mode, setMode] = useState<'landing' | 'auth' | 'browse' | 'flashcards' | 'mindmap' | 'pricing' | 'checkout' | 'review' | 'essay'>('landing');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem('sejarah_master_theme') === 'dark');
  
  // Data State
  const [isLoading, setIsLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [mindMap, setMindMap] = useState<MindMapData | null>(null);
  const [essayGuide, setEssayGuide] = useState<EssayGuideData | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForm, setSelectedForm] = useState<4 | 5>(4);
  const [isPremium, setIsPremium] = useState<boolean>(() => localStorage.getItem('sejarah_master_premium') === 'true');
  const [masteryCards, setMasteryCards] = useState<Flashcard[]>(() => JSON.parse(localStorage.getItem('sejarah_master_cards') || '[]'));
  const [srsProgress, setSrsProgress] = useState<Record<string, CardProgress>>(() => JSON.parse(localStorage.getItem('sejarah_master_srs') || '{}'));
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'tng' | 'billplz' | null>(null);

  useEffect(() => { localStorage.setItem('sejarah_master_cards', JSON.stringify(masteryCards)); }, [masteryCards]);
  useEffect(() => { localStorage.setItem('sejarah_master_srs', JSON.stringify(srsProgress)); }, [srsProgress]);
  
  // Theme effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sejarah_master_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sejarah_master_theme', 'light');
    }
  }, [isDarkMode]);

  const dueForReview = useMemo(() => {
    const now = Date.now();
    return masteryCards.filter(card => {
      const prog = srsProgress[card.id];
      return !prog || prog.nextReview <= now;
    });
  }, [masteryCards, srsProgress]);

  const startReviewMode = () => {
    if (dueForReview.length === 0) return;
    setFlashcards(dueForReview);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setMode('review');
  };

  const handleRating = (rating: number) => {
    const card = flashcards[currentCardIndex];
    if (!card) return;
    const currentProg = srsProgress[card.id];
    const newProg = calculateNextReview(rating, currentProg);
    newProg.cardId = card.id;
    setSrsProgress(prev => ({ ...prev, [card.id]: newProg }));

    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setMode('browse');
    }
  };

  const startFlashcards = async (sub: Subtopic) => {
    setIsLoading(true); setMode('flashcards'); setCurrentCardIndex(0); setIsFlipped(false);
    try {
      const cards = await generateFlashcards(activeChapter?.title || '', sub.title, sub.id);
      setFlashcards(cards);
      setMasteryCards(prev => {
        const existingQs = new Set(prev.map(c => c.question));
        return [...prev, ...cards.filter(c => !existingQs.has(c.question))];
      });
    } catch (e) { alert("Sila cuba lagi."); setMode('browse'); }
    setIsLoading(false);
  };

  const startMindMap = async (title: string) => {
    setIsLoading(true); setMode('mindmap');
    try { setMindMap(await generateMindMap(title)); } catch (e) { setMode('browse'); }
    setIsLoading(false);
  };

  const startEssayGuide = async (title: string) => {
    setIsLoading(true); setMode('essay');
    try { setEssayGuide(await generateEssayGuide(title)); } catch (e) { setMode('browse'); }
    setIsLoading(false);
  };

  const handlePurchase = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsPremium(true); localStorage.setItem('sejarah_master_premium', 'true');
      setIsLoading(false); setMode('browse');
    }, 2000);
  };

  const ThemeToggle = () => (
    <button 
      onClick={() => setIsDarkMode(!isDarkMode)} 
      className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all shadow-sm"
      title={isDarkMode ? "Tukar ke Mod Terang" : "Tukar ke Mod Gelap"}
    >
      {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );

  if (mode === 'landing') {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-stone-950 text-stone-100' : 'bg-white text-stone-900'} transition-colors duration-500`}>
        <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-amber-600 font-black text-2xl font-serif">
            <History size={32} /> SejarahMaster
          </div>
          <div className="flex gap-4 items-center">
            <ThemeToggle />
            <button onClick={() => setMode('auth')} className="px-6 py-2 font-bold hover:text-amber-600 transition-colors">Log Masuk</button>
            <button onClick={() => setMode('pricing')} className="px-6 py-2 bg-amber-600 text-white rounded-full font-bold shadow-lg hover:bg-amber-700 transition-all">Dapatkan Akses Pro</button>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-full text-sm font-black uppercase tracking-widest mb-8 animate-bounce">
            <Sparkles size={16} /> Belajar 3x Lebih Pantas dengan AI
          </div>
          <h1 className="text-6xl md:text-8xl font-black font-serif leading-[1.1] mb-8">
            Hafal Sejarah <br /><span className="text-amber-600">Tanpa Lupa.</span>
          </h1>
          <p className="text-xl text-stone-500 dark:text-stone-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Satu-satunya aplikasi yang menggabungkan buku teks KSSM dengan algoritma ingatan jangka panjang (Spaced Repetition) & Panduan Esei AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => { setMode('browse'); setUser({ name: 'Tetamu', email: '' }); }} className="px-12 py-5 bg-stone-900 dark:bg-stone-50 dark:text-stone-900 text-white rounded-2xl font-black text-xl flex items-center gap-2 hover:bg-black dark:hover:bg-white transition-all">
              Mula Belajar Percuma <ArrowRight />
            </button>
          </div>
          <div className="mt-24 grid grid-cols-1 md:grid-cols-4 gap-8 text-left">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center"><BrainCircuit /></div>
              <h3 className="text-xl font-bold">Spaced Repetition</h3>
              <p className="text-stone-500 dark:text-stone-400 text-sm">Jadualkan ulangkaji pada waktu yang tepat sebelum anda lupa.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center"><Network /></div>
              <h3 className="text-xl font-bold">Peta Minda AI</h3>
              <p className="text-stone-500 dark:text-stone-400 text-sm">Visualisasikan kaitan antara peristiwa sejarah secara automatik.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center"><PenTool /></div>
              <h3 className="text-xl font-bold">Teknik Esei</h3>
              <p className="text-stone-500 dark:text-stone-400 text-sm">Master teknik FHCI untuk skor A+ dalam Kertas 2 Sejarah.</p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center"><ShieldCheck /></div>
              <h3 className="text-xl font-bold">Mesra Ibu Bapa</h3>
              <p className="text-stone-500 dark:text-stone-400 text-sm">Pantau kemajuan anak anda dengan dashboard statistik.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (mode === 'auth') {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-stone-950' : 'bg-[#fcfaf7]'} flex items-center justify-center p-6 transition-colors duration-500`}>
        <div className="bg-white dark:bg-stone-900 p-12 rounded-[3rem] shadow-2xl border border-stone-100 dark:border-stone-800 w-full max-w-md space-y-8 animate-in zoom-in-95">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-amber-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl"><User size={32} /></div>
            <h2 className="text-3xl font-bold font-serif text-stone-900 dark:text-stone-100">Selamat Kembali</h2>
            <p className="text-stone-400 dark:text-stone-500">Log masuk untuk simpan kemajuan anda</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => { setUser({ name: 'Ahmad', email: 'ahmad@example.com' }); setMode('browse'); }} className="w-full p-4 border-2 border-stone-100 dark:border-stone-800 rounded-2xl flex items-center justify-center gap-3 font-bold hover:bg-stone-50 dark:hover:bg-stone-800 transition-all text-stone-700 dark:text-stone-300">
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" /> Teruskan dengan Google
            </button>
            <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-100 dark:border-stone-800"></div></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-stone-900 px-2 text-stone-400">Atau Email</span></div></div>
            <input type="email" placeholder="Email Pelajar/Ibu Bapa" className="w-full p-4 bg-stone-50 dark:bg-stone-800 border-2 border-stone-50 dark:border-stone-800 rounded-2xl focus:border-amber-500 outline-none dark:text-stone-100" />
            <button className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-amber-500/20">Log Masuk</button>
          </div>
          <button onClick={() => setMode('landing')} className="w-full text-stone-400 font-bold text-sm">Kembali ke Laman Utama</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-stone-950 text-stone-100' : 'bg-[#fcfaf7] text-stone-900'} transition-colors duration-500`}>
      <header className="bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-6 py-4 sticky top-0 z-50 shadow-sm transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setMode('browse'); setActiveChapter(null); }}>
            <div className="bg-amber-600 p-2 rounded-lg text-white"><History size={24} /></div>
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 tracking-tight font-serif">SejarahMaster</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isPremium ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-100 dark:border-amber-900/30 font-black text-[10px] uppercase tracking-widest"><Trophy size={14} /> Ahli Pro</div>
            ) : (
              <button onClick={() => setMode('pricing')} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-bold text-sm shadow-md">Upgrade Pro</button>
            )}
            <div className="w-px h-6 bg-stone-200 dark:bg-stone-800 hidden md:block"></div>
            <button onClick={() => { setUser(null); setMode('landing'); }} className="text-stone-400 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
             <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-100 dark:border-amber-900/30 border-t-amber-600"></div>
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-600" size={20} />
             </div>
             <p className="text-stone-400 dark:text-stone-500 font-bold animate-pulse">Menghubungkan ke Gemini AI...</p>
          </div>
        ) : mode === 'browse' && !activeChapter ? (
          <div className="space-y-8 animate-in fade-in duration-500">
             {dueForReview.length > 0 && (
                <div className="bg-stone-900 dark:bg-stone-800 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden group cursor-pointer" onClick={() => startReviewMode()}>
                   <div className="absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
                   <div className="flex items-center gap-8 relative z-10">
                      <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center text-stone-900 shadow-xl rotate-3"><Clock size={40} /></div>
                      <div>
                        <h2 className="text-3xl font-black font-serif italic mb-1">Masa Beraksi!</h2>
                        <p className="text-stone-400 text-lg">Anda ada <span className="text-amber-500 font-black">{dueForReview.length} kad</span> untuk diulangkaji hari ini.</p>
                      </div>
                   </div>
                   <button className="px-10 py-5 bg-amber-500 text-stone-900 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-xl shadow-amber-500/20 flex items-center gap-2">Mula Ulangkaji <ArrowRight /></button>
                </div>
             )}

             <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-4">
                <div className="flex p-1 bg-stone-100 dark:bg-stone-800 rounded-2xl w-fit">
                  <button onClick={() => setSelectedForm(4)} className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${selectedForm === 4 ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xl' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}>T4</button>
                  <button onClick={() => setSelectedForm(5)} className={`px-8 py-3 rounded-xl text-sm font-black transition-all ${selectedForm === 5 ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-xl' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}`}>T5</button>
                </div>
                <div className="relative w-64">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 dark:text-stone-600" size={18} />
                   <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari bab..." className="w-full pl-12 pr-4 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl focus:border-amber-500 outline-none text-sm font-medium transition-colors" />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ALL_CHAPTERS.filter(c => c.form === selectedForm).map(ch => (
                  <div key={ch.id} onClick={() => { if(!isPremium && !ch.isFree) setMode('pricing'); else setActiveChapter(ch); }} className="bg-white dark:bg-stone-900 p-8 rounded-[2rem] border border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-2xl transition-all group cursor-pointer relative overflow-hidden">
                    {!isPremium && !ch.isFree && <div className="absolute top-6 right-6 text-stone-300 dark:text-stone-700 group-hover:text-amber-500 transition-colors"><Lock size={20} /></div>}
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-4">Bab {ch.number}</span>
                    <h3 className="text-2xl font-bold font-serif text-stone-800 dark:text-stone-100 leading-tight mb-8 group-hover:text-amber-700 dark:group-hover:text-amber-500 transition-colors">{ch.title}</h3>
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-bold text-stone-400 dark:text-stone-500">{ch.subtopics.length} Subtopik</span>
                       <div className="w-10 h-10 rounded-full bg-stone-50 dark:bg-stone-800 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all"><ChevronRight size={20} /></div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        ) : mode === 'essay' && essayGuide ? (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            <button onClick={() => setMode('browse')} className="flex items-center gap-2 text-stone-400 dark:text-stone-500 font-bold hover:text-stone-900 dark:hover:text-stone-200 transition-colors"><ChevronLeft size={20} /> Kembali ke Dashboard</button>
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-[3rem] shadow-xl overflow-hidden transition-colors">
              <div className="bg-stone-900 dark:bg-stone-800 p-12 text-white relative transition-colors">
                 <div className="absolute top-10 right-10 bg-amber-500 text-stone-900 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><Sparkles size={12}/> AI Masterclass</div>
                 <h2 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-4">Panduan Esei Sejarah</h2>
                 <h3 className="text-4xl font-black font-serif leading-tight">{essayGuide.topic}</h3>
              </div>
              <div className="p-12 space-y-12 bg-white dark:bg-stone-900 transition-colors">
                <section className="space-y-6">
                   <div className="flex items-center gap-3 text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest"><FileText size={16} /> Soalan Contoh</div>
                   <div className="p-8 bg-stone-50 dark:bg-stone-800 border-l-4 border-amber-500 rounded-2xl text-xl font-bold italic text-stone-700 dark:text-stone-200 leading-relaxed transition-colors">
                     "{essayGuide.sampleQuestion}"
                   </div>
                </section>

                <section className="space-y-8">
                   <div className="flex items-center gap-3 text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest"><ClipboardList size={16} /> Rangka Jawapan (Teknik FHCI)</div>
                   <div className="grid gap-4">
                      {essayGuide.framework.map((f, i) => (
                        <div key={i} className="flex gap-6 items-start group">
                           <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${
                             f.technique === 'Fakta' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                             f.technique === 'Huraian' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                             f.technique === 'Contoh' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                           }`}>
                             {f.technique}
                           </div>
                           <div className="pt-2">
                             <h4 className="font-bold text-stone-800 dark:text-stone-200 text-lg mb-1">{f.part}</h4>
                             <p className="text-stone-500 dark:text-stone-400 leading-relaxed">{f.content}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </section>

                <section className="space-y-6">
                   <div className="flex items-center gap-3 text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest"><PenTool size={16} /> Contoh Jawapan Lengkap</div>
                   <div className="p-10 bg-stone-50 dark:bg-stone-800 rounded-[2.5rem] text-lg leading-[1.8] text-stone-600 dark:text-stone-300 font-medium border border-stone-100 dark:border-stone-800 whitespace-pre-wrap transition-colors">
                      {essayGuide.modelAnswer}
                   </div>
                </section>

                <section className="space-y-6">
                   <div className="flex items-center gap-3 text-stone-400 dark:text-stone-500 font-black text-xs uppercase tracking-widest"><Sparkles size={16} /> Kata Kunci Sejarah (Glosari)</div>
                   <div className="flex flex-wrap gap-2">
                      {essayGuide.keyVocabulary.map((v, i) => (
                        <span key={i} className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded-full font-bold text-sm border border-stone-200 dark:border-stone-700">{v}</span>
                      ))}
                   </div>
                </section>
              </div>
            </div>
            <div className="p-12 text-center text-stone-400 dark:text-stone-600 text-sm">Gunakan rangka ini sebagai panduan. Pastikan anda menulis dalam perenggan yang lengkap semasa peperiksaan.</div>
          </div>
        ) : (mode === 'flashcards' || mode === 'review') ? (
          <div className="max-w-3xl mx-auto py-8 space-y-10 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <button onClick={() => setMode('browse')} className="flex items-center gap-2 text-stone-400 dark:text-stone-500 font-black uppercase text-xs tracking-widest hover:text-stone-800 dark:hover:text-stone-200"><ChevronLeft size={16} /> Berhenti</button>
              <div className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-full font-black text-[10px] uppercase tracking-widest">KAD {currentCardIndex + 1} / {flashcards.length}</div>
            </div>

            <div className={`relative h-[32rem] w-full cursor-pointer card-flip ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
              <div className="card-inner w-full h-full">
                <div className="card-front bg-white dark:bg-stone-900 border-2 border-stone-100 dark:border-stone-800 shadow-2xl p-12 text-center space-y-10 transition-colors">
                  <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center mx-auto transition-colors"><BrainCircuit size={40} /></div>
                  <h3 className="text-3xl font-bold text-stone-800 dark:text-stone-100 leading-snug transition-colors">{flashcards[currentCardIndex]?.question}</h3>
                  <div className="text-stone-300 dark:text-stone-600 text-sm font-black uppercase tracking-widest animate-pulse">Klik untuk lihat jawapan</div>
                </div>
                <div className="card-back bg-stone-900 dark:bg-black border-2 border-stone-800 dark:border-stone-900 shadow-2xl p-12 text-center space-y-10 text-white transition-colors">
                  <div className="space-y-4">
                    <p className="text-amber-500 font-black uppercase text-xs tracking-widest">Jawapan</p>
                    <p className="text-2xl font-medium leading-relaxed italic">"{flashcards[currentCardIndex]?.answer}"</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-10" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleRating(1)} className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><RotateCcw size={18} className="mx-auto mb-1" /><span className="text-[10px] font-black uppercase">Gagal</span></button>
                    <button onClick={() => handleRating(2)} className="p-4 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-2xl hover:bg-orange-500 hover:text-white transition-all"><Info size={18} className="mx-auto mb-1" /><span className="text-[10px] font-black uppercase">Sukar</span></button>
                    <button onClick={() => handleRating(3)} className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-2xl hover:bg-blue-500 hover:text-white transition-all"><CheckCircle2 size={18} className="mx-auto mb-1" /><span className="text-[10px] font-black uppercase">Baik</span></button>
                    <button onClick={() => handleRating(4)} className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-2xl hover:bg-green-500 hover:text-white transition-all"><Sparkles size={18} className="mx-auto mb-1" /><span className="text-[10px] font-black uppercase">Mudah</span></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : mode === 'mindmap' && mindMap ? (
          <div className="space-y-8 animate-in zoom-in-95 duration-300 py-4 pb-20">
             <div className="flex items-center justify-between">
              <button onClick={() => setMode('browse')} className="flex items-center gap-2 text-stone-400 dark:text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-black uppercase text-xs tracking-widest bg-white dark:bg-stone-900 px-4 py-2 rounded-xl border border-stone-100 dark:border-stone-800"><ChevronLeft size={16} /> Kembali</button>
              <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors"><Sparkles size={14} /> AI Visualization</div>
            </div>
            <div className="text-center space-y-3 max-w-2xl mx-auto mb-16">
              <h2 className="text-5xl font-bold text-stone-800 dark:text-stone-100 font-serif leading-tight transition-colors">{mindMap.title}</h2>
              <p className="text-stone-500 dark:text-stone-400 italic text-lg transition-colors">{mindMap.description}</p>
            </div>
            <div className="relative flex flex-col items-center gap-12">
              <div className="bg-stone-900 dark:bg-stone-800 text-white p-10 rounded-[3rem] shadow-2xl z-20 text-center max-w-md border-8 border-amber-600/20 transition-colors">
                <Network size={32} className="mx-auto mb-4 text-amber-500" />
                <h3 className="text-2xl font-black uppercase tracking-tighter">{mindMap.title}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full z-10">
                {mindMap.branches.map((branch, bIdx) => (
                  <div key={bIdx} className="bg-white dark:bg-stone-900 rounded-[3rem] p-8 shadow-xl border-t-8 border-amber-500 flex flex-col gap-6 hover:-translate-y-2 transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-3 rounded-2xl transition-colors"><Share2 size={24} /></div>
                      <h4 className="font-black text-stone-800 dark:text-stone-200 uppercase text-sm tracking-tight">{branch.branchTitle}</h4>
                    </div>
                    <ul className="space-y-4">
                      {branch.details.map((detail, dIdx) => (
                        <li key={dIdx} className="flex items-start gap-3 group">
                          <div className="mt-2 w-2 h-2 rounded-full bg-amber-400 shrink-0 group-hover:scale-150 transition-transform"></div>
                          <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed font-medium transition-colors">{detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : mode === 'browse' && activeChapter ? (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <button onClick={() => setActiveChapter(null)} className="flex items-center gap-2 text-stone-400 dark:text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-bold transition-colors mb-4 group"><ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Kembali ke Senarai</button>
            <div className="p-8 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-[2.5rem] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-colors">
              <div><span className="text-amber-600 dark:text-amber-500 font-black uppercase text-xs tracking-widest mb-2 block">T{activeChapter.form} • Bab {activeChapter.number}</span><h2 className="text-3xl font-bold text-stone-800 dark:text-stone-100 font-serif transition-colors">{activeChapter.title}</h2></div>
              <button onClick={() => startMindMap(activeChapter.title)} className="px-6 py-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all font-black text-sm flex items-center gap-2"><Network size={20} /> Peta Minda Bab</button>
            </div>
            <div className="grid gap-4">
              {activeChapter.subtopics.map((sub) => (
                <div key={sub.id} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 group hover:border-amber-400 dark:hover:border-amber-600 transition-all">
                  <div className="space-y-2 flex-1"><h4 className="font-black text-stone-800 dark:text-stone-100 text-xl tracking-tight transition-colors">{sub.id} {sub.title}</h4><p className="text-stone-500 dark:text-stone-400 leading-relaxed transition-colors">{sub.description}</p></div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button onClick={() => startMindMap(sub.title)} className="p-4 bg-stone-50 dark:bg-stone-800 text-stone-400 dark:text-stone-500 rounded-2xl hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 transition-all" title="Peta Minda"><Workflow size={18} /></button>
                    <button onClick={() => startEssayGuide(sub.title)} className="p-4 bg-stone-50 dark:bg-stone-800 text-stone-400 dark:text-stone-500 rounded-2xl hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 transition-all" title="Panduan Esei"><PenTool size={18} /></button>
                    <button onClick={() => startFlashcards(sub)} className="px-6 py-4 bg-stone-900 dark:bg-stone-700 text-white rounded-2xl font-bold hover:bg-black dark:hover:bg-stone-600 flex items-center gap-2 transition-all"><BrainCircuit size={18} /> Hafal</button>
                    <button onClick={() => {}} className="px-6 py-4 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 flex items-center gap-2 transition-all"><GraduationCap size={18} /> Kuiz</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : mode === 'pricing' ? (
          <div className="max-w-4xl mx-auto py-12 animate-in zoom-in-95 duration-500">
             <div className="text-center mb-16 space-y-4">
                <h2 className="text-5xl font-bold text-stone-800 dark:text-stone-100 font-serif">Kuasai Sejarah.</h2>
                <p className="text-stone-500 dark:text-stone-400 text-lg">Pelaburan sekali bayar untuk keputusan cemerlang SPM.</p>
             </div>
             <div className="grid md:grid-cols-2 gap-8 items-stretch">
                <div className="bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col transition-colors">
                  <h3 className="text-xl font-bold text-stone-800 dark:text-stone-200">Versi Percuma</h3>
                  <div className="mt-4 text-4xl font-black text-stone-300 dark:text-stone-700">RM 0</div>
                  <ul className="mt-10 space-y-6 flex-1">
                    <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400 font-medium"><Check size={20} className="text-green-500" /> Bab 1 Form 4 & 5</li>
                    <li className="flex items-center gap-3 text-stone-600 dark:text-stone-400 font-medium"><Check size={20} className="text-green-500" /> Sistem Spaced Repetition</li>
                    <li className="flex items-center gap-3 text-stone-300 dark:text-stone-600 opacity-60 line-through"><Lock size={18} /> Peta Minda & Esei AI</li>
                  </ul>
                  <button onClick={() => setMode('browse')} className="w-full mt-10 py-5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-2xl font-black hover:bg-stone-200 dark:hover:bg-stone-700 transition-all">Teruskan Percuma</button>
                </div>
                <div className="bg-white dark:bg-stone-900 p-10 rounded-[3rem] border-4 border-amber-500 shadow-2xl flex flex-col relative scale-105 transition-colors">
                  <div className="absolute top-0 right-0 bg-amber-500 text-white px-8 py-3 rounded-bl-3xl font-black text-xs uppercase tracking-widest">Akses Seumur Hidup</div>
                  <h3 className="text-xl font-bold text-amber-600 dark:text-amber-500">Pelajar Pro</h3>
                  <div className="mt-4 text-4xl font-black text-stone-800 dark:text-stone-100">RM 29.90</div>
                  <ul className="mt-10 space-y-6 flex-1">
                    <li className="flex items-center gap-3 text-stone-700 dark:text-stone-200 font-bold"><Check size={20} className="text-amber-500" /> Semua Bab & Subtopik</li>
                    <li className="flex items-center gap-3 text-stone-700 dark:text-stone-200 font-bold"><Check size={20} className="text-amber-500" /> Panduan Esei AI Tanpa Had</li>
                    <li className="flex items-center gap-3 text-stone-700 dark:text-stone-200 font-bold"><Check size={20} className="text-amber-500" /> Peta Minda AI Tanpa Had</li>
                    <li className="flex items-center gap-3 text-stone-700 dark:text-stone-200 font-bold"><Check size={20} className="text-amber-500" /> Analisis Kelemahan Pelajar</li>
                  </ul>
                  <button onClick={() => setMode('checkout')} className="w-full mt-10 py-5 bg-amber-600 text-white rounded-2xl font-black text-xl hover:bg-amber-700 shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2"><Zap size={20} /> Upgrade ke Pro</button>
                </div>
             </div>
          </div>
        ) : mode === 'checkout' ? (
          <div className="max-w-2xl mx-auto py-12 animate-in slide-in-from-bottom-8 duration-500">
             <div className="bg-white dark:bg-stone-900 p-12 rounded-[3.5rem] border border-stone-200 dark:border-stone-800 shadow-2xl space-y-12 transition-colors">
                <div className="flex items-center justify-between">
                   <h2 className="text-3xl font-black text-stone-900 dark:text-stone-100 font-serif">Pembayaran</h2>
                   <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-black text-[10px] uppercase bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full border border-green-100 dark:border-green-900/30 transition-colors"><ShieldCheck size={14} /> Secured</div>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800 p-8 rounded-[2rem] flex justify-between items-center border border-stone-100 dark:border-stone-700 transition-colors">
                   <div><p className="text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">Pelan</p><p className="text-2xl font-black text-stone-800 dark:text-stone-100">SejarahMaster Pro</p></div>
                   <div className="text-right font-black text-3xl dark:text-white">RM 29.90</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button onClick={() => setPaymentMethod('stripe')} className={`p-8 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${paymentMethod === 'stripe' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-xl' : 'border-stone-100 dark:border-stone-800'}`}>
                     <CreditCard size={32} className={paymentMethod === 'stripe' ? 'text-amber-600' : 'text-stone-300 dark:text-stone-600'} />
                     <span className={`font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-800'}`}>Kad Kredit</span>
                  </button>
                  <button onClick={() => setPaymentMethod('tng')} className={`p-8 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${paymentMethod === 'tng' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-xl' : 'border-stone-100 dark:border-stone-800'}`}>
                     <Smartphone size={32} className={paymentMethod === 'tng' ? 'text-amber-600' : 'text-stone-300 dark:text-stone-600'} />
                     <span className={`font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-800'}`}>TNG eWallet</span>
                  </button>
                  <button onClick={() => setPaymentMethod('billplz')} className={`p-8 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${paymentMethod === 'billplz' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-xl' : 'border-stone-100 dark:border-stone-800'}`}>
                     <Banknote size={32} className={paymentMethod === 'billplz' ? 'text-amber-600' : 'text-stone-300 dark:text-stone-600'} />
                     <span className={`font-bold ${isDarkMode ? 'text-stone-300' : 'text-stone-800'}`}>Billplz (FPX)</span>
                  </button>
                </div>
                <p className="text-center text-stone-400 dark:text-stone-600 text-xs px-10">Dengan melengkapkan pembayaran, anda bersetuju dengan terma perkhidmatan SejarahMaster.</p>
                <button onClick={() => setMode('pricing')} className="w-full text-stone-400 dark:text-stone-500 font-bold hover:text-stone-900 dark:hover:text-stone-200 transition-colors">Batal & Kembali</button>
             </div>
          </div>
        ) : null}
      </main>

      <footer className="py-20 border-t border-stone-100 dark:border-stone-900 bg-white dark:bg-stone-900 transition-colors">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-10">
          <div className="flex justify-center items-center gap-3 text-amber-600 font-black opacity-40">
            <History size={24} />
            <span className="font-serif text-2xl tracking-tighter">SejarahMaster</span>
          </div>
          <p className="text-stone-400 dark:text-stone-500 text-sm max-w-lg mx-auto leading-relaxed">Platform hafal sejarah Malaysia SPM tercanggih. Direka khas untuk pelajar SPM meningkatkan ingatan melalui AI dan Spaced Repetition.</p>
          <div className="flex justify-center gap-12 text-[10px] font-black text-stone-300 dark:text-stone-700 uppercase tracking-[0.3em]">
             <span>&copy; 2025 SejarahMaster AI. Hak Cipta Terpelihara.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);