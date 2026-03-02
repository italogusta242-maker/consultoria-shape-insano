import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Base64URL helpers ---
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// --- VAPID key management ---
async function getOrCreateVAPIDKeys(supabaseAdmin: any) {
  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", ["vapid_keys_jwk", "vapid_public_key"]);

  const jwkSetting = settings?.find((s: any) => s.key === "vapid_keys_jwk");

  if (jwkSetting?.value) {
    const jwkData = JSON.parse(jwkSetting.value);
    const privateKey = await crypto.subtle.importKey(
      "jwk", jwkData.privateKey,
      { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]
    );
    const publicKey = await crypto.subtle.importKey(
      "jwk", jwkData.publicKey,
      { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]
    );
    const pubRaw = await crypto.subtle.exportKey("raw", publicKey);
    return { privateKey, publicKey, publicKeyB64: b64url(pubRaw), jwk: jwkData };
  }

  // Generate new keys
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
  );
  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyB64 = b64url(pubRaw);

  await supabaseAdmin.from("app_settings").upsert([
    { key: "vapid_keys_jwk", value: JSON.stringify({ privateKey: privJwk, publicKey: pubJwk }) },
    { key: "vapid_public_key", value: publicKeyB64 },
  ]);

  return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, publicKeyB64, jwk: { privateKey: privJwk, publicKey: pubJwk } };
}

// --- VAPID JWT ---
async function createVAPIDAuth(
  endpoint: string,
  privateKey: CryptoKey,
  publicKeyB64: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 86400,
        sub: "mailto:contato@shapeinsano.com",
      })
    )
  );

  const signData = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    signData
  );

  // ECDSA signature from Web Crypto is in IEEE P1363 format (r || s), which is what VAPID expects
  const sig = b64url(signature);
  return `vapid t=${header}.${payload}.${sig},k=${publicKeyB64}`;
}

// --- Web Push Encryption (RFC 8291) ---
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm.buffer as ArrayBuffer, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, info: info.buffer as ArrayBuffer },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

async function encryptPayload(
  payloadText: string,
  p256dhB64: string,
  authB64: string
): Promise<Uint8Array> {
  const subscriberPubKeyRaw = b64urlDecode(p256dhB64);
  const authSecret = b64urlDecode(authB64);
  const payloadBytes = new TextEncoder().encode(payloadText);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  // Import subscriber's public key for ECDH
  const subscriberKey = await crypto.subtle.importKey(
    "raw",
    subscriberPubKeyRaw.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberKey },
      localKeyPair.privateKey,
      256
    )
  );

  // Export local public key
  const localPubKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Step 1: Derive IKM
  const authInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    subscriberPubKeyRaw,
    localPubKeyRaw
  );
  const ikm = await hkdf(authSecret, sharedSecret, authInfo, 32);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Step 2: Derive CEK and nonce
  const cek = await hkdf(
    salt,
    ikm,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16
  );
  const nonce = await hkdf(
    salt,
    ikm,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12
  );

  // Pad payload: content + delimiter (0x02)
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey("raw", cek.buffer as ArrayBuffer, "AES-GCM", false, [
    "encrypt",
  ]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce.buffer as ArrayBuffer },
      aesKey,
      paddedPayload
    )
  );

  // Build aes128gcm header: salt(16) + rs(4, big-endian) + idlen(1) + keyid(65)
  const headerBuf = new Uint8Array(86);
  headerBuf.set(salt, 0);
  new DataView(headerBuf.buffer).setUint32(16, 4096);
  headerBuf[20] = 65;
  headerBuf.set(localPubKeyRaw, 21);

  return concat(headerBuf, encrypted);
}

// --- Send Web Push ---
async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  privateKey: CryptoKey,
  publicKeyB64: string
): Promise<void> {
  const encrypted = await encryptPayload(payload, sub.p256dh, sub.auth);
  const authorization = await createVAPIDAuth(
    sub.endpoint,
    privateKey,
    publicKeyB64
  );

  const response = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
    },
    body: encrypted as unknown as BodyInit,
  });

  if (!response.ok) {
    const text = await response.text();
    const err: any = new Error(`Push failed: ${response.status} ${text}`);
    err.status = response.status;
    throw err;
  }
}

