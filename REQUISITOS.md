# SHAPE INSANO — Documento de Requisitos

**Versão:** 1.0  
**Data:** 2026-02-21  
**Status:** Produção (Lovable Cloud)

---

## Sumário

1. [Introdução](#1-introdução)
2. [Requisitos Funcionais](#2-requisitos-funcionais)
3. [Requisitos Não Funcionais](#3-requisitos-não-funcionais)
4. [Glossário](#4-glossário)

---

## 1. Introdução

### 1.1 Objetivo do Documento
Documentar os requisitos funcionais e não funcionais do sistema **Shape Insano**, um SaaS de acompanhamento fitness com gamificação, operando em 5 portais segmentados por perfil de acesso.

### 1.2 Escopo do Sistema
O Shape Insano integra:
- Acompanhamento personalizado de treino e nutrição
- Sistema de gamificação (Chama de Honra, streaks)
- Comunicação em tempo real entre alunos e especialistas
- Gestão administrativa da plataforma
- Portal de vendas (Closer) e Customer Success (CS)

### 1.3 Perfis de Acesso

| Perfil | Rota Base | Descrição |
|--------|-----------|-----------|
| Aluno (`user`) | `/` | Usuário final — treina, acompanha dieta, gamificação |
| Especialista (`especialista`) | `/especialista` | Nutricionista ou Preparador Físico — prescreve planos |
| Administrador (`admin`) | `/admin` | Gestão completa da plataforma |
| Closer (`closer`) | `/closer` | Vendas, convites e onboarding comercial |
| Customer Success (`cs`) | `/cs` | Retenção, acompanhamento de alunos e profissionais |

---

## 2. Requisitos Funcionais

### 2.1 Autenticação e Autorização

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-AUTH-01 | O sistema deve permitir cadastro com email e senha (mín. 6 caracteres) | Alta |
| RF-AUTH-02 | O sistema deve exigir confirmação de email antes do primeiro acesso | Alta |
| RF-AUTH-03 | O sistema deve redirecionar automaticamente o usuário para o portal correspondente ao seu papel (role) após login | Alta |
| RF-AUTH-04 | O sistema deve manter isolamento funcional estrito — cada perfil acessa apenas seu portal | Alta |
| RF-AUTH-05 | O sistema deve suportar criação de usuários via convite (portal Closer) | Média |
| RF-AUTH-06 | O sistema deve permitir criação de usuários pelo administrador com atribuição de role | Alta |
| RF-AUTH-07 | O sistema deve suportar acesso via link de convite com token único | Média |

### 2.2 Onboarding do Aluno

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-ONB-01 | O sistema deve conduzir o aluno por um fluxo linear de 12 etapas no primeiro acesso | Alta |
| RF-ONB-02 | O sistema deve coletar dados pessoais: nome, email, telefone, nascimento, CPF, cidade/estado, sexo, altura, peso | Alta |
| RF-ONB-03 | O sistema deve permitir upload de 5 fotos posturais (frente, costas, perfil direito, esquerdo, teste sentar-e-alcançar) | Alta |
| RF-ONB-04 | O sistema deve coletar objetivo principal, interesse em fisiculturismo e referências | Alta |
| RF-ONB-05 | O sistema deve coletar dados de treino: local, equipamentos, frequência, horário, duração | Alta |
| RF-ONB-06 | O sistema deve coletar dados de academia: grupos musculares prioritários, dores, exercícios indesejados, máquinas indisponíveis | Alta |
| RF-ONB-07 | O sistema deve coletar dados de saúde: doenças, histórico familiar, medicamentos, alergias | Alta |
| RF-ONB-08 | O sistema deve coletar perfil nutricional: nível de atividade, refeições/dia, horários, calorias, restrições, suplementos | Alta |
| RF-ONB-09 | O sistema deve coletar estilo de vida: sono, hidratação, hábitos alimentares | Alta |
| RF-ONB-10 | O sistema deve persistir todos os dados da anamnese no banco de dados (tabelas `anamnese` e `profiles`) | Alta |
| RF-ONB-11 | Ao concluir o onboarding, o sistema deve marcar `onboarded = true` no perfil do aluno | Alta |

### 2.3 Dashboard do Aluno

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-DASH-01 | O dashboard deve exibir a Chama de Honra com streak atual e recorde | Alta |
| RF-DASH-02 | O dashboard deve exibir indicadores: Performance, Treino Hoje, Calorias, Mental | Alta |
| RF-DASH-04 | O dashboard deve permitir check-in diário de estado mental (1x por dia) | Média |
| RF-DASH-05 | O dashboard deve exibir gráficos de performance semanal e volume semanal | Média |
| RF-DASH-06 | O dashboard deve exibir frases motivacionais rotativas | Baixa |
| RF-DASH-07 | O dashboard deve ativar o "Modo Chama Extinta" quando streak = 0, alterando paleta visual | Média |

### 2.4 Treinos

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-TRE-01 | O sistema deve exibir o plano de treino ativo do aluno, organizado em grupos (A, B, C...) | Alta |
| RF-TRE-02 | O sistema deve permitir execução de treino com tracking de séries (carga, reps) em tempo real | Alta |
| RF-TRE-03 | O sistema deve registrar cronômetro de duração durante a execução do treino | Alta |
| RF-TRE-04 | O sistema deve pré-preencher dados da última sessão para referência | Média |
| RF-TRE-05 | Ao concluir treino, o sistema deve registrar o workout no banco e atualizar os indicadores de consistência | Alta |
| RF-TRE-06 | O sistema deve exibir tela de vitória com resumo de volume e conquistas | Média |

### 2.5 Dieta

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-DIE-01 | O sistema deve exibir o plano alimentar ativo do aluno com refeições e macros | Alta |
| RF-DIE-02 | O sistema deve exibir macros totais diários: calorias, proteína, carboidratos, gordura | Alta |
| RF-DIE-03 | O sistema deve permitir que o aluno marque refeições como concluídas | Alta |
| RF-DIE-04 | O sistema deve rastrear adesão diária à dieta (hábitos diários) | Alta |
| RF-DIE-05 | O sistema deve registrar consumo de água diário | Média |

### 2.6 Chat

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-CHAT-01 | O sistema deve permitir comunicação em tempo real entre aluno e especialista | Alta |
| RF-CHAT-02 | O sistema deve suportar envio de mensagens de texto | Alta |
| RF-CHAT-03 | O sistema deve suportar envio de mídias (fotos, áudios) | Média |
| RF-CHAT-04 | O sistema deve exibir indicador de digitação em tempo real | Baixa |
| RF-CHAT-05 | O sistema deve exibir confirmação de leitura (ticks duplos) | Baixa |
| RF-CHAT-06 | O sistema deve suportar resposta a mensagens específicas (reply/swipe) | Baixa |
| RF-CHAT-07 | O sistema deve exibir notificações toast para novas mensagens | Média |

### 2.7 Gamificação

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-GAM-01 | O sistema deve manter streak de dias consecutivos com atividade | Alta |
| RF-GAM-02 | O sistema deve calcular e exibir a Chama de Honra (flame_percent) | Alta |
| RF-GAM-03 | O sistema deve decrementar a chama diariamente via edge function cron (`daily-flame-check`) | Alta |
| RF-GAM-06 | O sistema deve registrar conquistas (achievements) desbloqueadas | Média |
| RF-GAM-07 | O sistema deve manter o recorde de streak (max_streak) | Média |

### 2.8 Perfil e Evolução do Aluno

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-PER-01 | O sistema deve exibir dados pessoais e de gamificação no perfil | Alta |
| RF-PER-03 | O sistema deve exibir histórico de evolução (peso, fotos, métricas) | Média |
| RF-PER-04 | O sistema deve permitir logout | Alta |

### 2.9 Reavaliação Mensal

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-REA-01 | O sistema deve disponibilizar formulário de reavaliação mensal (monthly assessment) | Alta |
| RF-REA-02 | A reavaliação deve coletar: peso, altura, fotos (frente, costas, laterais, perfil), adesão a treinos/cardio/dieta | Alta |
| RF-REA-03 | A reavaliação deve coletar: nível de fadiga, objetivo atual, dias disponíveis, horário, sugestões | Alta |
| RF-REA-04 | O sistema deve persistir a reavaliação na tabela `monthly_assessments` | Alta |

### 2.10 Portal do Especialista

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-ESP-01 | O dashboard deve exibir KPIs: total de alunos, alertas, revisões pendentes, chama média | Alta |
| RF-ESP-02 | O sistema deve listar os alunos vinculados ao especialista com status, chama e streak | Alta |
| RF-ESP-03 | O sistema deve organizar alunos em abas: Todos, Ativos, Pendentes | Alta |
| RF-ESP-04 | O sistema deve exibir banner de alerta para alunos sem planos ativos | Média |
| RF-ESP-05 | O sistema deve exibir badge de "Anamnese pendente" para anamneses não revisadas | Alta |
| RF-ESP-06 | O especialista deve visualizar a anamnese completa em split-view, com borramento (blur) das informações exclusivas de outras especialidades ou dados pessoais restritos | Alta |
| RF-ESP-07 | O sistema deve abrir automaticamente o editor de plano (dieta ou treino) ao visualizar anamnese | Alta |
| RF-ESP-08 | O nutricionista deve poder criar e editar planos alimentares com refeições, alimentos e macros | Alta |
| RF-ESP-09 | O preparador físico deve poder criar e editar planos de treino com grupos, exercícios, séries e cargas | Alta |
| RF-ESP-10 | O preparador físico deve poder editar limites de volume semanal por grupo muscular | Média |
| RF-ESP-11 | O especialista deve poder solicitar nova anamnese ao aluno via notificação | Alta |
| RF-ESP-12 | O especialista deve poder marcar anamnese como revisada | Alta |
| RF-ESP-13 | O sistema deve suportar templates de dieta e treino reutilizáveis | Média |
| RF-ESP-14 | O sistema deve exibir painel de adesão alimentar do aluno (últimos 7 dias) | Média |
| RF-ESP-15 | O sistema deve exibir gráfico de evolução de peso do aluno | Média |
| RF-ESP-16 | O sistema deve exibir fotos de evolução do aluno | Média |
| RF-ESP-17 | O sistema deve permitir gestão de banco de alimentos (food_database) | Média |

### 2.11 Portal Administrativo

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-ADM-01 | O dashboard root deve exibir KPIs globais englobando CS, Closer e Profissionais (metas, retenção, alunos atrelados, treinos criados, conversas) | Alta |
| RF-ADM-02 | O sistema deve permitir busca e visualização de todos os usuários | Alta |
| RF-ADM-03 | O sistema deve permitir criação simplificada de novos profissionais com seleção rápida de especialidade e dados de acesso | Alta |
| RF-ADM-04 | O sistema deve exibir painel de alunos pendentes (pós-onboarding, aguardando autorização) | Alta |
| RF-ADM-05 | O administrador pode autorizar alunos e vinculá-los aos profissionais, embora seja função prioritária do Closer | Alta |
| RF-ADM-06 | O sistema deve exibir gestão de especialistas detalhando acessos, conversas não respondidas e treinos pendentes/atualizados | Alta |
| RF-ADM-07 | O sistema deve exibir relatórios e monitorar métricas operacionais e financeiras gerais do projeto | Média |
| RF-ADM-08 | O sistema deve permitir gestão irrestrita de permissões e roles | Alta |

### 2.12 Portal Closer

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-CLO-01 | O painel de alunos deve conter filtros por riscos, retenção e novos alunos com um respectivo dashboard analítico | Alta |
| RF-CLO-02 | O painel de profissionais deve exibir alunos associados, conversas não respondidas e treinos atualizados/desatualizados (diário/mensal) | Alta |
| RF-CLO-03 | O dashboard de inatividade gera alertas de >3 dias inativos ou ausência de check-in. Ao clicar, exibe o perfil do aluno com o status do risco | Alta |
| RF-CLO-04 | O closer é o ator principal na aprovação de novos alunos e na realização de vínculo manual entre aluno e especialista | Alta |
| RF-CLO-05 | O closer deve poder gerar link de convite único ou token para leads | Alta |

### 2.13 Portal Customer Success

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-CS-01 | O CS deve poder visualizar lista de alunos com filtros de status | Alta |
| RF-CS-02 | O CS deve poder visualizar lista de profissionais | Alta |
| RF-CS-03 | O CS deve ter dashboard com métricas de retenção | Alta |
| RF-CS-04 | O CS deve poder acompanhar indicadores de risco de churn | Média |

### 2.14 Notificações

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-NOT-01 | O sistema deve suportar notificações in-app (centro de notificações) | Alta |
| RF-NOT-02 | O sistema deve suportar Web Push Notifications (PWA) | Média |
| RF-NOT-03 | O sistema deve notificar especialistas sobre novas anamneses | Alta |
| RF-NOT-04 | O sistema deve notificar alunos sobre solicitações de anamnese | Alta |
| RF-NOT-05 | O sistema deve notificar sobre novas mensagens de chat | Média |

### 2.15 Edge Functions (Backend)

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-EF-01 | `create-invite` — Criar convite e conta de aluno via portal Closer | Alta |
| RF-EF-02 | `admin-create-user` — Criar usuário com role específico pelo admin | Alta |
| RF-EF-03 | `push-notifications` — Enviar Web Push via VAPID | Média |
| RF-EF-04 | `daily-flame-check` — Cron diário para verificar e decrementar streaks/chama | Alta |
| RF-EF-05 | `check-stale-plans` — Cron para alertar sobre planos vencidos | Média |
| RF-EF-06 | `asaas-webhook` — Processar webhook de pagamentos | Alta |

---

## 3. Requisitos Não Funcionais

### 3.1 Desempenho

| ID | Requisito | Métrica |
|----|-----------|---------|
| RNF-DES-01 | O tempo de carregamento inicial da aplicação deve ser inferior a 3 segundos em conexão 4G | ≤ 3s |
| RNF-DES-02 | As interações do usuário (cliques, navegação) devem ter feedback visual em menos de 100ms | ≤ 100ms |
| RNF-DES-03 | As consultas ao banco de dados devem retornar em menos de 500ms | ≤ 500ms |
| RNF-DES-04 | O sistema deve suportar no mínimo 1.000 usuários simultâneos | ≥ 1.000 |
| RNF-DES-05 | As mensagens de chat devem ser entregues em tempo real com latência inferior a 1 segundo | ≤ 1s |

### 3.2 Segurança

| ID | Requisito |
|----|-----------|
| RNF-SEG-01 | Todas as tabelas do banco devem ter Row Level Security (RLS) habilitado |
| RNF-SEG-02 | Dados sensíveis (CPF, telefone) devem ser acessíveis apenas pelo próprio usuário, admin e especialistas vinculados |
| RNF-SEG-03 | API keys privadas devem ser armazenadas como secrets (nunca no código-fonte) |
| RNF-SEG-04 | O sistema deve usar HTTPS em todas as comunicações |
| RNF-SEG-05 | Senhas devem ter no mínimo 6 caracteres e ser armazenadas com hash (Supabase Auth) |
| RNF-SEG-06 | O sistema deve validar roles via função `has_role()` com `SECURITY DEFINER` para evitar recursão |
| RNF-SEG-07 | Tokens de convite devem ser únicos e ter prazo de expiração |
| RNF-SEG-08 | Service Role Key deve ser utilizada apenas em Edge Functions (nunca no frontend) |

### 3.3 Usabilidade

| ID | Requisito |
|----|-----------|
| RNF-USA-01 | A interface deve ser mobile-first com design responsivo |
| RNF-USA-02 | O sistema deve ser instalável como PWA (Progressive Web App) |
| RNF-USA-03 | A navegação principal deve ser acessível via bottom navigation (aluno) ou sidebar (especialista/admin) |
| RNF-USA-04 | O sistema deve fornecer feedback visual para todas as ações do usuário (loading states, toasts, animações) |
| RNF-USA-05 | O tema visual deve ser exclusivamente dark mode com paleta laranja/amarelo/preto |
| RNF-USA-06 | A interface deve usar design system consistente com tokens semânticos (CSS variables HSL) |
| RNF-USA-07 | Formulários longos (onboarding, reavaliação) devem usar stepper visual com progresso |

### 3.4 Confiabilidade

| ID | Requisito |
|----|-----------|
| RNF-CON-01 | O sistema deve ter disponibilidade mínima de 99,5% |
| RNF-CON-02 | Edge functions cron devem executar diariamente sem falhas (flame check, stale plans) |
| RNF-CON-03 | O sistema deve tratar erros de rede com retry automático (React Query) |
| RNF-CON-04 | Dados de treino em andamento devem ser preservados em caso de perda temporária de conexão |
| RNF-CON-05 | O sistema de chat deve manter histórico persistente de todas as mensagens |

### 3.5 Manutenibilidade

| ID | Requisito |
|----|-----------|
| RNF-MAN-01 | O código deve seguir arquitetura em camadas: Pages → Components → Hooks → Services |
| RNF-MAN-02 | Componentes com mais de 150 linhas devem ser decompostos |
| RNF-MAN-03 | Tipos TypeScript devem ser compartilhados via barrel exports (`types/index.ts`) |
| RNF-MAN-04 | Consultas ao banco devem ser encapsuladas em hooks com React Query |
| RNF-MAN-05 | O sistema de tipos do banco deve ser auto-gerado (Supabase types) |
| RNF-MAN-06 | Variáveis de ambiente devem ser gerenciadas automaticamente (`.env` auto-gerado) |

### 3.6 Escalabilidade

| ID | Requisito |
|----|-----------|
| RNF-ESC-01 | A arquitetura deve suportar adição de novos portais/roles sem refatoração significativa |
| RNF-ESC-02 | O banco de dados deve suportar crescimento de até 10.000 usuários sem degradação |
| RNF-ESC-03 | Edge functions devem ser stateless e horizontalmente escaláveis |
| RNF-ESC-04 | O sistema de chat Realtime deve suportar múltiplas conversas simultâneas |

### 3.7 Compatibilidade

| ID | Requisito |
|----|-----------|
| RNF-COM-01 | O sistema deve funcionar nos navegadores: Chrome 90+, Safari 15+, Firefox 90+, Edge 90+ |
| RNF-COM-02 | O sistema deve ser responsivo para telas de 320px a 1920px |
| RNF-COM-03 | O PWA deve ser instalável em Android (Chrome) e iOS (Safari) |
| RNF-COM-04 | Web Push Notifications devem funcionar em Chrome e Firefox (não suportado no iOS Safari) |

### 3.8 Acessibilidade

| ID | Requisito |
|----|-----------|
| RNF-ACE-01 | Componentes interativos devem ser acessíveis via teclado |
| RNF-ACE-02 | Imagens devem possuir atributos `alt` descritivos |
| RNF-ACE-03 | Componentes UI devem usar primitives acessíveis (Radix UI) |
| RNF-ACE-04 | Contrastes de texto devem atender WCAG 2.1 nível AA |

### 3.9 Internacionalização

| ID | Requisito |
|----|-----------|
| RNF-I18N-01 | O idioma padrão e único da interface é Português Brasileiro (pt-BR) |
| RNF-I18N-02 | Datas devem ser formatadas no padrão brasileiro (dd/MM/yyyy) |
| RNF-I18N-03 | Números decimais devem usar vírgula como separador |

---

## 4. Glossário

| Termo | Definição |
|-------|-----------|
| **Chama de Honra** | Indicador visual de constância do aluno — baseado no streak e flame_percent |
| **Streak** | Contagem de dias consecutivos com atividade registrada |
| **Anamnese** | Formulário detalhado de avaliação física, nutricional e de saúde |
| **Reavaliação** | Formulário mensal de acompanhamento do progresso |
| **Split-View** | Visualização em tela dividida (anamnese + editor de plano) |
| **RLS** | Row Level Security — políticas de acesso por linha no banco de dados |
| **PWA** | Progressive Web App — aplicação web instalável |
| **SLA** | Service Level Agreement — acordo de nível de serviço (tempo de entrega) |
| **Flag** | Sistema de indicadores de desempenho do especialista (Green/Yellow/Red/Black) |
| **Closer** | Profissional responsável por vendas e convites de novos alunos |
| **CS** | Customer Success — profissional de retenção e sucesso do cliente |
| **Edge Function** | Função serverless executada no backend (Lovable Cloud) |
| **Modo Chama Extinta** | Estado visual ativado quando streak = 0, com paleta fria para motivar reengajamento |

---

*Documento gerado com base na análise completa do código-fonte, escopo e arquitetura do projeto Shape Insano.*
