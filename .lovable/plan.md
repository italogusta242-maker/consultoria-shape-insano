## Resumo dos 2 pedidos do Guilherme

### 1. Chama de Honra: sábado e domingo NÃO podem apagar a chama
Hoje, alunos que treinam só seg-sex perdem a chama na segunda (sáb sem treino → trégua, dom sem treino → extinta).

### 2. Bug: ao salvar treino, redireciona pra dashboard
Atualização de ontem não pegou — o problema persiste.

---

## Pedido 1 — Fix: fim de semana neutro no motor da chama

A lógica de apagar/rebaixar a chama está no SQL `process_midnight_flame_check()` (Postgres cron, roda toda hora). Ele chama `check_user_day_approval(user_id, "ontem", timezone)`. Se o "ontem" for um sábado ou domingo, ele tenta validar treino/dieta — e quem não treina no fim de semana cai.

**Mudança:** alterar `check_user_day_approval` para retornar `TRUE` automaticamente quando a data for sábado (DOW=6) ou domingo (DOW=0), antes de consultar workouts/dieta.

**Efeito prático:**
- Domingo de manhã (00:00 BRT): sistema checa "ontem = sábado" → aprovado automático. Chama mantida.
- Segunda de manhã: checa "ontem = domingo" → aprovado automático. Chama mantida.
- Quem treina no fim de semana continua ganhando o treino normalmente (não muda nada — só evita a punição).

**Impacto adicional:** A função `check_user_day_approval` também é usada pela "migração curativa" do dia, mas só roda no deploy — sem efeito recorrente.

**Não vou alterar:** o `flameMotor.ts` do front (`isDayApprovedClient`), pois ele só **reativa** a chama quando o aluno faz algo (não pode punir). Manter como está.

**Não recupero retroativo** quem já caiu (Guilherme confirmou: "precisa recuperar não").

### Migração SQL
```sql
CREATE OR REPLACE FUNCTION public.check_user_day_approval(u_id UUID, d_date DATE, tz TEXT)
RETURNS BOOLEAN ...
BEGIN
    -- NOVO: Sábado (6) e Domingo (0) são automaticamente aprovados
    IF EXTRACT(DOW FROM d_date) IN (0, 6) THEN
        RETURN TRUE;
    END IF;
    -- ... resto da lógica original (treino + dieta 50%)
END;
```

---

## Pedido 2 — Investigação: redirect ao salvar treino

Já fiz o pente fino:

- O `onSuccess` do save em `TrainingPlanEditor.tsx` (linha 556) só faz: `clearDraft → toast → invalidateQueries → onClose()`. **Sem navigate.**
- Os 2 callers (`EspecialistaTreino.tsx:339` e `EspecialistaAlunos.tsx:1513`) passam `onClose` que só fecha o modal. **Sem navigate.**
- Não há `navigate("/especialista")` em lugar nenhum do fluxo de save.

**Conclusão:** o redirect não está no código atual deste branch. Possíveis causas restantes:

1. **Cache do PWA do especialista** — ele está rodando JS antigo (de antes do fix anterior). Solução: hard refresh ou esperar o auto-update silencioso.
2. **`invalidateQueries(["specialist-training-plans"])` está disparando algum re-render do pai que muda rota** — improvável, mas possível.
3. **Especialista está salvando por outro fluxo** que não passa por `TrainingPlanEditor` (ex: PDF import com `onSaveAndClose`).

**Plano de investigação:**
- Pedir pro Guilherme:
  - Fazer **hard refresh** (Ctrl+Shift+R) ou fechar/abrir o PWA, depois testar de novo.
  - Se persistir, **gravar tela** mostrando exatamente: qual rota está (URL), qual botão clica pra salvar, e pra onde vai.
  - Confirmar se está na tela de **lista de planos** (`/especialista/treinos`), **detalhes do aluno** (`/especialista/alunos`) ou outra.
- Se ainda persistir após hard refresh, adiciono um `console.log("[Save] onSuccess called from", window.location.pathname)` no editor pra capturar o caminho exato e confirmar se o callback dispara navegação fantasma.

**Não vou fazer alteração de código preventiva** sem reproduzir, pra não introduzir regressão num fluxo que está correto no código.

---

## O que vou entregar agora

1. **Migration SQL** que adiciona o bypass de sábado/domingo em `check_user_day_approval`.
2. **Mensagem para o Guilherme** confirmando o fix da chama + pedindo o hard refresh + vídeo do bug do redirect.

## O que fica pendente
- Investigação do redirect aguarda evidência do Guilherme após hard refresh.