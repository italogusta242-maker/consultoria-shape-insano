# SHAPE INSANO — Escopo Completo do Projeto

**Versão:** 1.0  
**Data:** 2026-02-13  
**Status:** MVP Frontend-only (dados mockados, sem persistência real)

---

## 1. VISÃO GERAL

**SHAPE INSANO** é um SaaS de fitness gamificado com temática de Roma Antiga e Estoicismo. Integra mecânicas de RPG (classes, ligas, XP, moedas) com personalização de treino, nutrição e suporte psicológico, operando em 3 portais: **Aluno**, **Especialista** e **Admin**.

### 1.1 Stack Técnica
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **UI:** shadcn/ui + Framer Motion + Recharts
- **Backend (futuro):** Supabase (Lovable Cloud) — auth, DB, edge functions, storage
- **Tema visual:** Dark-only, paleta obsidian/gold/crimson, fonte Cinzel (títulos) + Inter (corpo)

### 1.2 Design System
| Token | HSL | Uso |
|-------|-----|-----|
| `--background` | 0 0% 4% | Fundo principal (obsidian) |
| `--primary` | 0 100% 27% | Crimson — botões de ação, CTA |
| `--accent` | 43 76% 53% | Gold — XP, moedas, destaques |
| `--card` | 0 0% 10% | Cards, superfícies elevadas |
| `--dishonor-*` | 260° frios | Modo desonra (chama apagada) |

### 1.3 Perfis de Acesso
| Perfil | Rota base | Descrição |
|--------|-----------|-----------|
| **Aluno** | `/` | Usuário final que treina |
| **Especialista** | `/especialista` | Nutricionista, personal, psicólogo |
| **Admin** | `/admin` | Gestão da plataforma |

---

## 2. PORTAL DO ALUNO

### 2.1 Autenticação (`/auth`)
**Arquivo:** `src/pages/AuthPage.tsx`

- **Landing:** Logo SHAPE INSANO animado, frase estoica, botões "Criar Conta" e "Já Tenho Conta"
- **Login:** Email + senha, toggle mostrar senha, feedback de erro, loading state
- **Registro:** Nome + email + senha (mín. 6 chars), confirmação por email
- **Fluxo:** Após login → verifica `onboarded` → se false → Onboarding; se true → Dashboard
- **Visual:** Background com imagem (`auth-bg.jpg`), gradients overlay, efeito glassmorphism

**Regras de negócio:**
- Email deve ser verificado antes do primeiro acesso (Supabase auth)
- Senha mínima: 6 caracteres
- Auto-confirm desabilitado por padrão

### 2.2 Onboarding (`/onboarding`)
**Arquivo:** `src/pages/Onboarding.tsx` + `src/pages/onboarding/constants.ts`

Fluxo linear de 12 etapas com stepper visual:

| # | Step | Dados coletados |
|---|------|-----------------|
| 1 | `welcome` | Nenhum — tela de boas-vindas temática |
| 2 | `cadastro` | Nome, email, telefone, nascimento, CPF, cidade/estado, sexo, faixa etária, altura, peso, tempo que acompanha @iigorcorrea, fatores de escolha, indicação (nome + telefone) |
| 3 | `fotos` | 5 fotos posturais: frente, costas, perfil direito, esquerdo, teste sentar-e-alcançar. Referências visuais com imagens exemplo. |
| 4 | `objetivo` | Objetivo principal (massa/gordura/profissionais/outro), pretende fisiculturismo (+ fotos de pose se sim), influenciador favorito |
| 5 | `treino` | Pratica musculação (sim/não), local de treino (academia/casa/ambos), equipamentos em casa, dias da semana, frequência, horário, duração, tempo de cardio, upload treino antigo |
| 6 | `academia` | Grupos musculares prioritários, dores atuais, exercícios que não gosta, máquinas que NÃO tem na academia (lista de 30+ máquinas) |
| 7 | `saude` | Doenças (diabetes, pressão, colesterol, câncer, depressão, ansiedade, etc.), histórico familiar, medicamentos, alergias |
| 8 | `nutricional` | Nível de atividade, média de passos, cardio, refeições/dia, horários, calorias atuais, restrições alimentares, frutas que come, suplementos |
| 9 | `estilo_vida` | Horário de sono, qualidade do sono, alimentos diários, alimentos que não come, consumo de água, líquido nas refeições, investimento em dieta, faixa salarial |
| 10 | `quiz` | 5 perguntas do "Oráculo" para determinar a classe (cada opção mapeia para uma classe) |
| 11 | `result` | Resultado da classe com nome, subtítulo e descrição |
| 12 | `ignite` | Ritual de acender a Chama de Vesta — marca `onboarded = true` |

