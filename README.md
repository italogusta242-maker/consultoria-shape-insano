<div align="center">
  <img src="./public/insano-logo.png" alt="Logo Shape Insano" width="250" />
</div>

<h1 align="center">Shape Insano 🦍🔥</h1>

<p align="center">
  <b>SaaS de Acompanhamento Fitness Avançado com Gamificação Intensa</b>
</p>

---

## 📌 O que é o projeto?

**Shape Insano** é uma plataforma focada no acompanhamento integrado de treinos, nutrição e gestão comportamental de saúde, desenvolvida com um forte viés de **gamificação** e **retenção de disciplina**. 

O objetivo do sistema é unir, em um único local, a prescrição profissional por parte de especialistas (nutricionistas e treinadores) e o acompanhamento prático, engajador e recompensador para o aluno no dia a dia. Tudo gira em torno de métricas de consistência, em especial a **Chama de Honra**, um índice visual de constância de cada usuário que estimula a aderência duradoura à rotina proposta.

---

## 🚀 Como Funciona?

O sistema obedece a uma arquitetura multicamadas e é dividido em **5 Portais Distintos**, blindados por autenticação baseada em roles (RBAC) e proteção nativa no banco de dados, para garantir a segurança dos dados e ferramentas dedicadas do dia a dia a cada perfil de acesso:

### 1. 🏛️ O Coliseu (Alunos)
- **Dashboard Principal:** Interface principal do aluno, listando a evolução da "Chama de Honra" e Streaks diários.  
- **Treinos e Dietas:** Acompanhamento interativo do treino atual com painel de métricas (cargas e cronômetro), checklist visual diário da dieta recomendada pelo especialista e tracking de ingestão de água.  
- **Acompanhamento de Evolução:** Avaliação física com registro de medidas/fotografias e ferramenta de self-check de "Estado Mental" atual.  
- **Chat:** Interface de contato direto com nutri/treinador focado unicamente no acompanhamento.

### 2. ⚔️ A Forja (Especialistas - Nutricionistas e Preparadores Físicos)
- **Gestão Individual de Alunos:** O especialista gerencia anamneses, monta dietas calculadas em macros e prescreve planos de treino adaptados a cada aluno.  
- **Isolamento Profissional Estrutural:** Nutricionistas não enxergam informações clínicas preenchidas para/por preparadores físicos nas anamneses de avaliação física geral das outras frentes _(Split-View com modo borrado ou censura total)_ para aderência às regulações estritas de sigilo profissional ao usuário avaliado.

### 3. 💪 Portal Closer (Vendas & Onboarding)  
- Setor dedicado aos contatos iniciais, análise de risco, criação de convites (`invite-links`) e vinculação do novo aluno a seus respectivos profissionais da equipe da empresa logada na plataforma.

### 4. 🛟 Portal CS (Customer Success)
- Acompanhamento especializado das taxas de **Retenção** através da observação dos índices de engajamento do projeto. Aciona medidas para clientes correndo risco de _Churn_ (desistência), orientando-se por alertas da "Chama de Honra Extinta", quedas em Streaks, e falta de resposta de conversas no sistema com os especialistas.

### 5. 👑 Quartel General (Administradores)
- Visão panorâmica dos recursos, auditorias profundas, gestão direta do cadastro global e atribuição fina de roles a todos através de painéis consolidados para acompanhamento diário ao estilo _Control Tower_.

---

## 🎮 Gamificação: A "Chama de Honra"

O coração do engajamento do Shape Insano se baseia num sistema dinâmico e implacável para fomentar a consistência:
- **Streaks**: Contagem exata em dias ininterruptos de execução dos protocolos.   
- **Daily Check e Perda Contínua**: Rotinas diárias _(Edge Functions, server-driven)_ penalizam alunos que ficam "off-grid" no sistema decrementando sua constância, incentivando não a punição total momentânea, mas o dever de persistência a longo-prazo; quem atinge e mantém altos índices desbloqueia recursos cosméticos da Plataforma, recebendo emblemas de conquista e recompensas virtuais no seu perfil atreladas diretamente a saúde aplicada na vida real dele. 

---

## 🛠️ Tecnologias Utilizadas

Este projeto está hospedado no formato Serverless em forte simbiose com Supabase Cloud:

- **Frontend:**
  - `React 18`, `TypeScript`, `Vite` e componentes modulares via `shadcn/ui` + `Tailwind CSS`.
  - PWA (`vite-plugin-pwa`) para uso da solução em estilo App Nativo para mobile e suporte a Web Push Notifications.
  - Abstração central com `React Query` unificando cache local.
  - Animação e dinamismo de UX (`Framer Motion`).

- **Backend (Lovable Cloud / Supabase):**
  - **Identidade:** `Supabase Auth`.
  - **Banco de Dados (DB):** `PostgreSQL` unificado, mantido em instâncias com RLS rigoroso habilitado impedindo qualquer extração sem um role válido no banco (Row Level Security).  
  - **Lógicas Avançadas Temporizadas:** Serveless _Edge-Functions_ (Deno), controlando envios assíncronos de relatórios, Webhooks de Pagamento (Asaas), cron para "perda diária de Streaks / Chama de Honra", processamento agendado de e-mails/alertas globais. 
  - **Realtime:** Chat assíncrono nativo para interação do cliente final sob `PostgreSQL Changes + Presence` garantindo uma comunicação online rápida sem instâncias WebSockets secundárias.

---

### Execução Local

```sh
# Clone o repositório 
git clone <GIT_URL>

# Instale as dependências usando Bun/NPM
npm i

# Incie o Servidor de Desenvolvimento
npm run dev
```
