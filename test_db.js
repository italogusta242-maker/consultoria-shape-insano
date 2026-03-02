import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

const envFile = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: p } = await supabase.from('profiles').select('*').limit(5)
  console.log("Profiles:", p)
  
  const { data: r } = await supabase.from('user_roles').select('*').limit(5)
  console.log("Roles:", r)
}
test()