**Classes (resultado do quiz):**
| Classe | Perfil | Visual |
|--------|--------|--------|
| **Gladius** | Hipertrofia, estética, volume muscular | Vermelho escuro |
| **Velite** | Agilidade, resistência, cardio | Azul escuro |
| **Centurio** | Força bruta, potência, carga máxima | Âmbar escuro |

**Regras de negócio:**
- Campos obrigatórios marcados com `*` (nome, email, telefone, nascimento, etc.)
- Fotos são FileUpload (atualmente local, futuro: Supabase Storage)
- Quiz usa contagem de votos — classe com mais respostas vence
- Dados são submetidos via `submitAnamnese()` (atualmente mock, futuro: Supabase insert)
- Ao completar, seta `onboarded = true` no perfil

### 2.3 Dashboard (`/`)
**Arquivo:** `src/pages/Dashboard.tsx`

**Layout responsivo:** Mobile-first com layout diferente para desktop

**Componentes do Dashboard:**

#### 2.3.1 Header
- Logo SHAPE INSANO + saudação "Ave, Guerreiro"
- Contador de streak (dias) com ícone de chama
- Saldo de Dracmas

#### 2.3.2 StatsBar (4 indicadores)
| Indicador | Fonte | Descrição |
|-----------|-------|-----------|
| Performance | Score 0-100 | Baseado em consistência e carga (futuro: calculado pela IA) |
| Treino Hoje | Tipo + duração | Ex: "HIIT 45 min" |
| Calorias | Consumo/Meta | Ex: "1.250/2.400" — entrada manual futura |
| Mental | Check-in diário | Mostra o estado do último check-in |

#### 2.3.3 Daily Check-In
- Modal que aparece 1x por dia (controle via localStorage)
- 5 opções de estado mental: Focado, Motivado, Cansado, Estressado, Triste
- Cada estado tem ícone, cor e label
- Afeta o indicador "Mental" na StatsBar
- **Futuro:** Alimenta IA Sêneca para ajustar intensidade

#### 2.3.4 Barra de XP
- Mostra nível atual, liga, XP atual/meta
- Barra de progresso animada com gradient gold
- Labels: Plebe → Legionário → Centurião → Pretoriano

#### 2.3.5 Botão "ENTRAR EM BATALHA"
- CTA principal, crimson gradient, link para `/batalha`
- Em modo desonra: gradient roxo com sombra maior

#### 2.3.6 Gráficos
- **Performance semanal:** AreaChart (7 dias)
- **Volume semanal:** BarChart (4 semanas, kg total)

#### 2.3.7 Insight de IA (rotativo)
- Roda entre 6 insights mockados dos 3 mentores
- Cada mentor tem cor e ícone distintos
- Troca a cada 20 segundos com animação fade

#### 2.3.8 Frase Estoica (rotativa)
- 10 frases de Sêneca, Marco Aurélio, Epicteto, Horácio
- Troca a cada 30 segundos (15s em modo desonra)

#### 2.3.9 Botão Dieta
- Link para `/dieta` com ícone UtensilsCrossed

#### 2.3.10 Chama de Vesta
**Componente:** `src/components/ChamaDeVesta.tsx`
- Visualização da chama com streak atual e recorde
- Animação SVG com brilho pulsante
- **Ativa (streak > 0):** Chama dourada brilhante
- **Apagada (streak = 0):** Cinzas, sem brilho