// --- Main server ---
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET: return VAPID public key
    if (req.method === "GET" && action === "vapid-key") {
      const { publicKeyB64 } = await getOrCreateVAPIDKeys(supabaseAdmin);
      return new Response(JSON.stringify({ publicKey: publicKeyB64 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: subscribe push
    if (req.method === "POST" && action === "subscribe") {
      const authHeader = req.headers.get("Authorization");
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(
        authHeader?.replace("Bearer ", "") || ""
      );
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { subscription } = await req.json();
      await supabaseAdmin.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { onConflict: "user_id,endpoint" }
      );

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: send push to conversation participants
    if (req.method === "POST" && action === "send-to-conversation") {
      const authHeader = req.headers.get("Authorization");
      const {
        data: { user: sender },
      } = await supabaseAdmin.auth.getUser(
        authHeader?.replace("Bearer ", "") || ""
      );
      if (!sender) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { conversation_id, title, body } = await req.json();
      const { privateKey, publicKeyB64 } =
        await getOrCreateVAPIDKeys(supabaseAdmin);

      // Get all participants except sender
      const { data: participants } = await supabaseAdmin
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversation_id)
        .neq("user_id", sender.id);

      let totalSent = 0;

      for (const p of participants || []) {
        // Get user's notification preview preference
        const { data: profileData } = await supabaseAdmin
          .from("profiles")
          .select("notification_preview")
          .eq("id", p.user_id)
          .maybeSingle();

        const previewPref = profileData?.notification_preview || "full";

        let pushTitle = title;
        let pushBody = body;

        if (previewPref === "partial") {
          pushBody = body && body.length > 40 ? body.slice(0, 40) + "…" : body;
        } else if (previewPref === "none") {
          pushTitle = "Shape Insano";
          pushBody = "Você recebeu uma nova mensagem";
        }

        // Get push subscriptions
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", p.user_id);

        const pushPayload = JSON.stringify({
          title: pushTitle,
          body: pushBody,
          data: { conversation_id },
        });

        for (const sub of subs || []) {
          try {
            await sendWebPush(sub, pushPayload, privateKey, publicKeyB64);
            totalSent++;
          } catch (e: any) {
            console.error("Push failed for sub:", sub.id, e.message);
            if (e.status === 410 || e.status === 404) {
              await supabaseAdmin
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
            }
          }
        }
      }

      return new Response(JSON.stringify({ sent: totalSent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: send push to a specific user (called by DB webhook/trigger)
    if (req.method === "POST" && action === "send-to-user") {
      const body = await req.json();
      const { user_id, title, body: notifBody, data } = body;

      if (!user_id || !title) {
        return new Response(JSON.stringify({ error: "user_id and title required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { privateKey, publicKeyB64 } = await getOrCreateVAPIDKeys(supabaseAdmin);

      // Get user's notification preview preference
      const { data: profileData } = await supabaseAdmin
        .from("profiles")
        .select("notification_preview")
        .eq("id", user_id)
        .maybeSingle();

      const previewPref = profileData?.notification_preview || "full";

      let pushTitle = title;
      let pushBody = notifBody || "";

      if (previewPref === "partial") {
        pushBody = pushBody.length > 40 ? pushBody.slice(0, 40) + "…" : pushBody;
      } else if (previewPref === "none") {
        pushTitle = "Shape Insano";
        pushBody = "Você tem uma nova notificação";
      }

      // Get all push subscriptions for this user
      const { data: subs, error: subsError } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", user_id);

      console.log("[push] send-to-user for:", user_id, "subs found:", subs?.length || 0, "error:", subsError?.message || "none");

      const pushPayload = JSON.stringify({
        title: pushTitle,
        body: pushBody,
        data: data || {},
      });

      let totalSent = 0;
      for (const sub of subs || []) {
        try {
          await sendWebPush(sub, pushPayload, privateKey, publicKeyB64);
          totalSent++;
          console.log("[push] Sent to user", user_id, "endpoint", sub.endpoint.slice(0, 50));
        } catch (e: any) {
          console.error("[push] Failed for sub:", sub.id, e.message);
          if (e.status === 410 || e.status === 404) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
            console.log("[push] Removed stale subscription:", sub.id);
          }
        }
      }

      console.log("[push] Total sent for user", user_id, ":", totalSent);
      return new Response(JSON.stringify({ sent: totalSent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
