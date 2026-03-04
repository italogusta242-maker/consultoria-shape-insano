import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple recursive character text splitter
function splitText(text: string, chunkSize = 1000, chunkOverlap = 200): string[] {
  const separators = ["\n\n", "\n", ". ", " "];
  const chunks: string[] = [];

  function splitRecursive(text: string, sepIdx: number): string[] {
    if (text.length <= chunkSize) return [text.trim()].filter(Boolean);

    const sep = separators[sepIdx] || " ";
    const parts = text.split(sep);
    const result: string[] = [];
    let current = "";

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;
      if (candidate.length > chunkSize && current) {
        result.push(current.trim());
        // Keep overlap
        const overlapStart = Math.max(0, current.length - chunkOverlap);
        current = current.slice(overlapStart) + sep + part;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) result.push(current.trim());

    // If any chunk is still too large and we have more separators, split further
    if (sepIdx < separators.length - 1) {
      const refined: string[] = [];
      for (const chunk of result) {
        if (chunk.length > chunkSize * 1.5) {
          refined.push(...splitRecursive(chunk, sepIdx + 1));
        } else {
          refined.push(chunk);
        }
      }
      return refined;
    }

    return result;
  }

  return splitRecursive(text, 0).filter(c => c.length > 50); // skip tiny chunks
}

// Generate embeddings using Google Gemini embedding API
async function generateEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const results: number[][] = [];
  
  // Gemini embedding API supports batch, but let's process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: batch.map(text => ({
            model: "models/text-embedding-004",
            content: { parts: [{ text }] },
            taskType: "RETRIEVAL_DOCUMENT",
          })),
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Embedding API error:", response.status, err);
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    for (const embedding of data.embeddings) {
      results.push(embedding.values);
    }
  }

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Validate user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const specialistId = claimsData.claims.sub as string;

    const { content, clear_existing = true } = await req.json();
    if (!content || typeof content !== "string" || content.length < 100) {
      throw new Error("Content must be a string with at least 100 characters");
    }

    console.log(`Processing knowledge document for specialist ${specialistId}: ${content.length} chars`);

    // Step 1: Clear existing knowledge base for this specialist if requested
    if (clear_existing) {
      const { error: delErr } = await supabaseAdmin
        .from("ai_knowledge_base")
        .delete()
        .eq("specialist_id", specialistId);
      if (delErr) console.warn("Error clearing existing knowledge:", delErr.message);
    }

    // Step 2: Split text into chunks
    const chunks = splitText(content, 1000, 200);
    console.log(`Split into ${chunks.length} chunks`);

    if (chunks.length === 0) throw new Error("No valid chunks generated from content");
    if (chunks.length > 500) throw new Error("Document too large: max 500 chunks allowed");

    // Step 3: Generate embeddings for all chunks
    console.log("Generating embeddings...");
    const embeddings = await generateEmbeddings(chunks, GEMINI_KEY);
    console.log(`Generated ${embeddings.length} embeddings`);

    // Step 4: Insert into database in batches
    const insertBatchSize = 50;
    let inserted = 0;
    for (let i = 0; i < chunks.length; i += insertBatchSize) {
      const batch = chunks.slice(i, i + insertBatchSize).map((chunk, idx) => ({
        specialist_id: specialistId,
        content: chunk,
        embedding: JSON.stringify(embeddings[i + idx]),
        metadata: {
          chunk_index: i + idx,
          total_chunks: chunks.length,
          char_length: chunk.length,
        },
      }));

      const { error: insertErr } = await supabaseAdmin
        .from("ai_knowledge_base")
        .insert(batch);

      if (insertErr) {
        console.error(`Insert batch error at ${i}:`, insertErr.message);
        throw new Error(`Failed to insert chunks: ${insertErr.message}`);
      }
      inserted += batch.length;
    }

    console.log(`Successfully inserted ${inserted} chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        chunks_processed: inserted,
        total_chars: content.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-knowledge-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