#### 2.3.11 Modo Desonra (Dishonor Mode)
Ativado quando `streak === 0` ou toggle de dev:
- Toda a UI muda para paleta fria (roxo/cinza)
- Vinheta escura nas bordas
- Banner de alerta: "TUA CHAMA SE EXTINGUIU"
- Frases e insights mudam para tom confrontacional
- Cards ficam dessaturados (50% opacity, 30% saturation)
- Objetivo psicológico: criar desconforto visual que motive retorno

### 2.4 Modo Batalha (`/batalha`)
**Arquivo:** `src/pages/BattleMode.tsx`

**Funcionalidade:** Execução do treino do dia com tracking de séries em tempo real.

**Componentes:**
- **Timer:** Cronômetro correndo durante toda a batalha, estilo digital com pulse-glow
- **Lista de exercícios:** Accordion com 5 exercícios mockados
- **Por exercício:**
  - Nome + indicador de vídeo (botão Play)
  - Séries expansíveis com grid: Série | Carga (kg) | Reps | Confirmar
  - Pré-preenchido com dados da última sessão (mock history)
  - Botão "OK" para confirmar série → muda para check verde
  - Exercício concluído: risca nome, mostra check gold

**Histórico de sessão:**
- `lastSessionHistory`: objeto mockado com pesos e reps por exercício
- Exercícios novos começam sem pré-preenchimento
- **Futuro:** buscar do DB, comparar evolução

**Fluxo de conclusão:**
1. Todas as séries confirmadas → `complete = true`
2. Timer para
3. Tela de vitória: "VITÓRIA!" com ícone de chama brilhante
4. Resumo: volume total por exercício e agregado (kg)
5. Recompensas: +350 XP, +50 Dracmas
6. Botão "VOLTAR À ARENA" → navega para `/`

**Regras de negócio:**
- Não permite confirmar série sem carga E reps preenchidos
- XP e dracmas são adicionados via `useAddXpAndDracmas` (mock)
- **Futuro:** salvar workout no Supabase (tabela `workouts`)

### 2.5 Mentores (`/mentores`)
**Arquivo:** `src/pages/Mentores.tsx`

3 mentores IA com chat simulado:

| Mentor | Especialidade | Cor | Ícone |
|--------|---------------|-----|-------|
| **Mars** | Treino / Estratégia Física | Vermelho | Sword |
| **Ceres** | Nutrição | Verde | Leaf |
| **Seneca** | Psicologia Estoica | Âmbar | Building2 |

**Fluxo:**
1. Tela de seleção: 3 cards com avatar, nome, título
2. Clica no mentor → abre chat
3. Greeting message do mentor
4. User digita → resposta aleatória do pool (5 por mentor)
5. Botão voltar para trocar de mentor

**Futuro:**
- Integrar com Lovable AI para respostas reais
- Mars analisa dados de treino, Ceres analisa dieta, Seneca usa check-in mental
- Cada mentor mantém contexto da conversa

### 2.6 Coliseu (`/coliseu`)
**Arquivo:** `src/pages/Coliseu.tsx`

**Funcionalidade:** Sistema de ligas e leaderboard competitivo.

**Ligas:**
| Liga | XP Range | Ícone | Cor |
|------|----------|-------|-----|
| Plebe | 0 - 5.000 | Users | Gray |
| Equites | 5.001 - 10.000 | Sword | Blue |
| Legionários | 10.001 - 15.000 | Shield | Purple |
| Pretorianos | 15.001+ | Crown | Gold |

**Componentes:**
- Barra de progressão visual (4 ícones de liga)
- Card de progresso: XP atual/meta + barra + "Faltam X XP"
- Bônus de promoção: Dracmas + Título + XP bônus (+ Skin exclusiva para Pretorianos)
- Leaderboard: ranking dos jogadores da liga atual (6 mockados)
- Destaque do usuário com gold-shadow

### 2.7 Dieta (`/dieta`)
**Arquivo:** `src/pages/Dieta.tsx`

**Funcionalidade:** Visualização do plano alimentar diário.

- **Macros totais:** Calorias, Proteína, Carbs, Gordura (4 cards com cores distintas)
- **6 refeições mockadas:** Café, Lanche manhã, Almoço, Pré-treino, Pós-treino, Jantar
- **Por refeição:** Horário, nome, itens, macros individuais (P/C/G)
- **Visual:** Cards com ícone Clock, Flame para calorias

