

## Como funciona o mecanismo de alertas hoje

**Não é tempo real.** O sistema usa **polling com React Query**:

- Hook `useProactiveAlerts` faz uma query agregando dados de 8 tabelas (anamnese, planos, treinos, profiles, monthly_assessments, subscriptions, etc.) e calcula os alertas no cliente.
- `refetchInterval: 5 * 60 * 1000` → recarrega automaticamente **a cada 5 minutos**.
- Também recarrega quando a aba volta ao foco (comportamento padrão do React Query).
- Ao dispensar/limpar/restaurar alertas, é feito `invalidateQueries(["proactive-alerts"])` que dispara refetch imediato.

**Botão "Restaurar" atual:** chama `restoreAll` que faz `DELETE` na tabela `dismissed_alerts`, fazendo reaparecer alertas que o especialista havia dispensado. Útil, mas pouco usado e o nome confunde com "atualizar".

---

## Mudança proposta

Transformar o botão "Restaurar" em **"Atualizar"** — força um refetch imediato dos alertas (busca dados novos do banco agora, sem esperar os 5 minutos).

A funcionalidade de "restaurar dispensados" fica preservada como uma ação secundária dentro de um menu (3 pontinhos), para não perdê-la.

### Comportamento do novo botão "Atualizar"
- Ícone: `RefreshCw` (girando enquanto carrega)
- Ao clicar: `queryClient.invalidateQueries({ queryKey: ["proactive-alerts"] })`
- Toast: "Alertas atualizados" quando termina
- Disabled enquanto `isFetching === true`

### Onde fica "Restaurar dispensados"
Adicionar um `DropdownMenu` com ícone `MoreVertical` ao lado dos botões, contendo:
- Restaurar alertas dispensados (a função `restoreAll` atual)

Assim o especialista mantém acesso à função, mas o botão principal vira o que ele realmente espera: **atualizar agora**.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/especialista/EspecialistaDashboard.tsx` | Trocar botão "Restaurar" por "Atualizar" (refetch). Mover "Restaurar dispensados" para dropdown menu. |

Nenhuma mudança no hook ou no banco — apenas UI.

