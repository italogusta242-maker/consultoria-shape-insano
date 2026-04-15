

## Checklist de Ajustes e Melhorias — Plano de Implementação

### Status atual

| Item | Status |
|------|--------|
| 4. Chat — Badge de não lidos | ✅ Já implementado |
| 4. Chat — Marcar como não lido | ✅ Já implementado |
| 2. Inativar/reativar aluno | ✅ Já implementado |

### Itens pendentes (5 tarefas)

---

#### 1. Dashboard — Arquivar/dispensar alertas permanentes + limpar pendências
**Arquivos:** `src/pages/especialista/EspecialistaDashboard.tsx`, `src/hooks/useProactiveAlerts.ts`

O sistema já tem dismiss individual e por aluno, mas falta:
- Botão "Limpar todos os alertas" visível no topo da seção de alertas
- Opção de filtrar apenas alertas críticos (escondendo info/warning)
- A funcionalidade `restoreAll` já existe no hook — só precisa de um botão no UI

Também no painel "Sem Resposta" — adicionar botão para dispensar/ocultar conversas sem resposta individualmente (usando `dismissed_alerts` com key `unresponsive-{studentId}`).

---

#### 2. Perfil — Visualização 360º + Datas do plano/contrato
**Arquivo:** `src/pages/especialista/EspecialistaAlunos.tsx`

- No `StudentResumoContent`, adicionar seção "Plano/Contrato" no topo com:
  - Data de início da assinatura (`subscriptions.started_at`)
  - Data de término calculada (via `subscription_plans.duration_months`)
  - Validade do plano de treino/dieta (`training_plans.valid_until` / `diet_plans.valid_until`)
- Reorganizar o layout para que dados pessoais + plano/contrato fiquem compactos em grid 2 colunas, reduzindo scroll

---

#### 3. Exportação de treino em PDF
**Arquivos:** Novo `src/lib/exportTrainingPDF.ts`, editar `StudentTrainingTab` em `EspecialistaAlunos.tsx`

- Criar função que gera PDF do plano de treino usando `jspdf` (já disponível ou instalar)
- Layout: cabeçalho com nome do aluno + título do plano, tabela por grupo com exercícios, séries, reps, descanso
- Botão "Exportar PDF" no card do plano de treino (ao lado de "Editar")
- PDF gerado no client-side, download direto

---

#### 4. Notificação automática ao especialista quando aluno preenche anamnese inicial
**Arquivo:** `src/lib/submitAnamnese.ts`

A função `submitAnamnese` insere a anamnese mas **não notifica os especialistas vinculados**. Adicionar:
- Buscar `student_specialists` do aluno
- Inserir notificação tipo `anamnese_submitted` para cada especialista com título "📋 Nova anamnese preenchida" e body com nome do aluno
- Isso dispara push automaticamente via trigger `trigger_push_on_notification`

---

#### 5. Alerta de reavaliação mensal para o especialista
**Já parcialmente coberto:** O `submitMonthlyAssessment.ts` já insere notificação `monthly_completed` para especialistas. Verificar se está funcionando corretamente — se sim, este item já está resolvido. Caso o especialista não esteja recebendo, debugar a query de `student_specialists`.

---

### Resumo de arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/pages/especialista/EspecialistaDashboard.tsx` | Botões limpar/restaurar alertas + dispensar sem resposta |
| `src/pages/especialista/EspecialistaAlunos.tsx` | Seção contrato/plano no resumo + botão exportar PDF |
| `src/lib/exportTrainingPDF.ts` | Novo — geração de PDF do treino |
| `src/lib/submitAnamnese.ts` | Notificar especialistas ao preencher anamnese |
| `package.json` | Adicionar `jspdf` se necessário |