**Futuro:**
- Plano gerado pela IA baseado na anamnese nutricional
- Edição pelo especialista
- Check de refeição feita pelo aluno
- Tracking de calorias vs meta

### 2.8 Perfil (`/perfil`)
**Arquivo:** `src/pages/Perfil.tsx`

- **Avatar:** Placeholder SVG (capacete romano), badge de nível
- **Info:** Nome, classe, liga
- **Barra de XP:** Nível + progresso
- **Stats grid (2x2):** Sequência (streak/recorde), Liga (nível), XP Total (classe), Dracmas
- **Conquistas recentes:** 4 badges mockados (Primeiro Sangue, Semana de Fogo, Centurião, Indestrutível)
- **Botão Sair:** Chama `signOut()`

**Futuro:**
- Edição de dados pessoais
- Upload de foto de perfil
- Histórico de conquistas completo
- Galeria de evolução física (fotos mensais)

---

## 3. PORTAL DO ESPECIALISTA

### 3.1 Layout
**Arquivo:** `src/components/especialista/EspecialistaLayout.tsx`

Sidebar com navegação:
- Dashboard
- Meus Alunos
- Editor de Planos
- Chat
- Perfil

### 3.2 Dashboard (`/especialista`)
**Arquivo:** `src/pages/especialista/EspecialistaDashboard.tsx`

**KPIs (4 cards):**
| Métrica | Valor mock |
|---------|------------|
| Meus Alunos | 24 |
| Em Alerta | 3 |
| Revisões Pendentes | 5 |
| Chama Média | 72% |

**SLA - Entregas no Prazo:**
- Card com percentual do mês (ex: 86%, 18/21 entregas)
- Barra de progresso
- Alerta visual se < 80% ("Risco de Yellow Flag")

**Análises para Entregar:**
- Lista de anamneses pendentes com countdown
- Cada item mostra: nome do aluno, tipo (primeira/acompanhamento), SLA (72h/24h), horas restantes
- Cores: verde (> 12h), amarelo (6-12h), vermelho (< 6h)

**Alertas:** Lista de alunos com problemas (chama apagada, queda de adesão)

**Revisões Pendentes:** Planos de treino/dieta que precisam de revisão

### 3.3 Meus Alunos (`/especialista/alunos`)
**Arquivo:** `src/pages/especialista/EspecialistaAlunos.tsx`

**Lista de alunos** com:
- Avatar, nome, classe, liga, XP
- Badge de status da anamnese:
  - `Atrasada Xd` (vermelho) — quando passou dos 30 dias
  - `Em Xd` (amarelo) — quando faltam ≤ 5 dias
  - `Em Xd` (outline) — quando faltam > 5 dias
- Chama (%) com cor gradual
- Status: ativo/alerta/inativo
- Botão "Solicitar" → toast de confirmação
- Botão "Ver Resumo" → modal com perfil completo

**Modal de Resumo Completo:**
- Dados pessoais (email, telefone, nascimento, gênero)
- Perfil físico (peso, altura, objetivo, experiência, frequência, lesões, esporte)
- Perfil nutricional (restrições, refeições, suplementos, hidratação, álcool)
- Perfil psicológico (estresse 1-5, qualidade sono, horas sono, dificuldade, risco desistência)
- Gamificação (XP, liga, classe, streak, chama)

### 3.4 Editor de Planos (`/especialista/planos`)
**Arquivo:** `src/pages/especialista/EspecialistaPlanos.tsx`

- Tabs: Todos / Treinos / Dietas
- Cards por plano: aluno, tipo, status (ativo/pendente/revisão), última atualização
- Badge "Sugestão IA" quando IA gerou sugestão
- Botão "Editar" em cada plano

**Futuro:**
- Editor completo de treino (arrastar exercícios, configurar séries/cargas)
- Editor de dieta (refeições, macros, substituições)
- IA gerando planos base para revisão humana

### 3.5 Chat (`/especialista/chat`)
**Arquivo:** `src/pages/especialista/EspecialistaChat.tsx`

