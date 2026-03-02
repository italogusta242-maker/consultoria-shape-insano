# DATABASE_COMMANDS.md — Shape Insano

> Guia de consultas diretas, buscas inteligentes e controle em tempo real.

---

## 1. Consultas Diretas (CRUD Básico)

### 1.1 Profiles

```sql
-- Buscar perfil por ID
SELECT * FROM profiles WHERE id = '<user_id>';

-- Listar todos os alunos ativos
SELECT id, nome, email, status, created_at
FROM profiles
WHERE status = 'ativo'
ORDER BY nome;

-- Atualizar status de um aluno
UPDATE profiles SET status = 'inativo' WHERE id = '<user_id>';

-- Buscar alunos pendentes de onboarding
SELECT id, nome, email, created_at
FROM profiles
WHERE status = 'pendente_onboarding'
ORDER BY created_at DESC;
```

### 1.2 Gamificação

```sql
-- Ranking por XP (top 10)
SELECT g.user_id, p.nome, g.xp, g.level, g.streak, g.dracmas
FROM gamification g
JOIN profiles p ON p.id = g.user_id
ORDER BY g.xp DESC
LIMIT 10;

-- Alunos com streak ativo
SELECT g.user_id, p.nome, g.streak, g.max_streak, g.flame_percent
FROM gamification g
JOIN profiles p ON p.id = g.user_id
WHERE g.streak > 0
ORDER BY g.streak DESC;

-- Resetar flame de aluno específico
UPDATE gamification SET flame_percent = 0, streak = 0 WHERE user_id = '<user_id>';
```

### 1.3 Treinos (Workouts)

```sql
-- Últimos 10 treinos de um aluno
SELECT id, group_name, started_at, finished_at, duration_seconds, xp_earned, dracmas_earned
FROM workouts
WHERE user_id = '<user_id>'
ORDER BY started_at DESC
LIMIT 10;

-- Total de treinos por aluno no mês atual
SELECT user_id, COUNT(*) as total_treinos, SUM(xp_earned) as total_xp
FROM workouts
WHERE started_at >= date_trunc('month', now())
GROUP BY user_id
ORDER BY total_treinos DESC;

-- Média de duração dos treinos (em minutos)
SELECT user_id, AVG(duration_seconds / 60.0) as media_minutos
FROM workouts
WHERE duration_seconds IS NOT NULL
GROUP BY user_id;
```

### 1.4 Planos de Treino

```sql
-- Planos ativos de um aluno
SELECT id, title, total_sessions, specialist_id, created_at, updated_at
FROM training_plans
WHERE user_id = '<user_id>' AND active = true;

-- Planos vencidos (válidos até antes de hoje)
SELECT tp.id, tp.title, tp.user_id, p.nome, tp.valid_until
FROM training_plans tp
JOIN profiles p ON p.id = tp.user_id
WHERE tp.active = true AND tp.valid_until < CURRENT_DATE;

-- Desativar plano antigo
UPDATE training_plans SET active = false WHERE id = '<plan_id>';
```

### 1.5 Planos de Dieta

```sql
-- Dieta ativa de um aluno
SELECT id, title, meals, specialist_id, created_at
FROM diet_plans
WHERE user_id = '<user_id>' AND active = true;

-- Planos alimentares sem atualização há 30+ dias
SELECT dp.id, dp.title, dp.user_id, p.nome, dp.updated_at
FROM diet_plans dp
JOIN profiles p ON p.id = dp.user_id
WHERE dp.active = true
  AND dp.updated_at < now() - interval '30 days';
```

### 1.6 Banco de Alimentos

```sql
-- Buscar alimento por nome (case-insensitive)
SELECT * FROM food_database WHERE name ILIKE '%frango%' ORDER BY name;

-- Filtrar por categoria
SELECT * FROM food_database WHERE category = 'proteínas' ORDER BY name;

-- Alimentos com mais de 30g de proteína por porção
SELECT name, portion, protein, calories
FROM food_database
WHERE protein > 30
ORDER BY protein DESC;

-- Inserir novo alimento
INSERT INTO food_database (name, portion, calories, protein, carbs, fat, fiber, category, created_by)
VALUES ('Peito de Frango Grelhado', '100g', 165, 31, 0, 3.6, 0, 'proteínas', '<specialist_id>');

-- Deletar alimento
DELETE FROM food_database WHERE id = '<food_id>';
```

### 1.7 Templates

```sql
-- Templates de dieta por objetivo
SELECT id, name, description, goal, total_calories, total_protein
FROM diet_templates
WHERE goal = 'bulking'
ORDER BY total_calories;

-- Templates de treino de um especialista
SELECT id, name, description, groups, created_at
FROM training_templates
WHERE specialist_id = '<specialist_id>'
ORDER BY updated_at DESC;
```

---

## 2. Consultas Inteligentes (Analytics & Relatórios)

