import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

async function fetchSupabase(endpoint, method = 'GET', body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const options = {
        method,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
        console.error(`Error ${res.status}: ${await res.text()}`);
        return null;
    }
    if (method === 'DELETE') return true;
    return res.json();
}

async function checkAll() {
    console.log("Fetching ALL user_roles...");
    const roles = await fetchSupabase("user_roles?select=id,user_id,role");

    if (!roles) return;

    const especialistas = roles.filter(r => r.role === 'especialista');
    console.log(`Found ${especialistas.length} users with 'especialista' role.`);

    for (const r of especialistas) {
        console.log(`Deleting role ${r.role} for user_id: ${r.user_id} (role id: ${r.id})`);
        const ms = await fetchSupabase(`user_roles?id=eq.${r.id}`, 'DELETE');
        if (ms) console.log(`Successfully removed id ${r.id}`);
    }

    console.log("\nSearching for Lucas Coelho profile...");
    const profiles = await fetchSupabase(`profiles?select=id,nome`);
    const lucas = profiles.filter(p => p.nome && p.nome.toLowerCase().includes('lucas coelho'));
    for (const l of lucas) {
        console.log(`User: ${l.nome} (${l.id})`);
        const r = roles.filter(role => role.user_id === l.id);
        console.log(`Roles:`, r.map(x => x.role));
    }
}

checkAll();
