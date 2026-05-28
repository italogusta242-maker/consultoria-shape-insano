## Causa raiz confirmada do "treino fantasma"

Reproduzi o caminho no código. O cenário que você descreveu está acontecendo assim:

1. Em algum momento o aluno abriu/iniciou um treino e o app salvou um snapshot local no aparelho.
2. Ao trocar de aba ou fechar o app, o sistema regrava o snapshot e atualiza a "data" do snapshot para o dia atual — sem mexer no horário de início original.
3. O snapshot tem expiração teórica de 6h, mas como a data é reescrita toda vez que o app perde o foco, ele consegue sobreviver por dias.
4. Quando o aluno reabre o aplicativo:
   - o app encontra o snapshot;
   - restaura como se o treino estivesse em andamento;
   - liga o cronômetro;
   - calcula tempo decorrido desde o início original (que pode ser de horas ou dias atrás);
   - cai imediatamente na regra de "passou de 3h, finalizar automaticamente";
   - grava no banco um treino com comentário "Finalizado automaticamente (3h)".

Resultado: aparece um treino que o aluno nunca fez. Os dados do banco confirmam isso — existem 33 treinos gravados assim, alguns iniciados num dia e salvos no dia seguinte.

A finalização automática de 3h é a fonte real do "treino contabilizado sozinho", da chama errada e da sensação de "app preso no treino".

## Plano de correção definitivo

### 1. Remover por completo a finalização automática de treino

Nada será gravado em treino sem ação explícita do aluno.

- Remover o gatilho de auto-finalização após 3h.
- Substituir por: quando o app detectar uma sessão muito antiga, mostrar uma tela perguntando ao aluno o que fazer:
  - Retomar treino;
  - Finalizar agora e registrar;
  - Descartar este treino.
- Enquanto o aluno não decidir, nada é gravado no histórico nem influencia a chama.

### 2. Validar snapshot antigo de forma confiável

- A data efetiva do snapshot passa a ser sempre o horário real de início, nunca reescrita.
- Snapshot com início acima de um limite (ex.: 4h sem interação) entra automaticamente em modo "sessão pausada" e exibe a tela do item 1.
- Snapshot de outro dia local é tratado como sessão expirada e pede confirmação antes de qualquer ação.
- Snapshot inválido, sem grupo válido no plano atual, é descartado em vez de virar treino genérico.

### 3. Limpar histórico já contaminado

Existem 33 registros de "Finalizado automaticamente (3h)" no banco. Vou:

- Listar todos esses registros.
- Marcar/remover esses registros após sua aprovação para não contarem como treino real, chama e relatórios.
- Recalcular a chama dos alunos afetados.

### 4. Blindar a reavaliação mensal contra reset

- Salvar rascunho local da reavaliação a cada mudança de campo e a cada troca de etapa.
- Restaurar automaticamente o rascunho ao abrir `/reavaliacao`.
- Marcar a reavaliação como "fluxo crítico ativo" enquanto o aluno está nela, não só durante o envio.
- Impedir reload pelo PWA durante esse fluxo.
- Limpar rascunho apenas após envio confirmado.

### 5. Tornar salvamento de treino + chama uma operação só

- Criar função no banco que recebe o treino, grava em `workouts` e atualiza `flame_status` na mesma transação, usando o timezone do perfil do aluno.
- Atualizar o app para usar essa função em vez de fazer dois passos separados.
- Otimismo visual continua, mas o valor real volta do banco.

### 6. Padronizar datas

- Usar timezone do perfil (com fallback `America/Sao_Paulo`) em: histórico, chama, relatórios, alertas de inatividade, streak.

## Arquivos que serão alterados

- `src/pages/Treinos.tsx`
- `src/lib/workoutSnapshot.ts`
- `src/lib/flameMotor.ts`
- `src/hooks/useFlameState.ts`
- `src/hooks/useStreak.ts`
- `src/pages/monthly-assessment/MonthlyAssessment.tsx`
- `src/lib/submitMonthlyAssessment.ts`
- `src/hooks/useSilentUpdate.ts`
- Nova migration: função atômica de finalizar treino + atualizar chama
- Operação de dados: limpar treinos automáticos já gravados (após sua aprovação)

## Testes que vou executar

- Snapshot antigo no aparelho + abrir app: não pode criar treino sozinho. Deve mostrar tela "sessão pausada".
- Abrir o app sem nunca ter iniciado treino: nenhum registro automático.
- Treino real iniciado, sair para outra aba por horas, voltar: deve restaurar e perguntar antes de finalizar.
- Finalizar manualmente: gera exatamente um registro, chama atualiza junto.
- Reavaliação preenchida pela metade: trocar de aba, abrir câmera, recarregar — sempre volta de onde parou.
- Conferir banco depois das mudanças: nenhum novo registro com "Finalizado automaticamente (3h)".

## Ordem de execução

1. Remover auto-finalização (corta o sangramento imediatamente).
2. Validar/expirar snapshot corretamente.
3. Blindar reavaliação mensal.
4. Finalização atômica treino + chama.
5. Limpeza dos treinos fantasmas já gravados.
6. Padronização de timezone nos relatórios e hooks.