### 2.1 Dashboard Admin — Métricas Globais

```sql
-- Total de usuários por status
SELECT status, COUNT(*) as total
FROM profiles
GROUP BY status
ORDER BY total DESC;

-- Total por role
SELECT role, COUNT(*) as total
FROM user_roles
GROUP BY role;

-- Novos cadastros por semana (últimos 3 meses)
SELECT date_trunc('week', created_at) as semana, COUNT(*) as novos
FROM profiles
WHERE created_at >= now() - interval '3 months'
GROUP BY semana
ORDER BY semana;
```

### 2.2 Adesão e Engajamento

```sql
-- Alunos que NÃO treinaram nos últimos 7 dias
SELECT p.id, p.nome, p.email, g.last_training_date, g.streak
FROM profiles p
JOIN gamification g ON g.user_id = p.id
WHERE p.status = 'ativo'
  AND (g.last_training_date IS NULL OR g.last_training_date < CURRENT_DATE - 7)
ORDER BY g.last_training_date NULLS FIRST;

-- Média de água e refeições completadas (últimos 7 dias)
SELECT user_id,
  AVG(water_liters) as media_agua,
  AVG(array_length(completed_meals, 1)) as media_refeicoes
FROM daily_habits
WHERE date >= CURRENT_DATE - 7
GROUP BY user_id;

-- Taxa de adesão ao treino por aluno (mês atual)
SELECT
  w.user_id,
  p.nome,
  COUNT(DISTINCT w.started_at::date) as dias_treino,
  EXTRACT(DAY FROM now() - date_trunc('month', now()))::int as dias_mes,
  ROUND(
    COUNT(DISTINCT w.started_at::date)::numeric /
    NULLIF(EXTRACT(DAY FROM now() - date_trunc('month', now())), 0) * 100
  , 1) as taxa_pct
FROM workouts w
JOIN profiles p ON p.id = w.user_id
WHERE w.started_at >= date_trunc('month', now())
GROUP BY w.user_id, p.nome
ORDER BY taxa_pct DESC;
```

### 2.3 Análise de Especialistas

```sql
-- Quantidade de alunos por especialista
SELECT
  ss.specialist_id,
  p.nome as especialista,
  ss.specialty,
  COUNT(DISTINCT ss.student_id) as total_alunos
FROM student_specialists ss
JOIN profiles p ON p.id = ss.specialist_id
GROUP BY ss.specialist_id, p.nome, ss.specialty
ORDER BY total_alunos DESC;

-- Planos criados por especialista no mês
SELECT
  specialist_id,
  p.nome,
  COUNT(*) FILTER (WHERE tp.id IS NOT NULL) as planos_treino,
  COUNT(*) FILTER (WHERE dp.id IS NOT NULL) as planos_dieta
FROM profiles p
LEFT JOIN training_plans tp ON tp.specialist_id = p.id
  AND tp.created_at >= date_trunc('month', now())
LEFT JOIN diet_plans dp ON dp.specialist_id = p.id
  AND dp.created_at >= date_trunc('month', now())
WHERE p.id IN (SELECT user_id FROM user_roles WHERE role = 'especialista')
GROUP BY specialist_id, p.nome;
```

### 2.4 Check-ins Psicológicos

```sql
-- Média de humor e estresse por aluno (últimas 4 semanas)
SELECT
  user_id,
  ROUND(AVG(mood), 1) as media_humor,
  ROUND(AVG(stress), 1) as media_estresse,
  ROUND(AVG(sleep_quality), 1) as media_sono
FROM psych_checkins
WHERE created_at >= now() - interval '28 days'
GROUP BY user_id;

-- Alunos com humor abaixo de 2 (alerta)
SELECT pc.user_id, p.nome, pc.mood, pc.stress, pc.notes, pc.created_at
FROM psych_checkins pc
JOIN profiles p ON p.id = pc.user_id
WHERE pc.mood <= 2 AND pc.created_at >= now() - interval '7 days'
ORDER BY pc.created_at DESC;
```

### 2.5 Convites e Conversão

```sql
-- Taxa de conversão de convites
SELECT
  status,
  COUNT(*) as total,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) as pct
FROM invites
GROUP BY status;

-- Convites por closer
SELECT
  i.created_by,
  p.nome as closer,
  COUNT(*) as total_convites,
  COUNT(*) FILTER (WHERE i.status = 'used') as convertidos
FROM invites i
JOIN profiles p ON p.id = i.created_by
GROUP BY i.created_by, p.nome
ORDER BY total_convites DESC;
```

---

## 3. Controle em Tempo Real (Realtime)

### 3.1 Tabelas com Realtime Habilitado

Para habilitar realtime em uma tabela:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.<table_name>;
```

### 3.2 Subscriptions no Frontend (TypeScript)

```typescript
import { supabase } from "@/integrations/supabase/client";

