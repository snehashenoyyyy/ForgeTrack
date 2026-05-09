import { createClient } from '@supabase/supabase-api'
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function check() {
  const { count } = await supabase.from('sessions').select('*', { count: 'exact', head: true })
  console.log('Total Sessions in DB:', count)
  
  const { data: sessions } = await supabase.from('sessions').select('date').order('date', { ascending: true })
  console.log('Session Dates:', sessions.map(s => s.date))
}
check()
