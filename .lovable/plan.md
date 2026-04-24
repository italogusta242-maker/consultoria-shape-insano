## Ajuste solicitado

Resolver a perda de progresso no treino quando o aluno sai para WhatsApp/Spotify, perde sinal ou o navegador/PWA é encerrado em segundo plano. O comportamento esperado é simples: cada série marcada precisa ficar salva no próprio aparelho imediatamente e o treino deve reabrir exatamente de onde parou.

## O que será feito

### 1. Fortalecer a persistência local do treino em execução
Hoje a tela de `Treinos` já usa `localStorage`, mas a gravação principal acontece em `useEffect`, ou seja: depois da mudança de estado já ter sido aplicada. Em celulares com pouca memória isso abre uma janela em que o app pode ser morto antes da persistência terminar.

Vou mudar isso para uma persistência imediata, no próprio evento da ação do usuário:
- iniciar treino
- alterar carga/repetições
- confirmar série
- reabrir série concluída
- concluir exercício
- marcar bloco de texto como feito
- cancelar ou finalizar treino

Assim, o snapshot do treino será salvo no milissegundo do clique, e não apenas “na próxima renderização”.

### 2. Salvar um snapshot completo e seguro da sessão
O snapshot local passará a guardar, de forma consistente:
- aluno atual
- data da sessão
- grupo de treino selecionado
- nome do grupo
- `startedAt`
- view atual (`detail` ou `execution`)
- exercício expandido
- exercícios com `setsData` completos
- estado de descanso, quando existir

Também vou padronizar as chaves e validações para evitar restaurar dados inválidos ou de outro treino.

### 3. Restaurar automaticamente ao reabrir o app
Na entrada da página de `Treinos`, o app vai:
- verificar se existe sessão local válida do dia
- conferir se ela pertence ao mesmo aluno e ao mesmo treino/grupo
- restaurar o estado completo
- retomar a execução sem zerar séries já marcadas

Se os dados estiverem inconsistentes (por exemplo, plano alterado pelo especialista), o app limpa apenas a sessão corrompida e volta ao estado seguro.

### 4. Gravar também nos eventos de ciclo de vida do celular
Além da persistência imediata por clique, vou adicionar flush/backup quando a aba/app for para segundo plano:
- `visibilitychange`
- `pagehide`
- desmontagem do componente

Isso reduz ainda mais o risco de perda quando Android/iPhone suspendem ou encerram o navegador/PWA.

### 5. Blindar a recuperação contra reload automático do app
O projeto já possui lógica de atualização silenciosa do PWA. Vou garantir que, enquanto houver treino em andamento salvo localmente, a tela não seja recarregada de forma automática no retorno ao app.

Isso evita o cenário em que o app até detecta atualização, mas interfere numa sessão que ainda precisa ser retomada.

## Resultado esperado

Depois dessa mudança:
- o aluno marca uma série e ela fica salva imediatamente no aparelho
- se o app fechar, perder foco ou recarregar, o treino volta do ponto exato
- trocar para WhatsApp/Spotify não deve mais zerar o treino
- oscilações de sinal não afetam o progresso local da sessão
- o banco continua sendo usado apenas no momento de registrar oficialmente o treino concluído

## Arquivos envolvidos

- `src/pages/Treinos.tsx`
- `src/hooks/useSilentUpdate.ts`
- possivelmente um helper novo para centralizar a persistência do treino local, se isso deixar a lógica mais segura e reutilizável

## Detalhes técnicos

- Não precisa de migração no banco para este ajuste.
- A solução será local-first: persistência no aparelho antes de qualquer dependência de internet.
- A restauração seguirá o padrão já existente de limpeza defensiva para snapshots incompatíveis.
- Vou preservar a lógica atual de histórico/salvamento final no backend, mas separar melhor “sessão local em andamento” de “treino oficialmente concluído”.
- Se fizer sentido durante a implementação, transformarei a persistência em um pequeno utilitário com funções como:
  - `saveWorkoutExecutionSnapshot()`
  - `loadWorkoutExecutionSnapshot()`
  - `clearWorkoutExecutionSnapshot()`
  - `isWorkoutSnapshotValid()`

## Validação após implementação

Vou validar estes cenários:
- iniciar treino, marcar séries e recarregar manualmente
- iniciar treino, sair da aba e voltar
- abrir outro app e retornar
- restaurar treino no mesmo dia
- impedir restauração indevida quando o grupo/plano mudou
- finalizar ou cancelar treino e confirmar que o snapshot local foi limpo