// ─── Chat: ouvir novas mensagens ───
const channel = supabase
  .channel("chat-messages")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "chat_messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      console.log("Nova mensagem:", payload.new);
    }
  )
  .subscribe();

// ─── Notificações: ouvir novas notificações ───
const notifChannel = supabase
  .channel("notifications")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      console.log("Nova notificação:", payload.new);
    }
  )
  .subscribe();

// ─── Cleanup (sempre no unmount) ───
supabase.removeChannel(channel);
```

### 3.3 Presence (Presença Online)

```typescript
import { supabase } from "@/integrations/supabase/client";

// ─── Rastrear presença de usuários ───
const presenceChannel = supabase.channel("global-presence", {
  config: { presence: { key: userId } },
});

presenceChannel
  .on("presence", { event: "sync" }, () => {
    const state = presenceChannel.presenceState();
    const onlineUsers = Object.keys(state);
    console.log("Usuários online:", onlineUsers);
  })
  .on("presence", { event: "join" }, ({ key }) => {
    console.log("Entrou:", key);
  })
  .on("presence", { event: "leave" }, ({ key }) => {
    console.log("Saiu:", key);
  })
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await presenceChannel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
      });
    }
  });

// ─── Cleanup ───
presenceChannel.untrack();
supabase.removeChannel(presenceChannel);
```

### 3.4 Typing Indicators (Chat)

```typescript
// ─── Canal de digitação por conversa ───
const typingChannel = supabase.channel(`typing:${conversationId}`, {
  config: { presence: { key: userId } },
});

// Indicar que está digitando
await typingChannel.track({ typing: true });

// Parar de indicar
await typingChannel.untrack();

// Ouvir quem está digitando
typingChannel.on("presence", { event: "sync" }, () => {
  const state = typingChannel.presenceState();
  const typingUsers = Object.entries(state)
    .filter(([_, data]) => (data as any)[0]?.typing)
    .map(([key]) => key);
  console.log("Digitando:", typingUsers);
});
```

---

## 4. Funções do Banco (Database Functions)

| Função | Tipo | Propósito |
|--------|------|-----------|
| `has_role(user_id, role)` | `SECURITY DEFINER` | Verifica role sem recursão RLS |
| `is_conversation_participant(user_id, conv_id)` | `SECURITY DEFINER` | Verifica participação em conversa |
| `handle_new_user()` | `TRIGGER` | Auto-cria profile + gamification no signup |
| `auto_create_conversations()` | `TRIGGER` | Cria conversa ao vincular aluno↔especialista |
| `notify_plan_created()` | `TRIGGER` | Notifica aluno quando plano é criado |
| `notify_chat_message()` | `TRIGGER` | Notifica participantes de nova mensagem |
| `update_updated_at_column()` | `TRIGGER` | Atualiza `updated_at` automaticamente |

### Uso no Frontend

```typescript
// Verificar role (via RPC)
const { data } = await supabase.rpc("has_role", {
  _user_id: userId,
  _role: "admin",
});
// data = true | false
```

---

## 5. Edge Functions (Funções Serverless)

| Função | Método | JWT | Propósito |
|--------|--------|-----|-----------|
| `create-invite` | POST | ❌ | Cria convite + conta de aluno |
| `admin-create-user` | POST | ✅ | Cria usuário com role específico |
| `push-notifications` | POST | ❌ | Envia Web Push via VAPID |
| `daily-flame-check` | POST | ✅ | Cron: verifica streaks diários |
| `check-stale-plans` | POST | ✅ | Cron: alerta planos desatualizados |
| `asaas-webhook` | POST | ❌ | Webhook de pagamentos Asaas |

### Invocar Edge Function

```typescript
const { data, error } = await supabase.functions.invoke("push-notifications", {
  body: { user_id: userId, title: "Hora do treino!", body: "Bora treinar 💪" },
});
```

---

## 6. Referência Rápida de Filtros (Supabase SDK)

```typescript
// Igualdade
.eq("status", "ativo")

// Diferente
.neq("status", "inativo")

// Maior que / Menor que
.gt("xp", 1000)
.lt("streak", 3)
.gte("level", 5)
.lte("flame_percent", 50)

// LIKE (case-insensitive)
.ilike("name", "%frango%")

// IN (lista de valores)
.in("category", ["proteínas", "carboidratos"])

// Range de datas
.gte("created_at", "2026-01-01")
.lte("created_at", "2026-01-31")

// NULL check
.is("specialist_id", null)
.not("specialist_id", "is", null)

// Ordenação + Limite
.order("created_at", { ascending: false })
.limit(20)

// Contagem sem retornar dados
.select("*", { count: "exact", head: true })

// JSON contains (para colunas JSONB)
.contains("metadata", { plan_type: "training" })
```

---

*Documento gerado para o projeto Shape Insano — atualizado em 2026-02-21*