- Lista de conversas (esquerda): nome, classe, última mensagem, horário, badge de não-lidos
- Área de chat (direita): mensagens estilo WhatsApp
- Toggle "Agente IA" no header:
  - **ON:** IA sugere respostas para o especialista
  - **OFF:** Chat estritamente humano
- Input de texto + botão enviar

### 3.6 Perfil do Especialista (`/especialista/perfil`)
**Arquivo:** `src/pages/especialista/EspecialistaPerfil.tsx`

- Dados profissionais
- Configurações de notificação
- **Futuro:** Upload de credenciais, horários de disponibilidade

---

## 4. PORTAL ADMIN

### 4.1 Layout
**Arquivo:** `src/components/admin/AdminLayout.tsx`

Sidebar com navegação:
- Quartel General (Dashboard)
- Usuários
- Planos
- Especialistas
- Comunicação
- Relatórios
- Importar Alunos
- Configurações

### 4.2 Dashboard Admin (`/admin`)
**Arquivo:** `src/pages/admin/AdminDashboard.tsx`

**KPIs (4 cards):**
- Usuários Ativos: 2.847 (+12%)
- Chama Acesa: 89% (+3%)
- Retenção 30d: 76% (-2%)
- Alertas: 23 (+5)

**Gráficos:**
- Engajamento semanal (AreaChart): ativos, treinos, batalhas
- Distribuição por liga (PieChart donut)

**Tabelas:**
- Alertas de inatividade (nome, dias sem atividade, liga, chama%)
- Top guerreiros (nome, XP, liga, streak)

### 4.3 Gestão de Usuários (`/admin/usuarios`)
**Arquivo:** `src/pages/admin/AdminUsuarios.tsx`

**Resumo:** 4 cards (Total, Ativos, Em Alerta, Inativos)

**Busca:** Por nome ou email

**Tabela de usuários:**
| Coluna | Detalhe |
|--------|---------|
| Usuário | Nome + classe + email |
| Liga | Badge |
| Chama | % com ícone colorido |
| Adesão | Barra de progresso |
| Status | ativo/alerta/inativo com cor |
| Ações | Ver (modal), Mensagem |

**Modal "Ver Resumo":** Mesmo formato do especialista (4 seções: pessoal, físico, nutricional, psicológico)

**Dialog "Nova Conta" (expandido):**
- Nome*, email*, senha*
- Telefone, nascimento, peso, altura
- Objetivo (select), experiência (select), local de treino
- Especialista atribuído (select)
- Toggle "Pular onboarding" — marca aluno como `onboarded = true`

### 4.4 Editor de Planos Admin (`/admin/planos`)
**Arquivo:** `src/pages/admin/AdminPlanos.tsx`

3 tabs:
1. **Treino:** Plano de treino de um aluno com exercícios editáveis (hover para editar)
2. **Nutrição:** Plano nutricional com refeições e macros
3. **Histórico:** Timeline de alterações (data, autor IA/humano, descrição)

**Banner de sugestão IA:** Recomendação contextual com botões "Aplicar" / "Ignorar"

### 4.5 Gestão de Especialistas (`/admin/especialistas`)
**Arquivo:** `src/pages/admin/AdminEspecialistas.tsx`

**Resumo:** 4 cards (Total, Online, Yellow Flags, Red/Black Flags)

**Card por especialista:**
- Avatar + nome + role + status (online/offline)
- Badge de flag atual (Green/Yellow/Red/Black)
- Histórico de flags (últimos 3 meses como chips coloridos)
- Barra de carga de trabalho (users/maxUsers)
- Mini grid (4 métricas): Satisfação, No Prazo%, Retenção%, Tempo de Entrega
- Botões: Usuários, Métricas, Mensagem

**Modal de Métricas Detalhadas:**
**Componente:** `src/components/admin/SpecialistMetricsModal.tsx`

| Métrica | Descrição | Meta |
|---------|-----------|------|
| Tempo médio 1ª análise | Horas até entregar primeira anamnese | ≤ 72h |
| Tempo médio acompanhamento | Horas até entregar análises mensais | ≤ 24h |
| Taxa de entregas no prazo | % entregas dentro do SLA | ≥ 80% |
| Satisfação média | Nota dos alunos (0-5) | ≥ 4.0 |
| Taxa de retenção | % alunos que permanecem | ≥ 85% |
| Adesão média | % de adesão dos alunos sob cuidado | ≥ 75% |

