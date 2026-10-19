// ==========================================================================
// Restaurant POS & Operations Engine
// Complete Vanilla JS Implementation with Supabase & LocalStorage Sync
// ==========================================================================

// --------------------------------------------------------------------------
// 1. SUPABASE CONFIGURATION & SYNC HELPERS
// --------------------------------------------------------------------------
const SUPABASE_RAW_URL = "https://iacsiognshciovcxxzdb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhY3Npb2duc2hjaW92Y3h4emRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNDAxODksImV4cCI6MjEwNzcxNjE4OX0.XFsbE-QlFpJHmDqm66ajRpMXGaNO9mj4Qt8NmlHXczE";

const SUPABASE_URL = SUPABASE_RAW_URL.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

const isSupabaseConfigured = 
  SUPABASE_URL !== "YOUR_SUPABASE_PROJECT_URL" && 
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY" &&
  SUPABASE_URL.startsWith("https://");

let supabaseClient = null;
if (isSupabaseConfigured && window.supabase) {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase client initialized successfully at:", SUPABASE_URL);
  } catch (err) {
    console.warn("Failed to initialize Supabase:", err);
  }
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// 2. STARTER DATA (Clean Slate - 100% Empty)
// --------------------------------------------------------------------------
const DEFAULT_SETTINGS = {
  id: 1,
  name: "",
  phone: "",
  address: "",
  admin_password: "1234",
  active_theme: "light-minimal",
  active_font: "dm-sans",
  receipt_footer: "Thank You, Visit Again!",
  kot_workflow: "auto" // 'auto', 'kot_only', 'kot_print'
};

const DEFAULT_SECTIONS = [];
const DEFAULT_MENU_TREE = [];
const DEFAULT_COMBOS = [];
const DEFAULT_ORDERS = [];
const DEFAULT_KITCHEN_TICKETS = [];
if (typeof window !== "undefined") {
  window.SUPABASE_RAW_URL = SUPABASE_RAW_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  window.SUPABASE_URL = SUPABASE_URL;
  window.isSupabaseConfigured = isSupabaseConfigured;
  window.supabaseClient = supabaseClient;
  window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  window.DEFAULT_SECTIONS = DEFAULT_SECTIONS;
  window.DEFAULT_MENU_TREE = DEFAULT_MENU_TREE;
  window.DEFAULT_COMBOS = DEFAULT_COMBOS;
  window.DEFAULT_ORDERS = DEFAULT_ORDERS;
  window.DEFAULT_KITCHEN_TICKETS = DEFAULT_KITCHEN_TICKETS;
}
