import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file
config({ path: resolve(__dirname, "../.env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your-project-id")) {
  console.error("❌ Setup incomplete: Missing valid Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  console.log("🔗 Connecting to Supabase at:", supabaseUrl);
  
  // Since we might not have tables created yet, test by checking an empty select on a standard table name, 
  // or simply outputting the client auth status (if credentials worked to instantiate).
  try {
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log("✅ Supabase is connected (Error 42P01: Table 'profiles' does not exist yet. This is normal because we haven't run migrations!)");
      } else {
        console.error("❌ Check failed:", error);
      }
    } else {
      console.log("✅ Supabase is connected! Found 'profiles' table data:", data);
    }
    
  } catch (err) {
    console.error("❌ Connection failed. Check your URL and Key.", err);
  }
}

testSupabase();