**Sistema de Flags:**
| Flag | Condição | Consequência |
|------|----------|-------------|
| 🟢 **Green** | Todas métricas ok | Padrão |
| 🟡 **Yellow** | 1+ métrica abaixo do limite no mês | Alerta, monitoramento |
| 🔴 **Red** | 3 Yellow Flags acumuladas | Prazo de 1 mês para melhorar |
| ⬛ **Black** | 1 mês em Red sem melhoria | Desligamento do time |

**Gráficos no modal:** Barras de entrega no prazo (6 meses), satisfação, retenção + timeline de flags

### 4.6 Comunicação (`/admin/comunicacao`)
**Arquivo:** `src/pages/admin/AdminComunicacao.tsx`

- Lista de conversas com busca
- Mostra especialista responsável por conversa
- Chat area com visualização de mensagens
- Input para admin intervir na conversa

### 4.7 Relatórios (`/admin/relatorios`)
**Arquivo:** `src/pages/admin/AdminRelatorios.tsx`

**KPIs Financeiros:** MRR, LTV, CAC, Churn Rate

4 tabs:
1. **Financeiro:** Receita vs Meta (BarChart 6 meses)
2. **Retenção:** Retenção mensal (LineChart) + Motivos de churn (barras horizontais)
3. **Aquisição:** Canais (PieChart: Orgânico/Indicação/Social/Pago)
4. **Marketing/Qualificação:** Dados extraídos da anamnese:
   - Distribuição de objetivos (PieChart)
   - Faixas etárias (BarChart)
   - Nível de experiência (PieChart)
   - Restrições alimentares (barras horizontais)
   - Motivos de desistência da anamnese (BarChart horizontal)

### 4.8 Importar Alunos (`/admin/importar`)
**Arquivo:** `src/pages/admin/AdminImportarAlunos.tsx`

**Funcionalidade:** Migrar base existente de clientes para a plataforma.

**2 modos:**
1. **Individual:** Formulário completo com todos os campos do perfil
   - Dados pessoais: nome, email, telefone, nascimento
   - Dados físicos: peso, altura, objetivo, experiência, frequência, local de treino
   - Dados nutricionais: restrições, suplementos, hidratação
   - Dados psicológicos: estresse, qualidade do sono
   - Atribuição de especialista
2. **CSV/Planilha:** Upload de arquivo com mapeamento de colunas

**Regras:**
- Aluno importado entra como `onboarded = true` (pula anamnese inicial)
- Especialista é atribuído na importação
- Validação de email único

### 4.9 Configurações (`/admin/config`)
**Arquivo:** `src/pages/admin/AdminConfig.tsx`

4 cards de configuração:

1. **Parâmetros da IA:**
   - Slider: Nível de autonomia (0-100%)
   - Toggle: Auto-ajuste de planos
   - Toggle: Insights proativos
   - Toggle: Alertas de risco de churn

2. **Gamificação:**
   - Faixas de XP por liga (editáveis)
   - XP por treino completo
   - Bônus de promoção (Dracmas)

3. **Chama de Vesta:**
   - Slider: Decaimento diário (%)
   - Toggle: Modo Desonra ativo
   - Input: Dias para reacender

4. **Segurança:**
   - Toggle: 2FA para especialistas
   - Toggle: Logs de auditoria
   - Toggle: Backup automático

---

## 5. SISTEMA DE GAMIFICAÇÃO

### 5.1 Moedas e Progressão
| Recurso | Descrição |
|---------|-----------|
| **XP** | Experiência — ganho por treinos, check-ins, conquistas |
| **Dracmas** | Moeda virtual — ganho por treinos, promoções, conquistas |
| **Nível** | Calculado por XP total (cada nível = 500 XP) |
| **Liga** | Faixa de XP (Plebe → Equites → Legionários → Pretorianos) |
| **Streak** | Dias consecutivos com atividade |
| **Chama de Vesta** | Visualização do streak — chama brilhante ou cinzas |

