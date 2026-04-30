
## Todas as brechas identificadas

### 1. Tela desliga e OS mata o PWA (o caso do Vinicius)
Quando o celular bloqueia, o Android/iOS pode matar a aba do PWA para economizar bateria. O snapshot **já é salvo** no localStorage, mas quando o aluno reabre o app, ele cai no **Dashboard** e pensa que perdeu tudo. O treino está salvo, mas ele não sabe — precisa navegar manualmente para /treinos.

**Correção:** Auto-redirect do Dashboard para /treinos se existir snapshot ativo.

### 2. Wake Lock só no timer de descanso
O Wake Lock (que impede a tela de desligar sozinha) só está ativo durante o descanso entre séries. Na execução normal dos exercícios, a tela pode apagar por inatividade (o aluno está treinando, não tocando no celular).

**Correção:** Wake Lock durante toda a execução do treino, não só no descanso.

### 3. Deploy novo enquanto treina
Se um deploy acontecer enquanto o aluno treina e ele minimizar/voltar ao app, o `useSilentUpdate` no evento `onFocus` reseta o flag e roda `runVersionCheck()`. Dentro de `runVersionCheck` ele checa `isWorkoutActive()` — **isso funciona**, mas existe uma race condition: o `fetchDeployedVersion()` é async, e entre o fetch e o check do snapshot, poderia haver um timing issue.

**Correção:** Checar `isWorkoutActive()` **antes** de resetar o flag no `onFocus`, como guard inicial.

### 4. Sessão de auth expira durante treino longo
Se o aluno treinar por mais de 1h com o app em background, o token JWT pode expirar. Quando ele volta, o Supabase tenta refresh, mas se falhar, o `AuthContext` redireciona para login. Após re-login, cai no Dashboard — de novo sem saber que o snapshot está salvo.

**Correção:** O mesmo auto-redirect do item 1 resolve isso. O snapshot sobrevive no localStorage independente do auth.

### 5. Aluno não recebe feedback visual da restauração
Quando o snapshot é restaurado, o treino simplesmente aparece como se nada tivesse acontecido. O aluno pode não perceber que foi recuperado, ou pode ficar confuso sobre o timer.

**Correção:** Toast "Treino em andamento restaurado!" ao detectar e restaurar um snapshot.

### 6. `visibilitychange: hidden` + novo SW = reload imediato
Linha 121: se um novo Service Worker foi instalado (`newSwInstalled.current = true`) e o app vai para background, ele faz `reload()` imediatamente. A proteção `!isWorkoutActive()` existe, mas se por algum motivo o snapshot não foi salvo ainda (race condition entre o save e o evento), pode perder dados.

**Correção:** Já está protegido, mas o Wake Lock vai reduzir drasticamente as chances de o app ir para background durante o treino.

## Plano de implementação

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Treinos.tsx` | Adicionar Wake Lock durante `view === "execution"` (re-adquirir no `visibilitychange`). Adicionar toast ao restaurar snapshot. |
| `src/pages/Dashboard.tsx` | No mount, verificar `hasWorkoutExecutionSnapshot()` e redirecionar para `/treinos` |
| `src/hooks/useSilentUpdate.ts` | No `onFocus`, checar `isWorkoutActive()` antes de resetar flag e rodar version check |

Nenhuma mudança no banco de dados necessária. Tudo é client-side.
