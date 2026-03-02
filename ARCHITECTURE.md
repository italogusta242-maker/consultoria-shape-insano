# ARCHITECTURE.md — Shape Insano

> Última atualização: 2026-02-21

## Visão Geral

Shape Insano é uma plataforma de acompanhamento fitness com 5 portais segmentados por papel (role):

| Portal | Role | Rota Base | Propósito |
|--------|------|-----------|-----------|
| Coliseu | `user` | `/` | Portal do Aluno — treinos, dieta, gamificação |
| Forja | `especialista` | `/especialista` | Portal do Especialista — prescrição de planos |
| Quartel General | `admin` | `/admin` | Gestão da plataforma |
| Portal Closer | `closer` | `/closer` | Vendas e convites |
| Portal CS | `cs` | `/cs` | Customer Success |

## Stack Tecnológica

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **UI Kit**: shadcn/ui (Radix primitives)
- **Estado**: React Query (server state) + useState (local state)
- **Animações**: Framer Motion
- **Backend**: Supabase (Lovable Cloud) — Auth, PostgreSQL, Realtime, Storage, Edge Functions
- **PWA**: vite-plugin-pwa + Web Push Notifications

## Fluxo de Dados

```
┌──────────────────────────────────────────────────┐
│                    Frontend                       │
│                                                   │
│  Pages ──▶ Components ──▶ Hooks ──▶ Services     │
│    │                        │          │          │
│    └── UI (shadcn)          │      Supabase SDK   │
│                             │          │          │
│                          Types ◀───────┘          │
└──────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Supabase Cloud    │
                    │                     │
                    │  ┌── Auth ────────┐ │
                    │  ├── PostgreSQL ──┤ │
                    │  ├── Realtime ────┤ │
                    │  ├── Storage ─────┤ │
                    │  └── Edge Funcs ──┘ │
                    └─────────────────────┘
```

## Estrutura de Pastas

```
src/
├── assets/          # Imagens e SVGs estáticos
├── components/      # Componentes React (UI pura + composição)
│   ├── ui/          # shadcn/ui primitives
│   ├── admin/       # Componentes do portal Admin
│   ├── especialista/# Componentes do portal Especialista
│   ├── chat/        # Componentes do sistema de chat
│   ├── closer/      # Componentes do portal Closer
│   └── cs/          # Componentes do portal CS
├── contexts/        # React Contexts (AuthContext)
├── hooks/           # Custom hooks (lógica de estado e negócio)
├── lib/             # Utilitários puros (dateUtils, calcAge, etc.)
├── pages/           # Páginas/rotas do app
├── services/        # Camada de serviço (chamadas Supabase abstraídas)
├── types/           # Interfaces e tipos compartilhados
└── integrations/    # Auto-gerado (Supabase client + types)
```

## Camadas e Responsabilidades

### 1. Pages (`src/pages/`)
- Composição de layout + componentes
- Mínima lógica de negócio
- Recebem dados via hooks

### 2. Components (`src/components/`)
- UI pura quando possível (props in, JSX out)
- Componentes > 150 linhas devem ser decompostos
- Sem chamadas diretas ao Supabase

### 3. Hooks (`src/hooks/`)
- Encapsulam React Query + lógica de estado
- Único ponto de mutação de dados (via services)
- Reutilizáveis entre portais

### 4. Services (`src/services/`)
- Camada de abstração sobre o Supabase SDK
- Funções puras async/await
- Sem dependência de React (sem hooks)
- Tratamento de erros centralizado

### 5. Types (`src/types/`)
- Interfaces compartilhadas entre camadas
- Single source of truth para shapes de dados
- Exportados via barrel (`types/index.ts`)

### 6. Utils (`src/lib/`)
- Funções puras sem side-effects
- Cálculos, formatação, validação

## Autenticação e RBAC

```
Login ──▶ AuthContext verifica sessão
              │
              ├── Busca role em user_roles
              ├── Redireciona para portal correto
              └── Guards por especialidade (useSpecialtyGuard)

RLS no banco garante isolamento de dados por user_id/role.
```

## Realtime

- **Chat**: Supabase Realtime (postgres_changes) + Presence channels
- **Presença Global**: Canal `global-presence` para overlay Admin
- **Typing Indicators**: Canais de presence por conversa

## Edge Functions

| Função | Propósito |
|--------|-----------|
| `create-invite` | Criar convite + conta de aluno (closer) |
| `admin-create-user` | Criar usuário com role específico |
| `push-notifications` | Enviar Web Push via VAPID |
| `daily-flame-check` | Cron: verificar streaks diários |
| `check-stale-plans` | Cron: alertar planos vencidos |
| `asaas-webhook` | Webhook de pagamentos |

## Segurança

- RLS habilitado em **todas** as tabelas
- `has_role()` SECURITY DEFINER para evitar recursão
- Service Role Key apenas em Edge Functions
- Roles em tabela separada (`user_roles`), nunca em `profiles`
- CPF limpo e tratado antes de uso como senha