### 5.2 Recompensas por Treino
- +350 XP por treino completo
- +50 Dracmas por treino completo
- Bônus de promoção de liga: +500 Dracmas (Legionários), +1.500 (Pretorianos)

### 5.3 Conquistas (Achievements)
Tabela `achievements` no DB. Exemplos mockados:
- 🏆 Primeiro Sangue (1ª batalha)
- 🔥 Semana de Fogo (7 dias seguidos)
- ⚔️ Centurião (10 batalhas)
- 🛡️ Indestrutível (14 dias seguidos)

### 5.4 Modo Desonra
Ativado quando streak = 0:
- Paleta de cores muda para tons frios (roxo/cinza)
- Frases mudam para tom confrontacional
- Insights mudam para tom punitivo
- Vinheta escura nas bordas da tela
- Banner fixo: "TUA CHAMA SE EXTINGUIU"
- Objetivo: pressão psicológica para reengajamento

---

## 6. CICLO DE ANAMNESE

### 6.1 Anamnese Inicial (Onboarding)
- Aluno preenche durante o onboarding (12 etapas)
- Dados salvos na tabela `anamnese` + `profiles`
- **SLA do especialista:** 72h para entregar a primeira análise

### 6.2 Anamnese de Acompanhamento (a cada 30 dias)
- Ciclo automático a cada 30 dias
- Aluno recebe notificação para preencher nova anamnese
- **SLA do especialista:** 24h para entregar a análise mensal
- Badge visual no painel do especialista mostrando prazo

### 6.3 Fluxo
```
Aluno preenche anamnese
    ↓
Especialista recebe notificação
    ↓
Countdown inicia (72h ou 24h)
    ↓
Especialista analisa e entrega plano
    ↓
Tempo de entrega entra nas métricas
    ↓
Se atrasou → conta contra SLA
    ↓
Se SLA < 80% no mês → Yellow Flag
```

---

## 7. SISTEMA DE FLAGS (ESPECIALISTAS)

### 7.1 Métricas Monitoradas
| Métrica | Limite Yellow |
|---------|---------------|
| Entregas no prazo | < 80% |
| Satisfação média | < 4.0 |
| Retenção de alunos | < 85% |
| Adesão média | < 75% |
| Tempo 1ª análise | > 72h |
| Tempo acompanhamento | > 24h |

### 7.2 Progressão de Flags
```
Green (padrão)
    ↓ 1 métrica abaixo no mês
Yellow Flag (#1)
    ↓ outra métrica abaixo
Yellow Flag (#2)
    ↓ terceira ocorrência
Yellow Flag (#3) → Red Flag
    ↓ 1 mês sem melhoria
Black Flag → DESLIGAMENTO
```

### 7.3 Visualização
- Badge colorido no card do especialista
- Chips de histórico (últimos 3 meses)
- Contador de yellow flags
- Modal com gráficos detalhados e timeline

---

## 8. BANCO DE DADOS (Supabase)

### 8.1 Tabelas Existentes
| Tabela | Descrição | RLS |
|--------|-----------|-----|
| `profiles` | Dados do aluno (nome, email, peso, altura, classe, etc.) | User read/update own; Admin/Especialista read all |
| `anamnese` | Dados da anamnese (objetivo, treino, nutrição, saúde) | User insert/read own; Admin/Especialista read all |
| `gamification` | XP, nível, liga, streak, dracmas, chama | User read/update own; All read for ranking |
| `workouts` | Treinos realizados (exercícios, duração, XP/dracmas ganhos) | User CRUD own |
| `achievements` | Conquistas desbloqueadas | User insert/read own |
| `user_roles` | Roles: admin, especialista, user | Admin manage all; User read own |

### 8.2 Enums
- `app_role`: admin, especialista, user
- `classe_type`: gladius, velite, centurio
- `league_type`: plebe, legionario, centuriao, pretoriano

### 8.3 Funções
- `has_role(user_id, role)`: Verifica se user tem determinado role

### 8.4 Edge Functions
- `admin-create-user`: Cria usuário com role (usado no admin)

### 8.5 Tabelas Futuras (não implementadas)
| Tabela | Descrição |
|--------|-----------|
| `specialist_metrics` | Métricas mensais do especialista |
| `specialist_flags` | Histórico de flags |
| `anamnese_followup` | Anamneses de acompanhamento (30 dias) |
| `training_plans` | Planos de treino por aluno |
| `nutrition_plans` | Planos nutricionais por aluno |
| `messages` | Chat entre aluno e especialista |
| `notifications` | Notificações push/in-app |
| `ai_insights` | Insights gerados pela IA |
| `daily_checkins` | Check-ins diários de estado mental |

---

## 9. INTEGRAÇÕES FUTURAS

### 9.1 Lovable AI (Mentores)
- Mars: Análise de treino, periodização, sobrecarga progressiva
- Ceres: Análise nutricional, ajuste de macros, substituições
- Seneca: Suporte psicológico, técnicas de respiração, meditação guiada
- Modelo sugerido: `google/gemini-2.5-flash` (custo-benefício)

### 9.2 Lovable AI (Geração de Planos)
- Gerar plano de treino base a partir da anamnese
- Gerar plano nutricional base
- Especialista revisa e ajusta
- Modelo sugerido: `google/gemini-2.5-pro` (complexidade)

### 9.3 Supabase Storage
- Fotos de anamnese postural
- Fotos de evolução mensal
- Avatares de perfil
- Documentos de especialistas

### 9.4 Supabase Realtime
- Chat entre aluno e especialista
- Notificações em tempo real
- Atualizações de leaderboard

### 9.5 Notificações
- Push notifications (PWA)
- Email transacional (confirmação, lembretes)
- In-app notifications

---

## 10. ROADMAP DE IMPLEMENTAÇÃO

### Fase 1 — MVP Frontend ✅ (atual)
- [x] Design system completo (tokens, gradients, animações)
- [x] Auth mockada
- [x] Onboarding completo (12 steps)
- [x] Dashboard com gamificação
- [x] Modo Batalha com tracking de séries
- [x] Mentores com chat simulado
- [x] Coliseu (ligas e leaderboard)
- [x] Dieta (plano alimentar)
- [x] Perfil do aluno
- [x] Portal Admin completo (dashboard, usuários, planos, especialistas, comunicação, relatórios, config)
- [x] Portal Especialista (dashboard, alunos, planos, chat, perfil)
- [x] Sistema de flags para especialistas
- [x] SLA e countdown de entregas
- [x] Importação de alunos
- [x] Modo Desonra

### Fase 2 — Backend Real
- [ ] Conectar auth real (Supabase Auth)
- [ ] Persistir onboarding no DB
- [ ] Persistir workouts no DB
- [ ] Persistir gamificação no DB
- [ ] Upload de fotos (Supabase Storage)
- [ ] Edge function: admin-create-user funcional
- [ ] RLS policies validadas end-to-end

### Fase 3 — IA e Automação
- [ ] Mentores com Lovable AI
- [ ] Geração automática de planos (treino + dieta)
- [ ] Sugestões proativas para especialistas
- [ ] Alertas de risco de churn
- [ ] Auto-ajuste de planos baseado em feedback

### Fase 4 — Comunicação e Realtime
- [ ] Chat real entre aluno e especialista
- [ ] Notificações in-app
- [ ] Supabase Realtime para chat e leaderboard
- [ ] Email transacional (lembretes, confirmações)

### Fase 5 — Polimento e Escala
- [ ] PWA (Progressive Web App)
- [ ] Push notifications
- [ ] Galeria de evolução física
- [ ] Sistema de conquistas completo
- [ ] Marketplace de Dracmas (skins, recompensas)
- [ ] Multi-tenant (múltiplas academias/empresas)
- [ ] Relatórios exportáveis (PDF)
- [ ] Integração com wearables (futuro distante)

---

## 11. MÉTRICAS DE SUCESSO

| Métrica | Meta |
|---------|------|
| Retenção 30 dias | ≥ 80% |
| Engajamento diário (DAU/MAU) | ≥ 40% |
| Streak médio dos alunos | ≥ 7 dias |
| Satisfação com especialista | ≥ 4.5/5 |
| SLA de entregas no prazo | ≥ 90% |
| Churn mensal | ≤ 5% |
| NPS | ≥ 50 |
