

## Plano: Badge de não lidos no Chat + Marcar como não lido

### O que será feito

1. **Badge de mensagens não lidas na sidebar do especialista** — O item "Chat" na navegação lateral mostrará um número com a quantidade total de conversas com mensagens não lidas.

2. **Opção "Marcar como não lido"** — No chat do especialista, ao clicar com botão direito ou via menu de contexto em uma conversa na lista lateral, o especialista poderá marcar aquela conversa como não lida.

### Alterações técnicas

#### 1. Hook `useUnreadConversations` (novo)
**Arquivo:** `src/hooks/useUnreadConversations.ts`
- Consulta `chat_messages` para cada conversa do especialista, comparando com `message_reads` para calcular quantas conversas têm mensagens não lidas
- Retorna o total de conversas não lidas (número para o badge)
- Escuta realtime em `chat_messages` para atualizar automaticamente
- Considera também um estado local de "forçar não lido" (para o recurso de marcar como não lido)

#### 2. Badge no nav "Chat" do layout
**Arquivo:** `src/components/especialista/EspecialistaLayout.tsx`
- Importar o hook `useUnreadConversations`
- Passar o count como badge do item "Chat" no `navItems`

#### 3. Marcar como não lido na lista de conversas
**Arquivo:** `src/pages/especialista/EspecialistaChat.tsx`
- Adicionar menu de contexto (long press no mobile / right click no desktop) em cada item da lista
- Opção "Marcar como não lido" que deleta os `message_reads` do especialista para a última mensagem daquela conversa (ou usa um estado local/tabela auxiliar)
- Visualmente, a conversa mostrará um indicador de não lido (bolinha azul)

#### 4. Contagem de não lidos por conversa no sidebar do chat
**Arquivo:** `src/pages/especialista/EspecialistaChat.tsx`
- Calcular `unread` count real para cada `SidebarItem` comparando `message_reads` com mensagens existentes
- Exibir badge numérico no item da conversa quando `unread > 0`

### Abordagem para "marcar como não lido"
- Deletar o último `message_read` do usuário para aquela conversa via `supabase.from("message_reads").delete()`
- Isso faz o sistema recalcular como não lido naturalmente
- A tabela `message_reads` já permite DELETE pelo próprio usuário? Não — precisa de migration para adicionar policy DELETE.

#### Migration SQL
- Adicionar policy DELETE em `message_reads` para que o usuário possa deletar seus próprios registros

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useUnreadConversations.ts` | Novo hook para contar conversas não lidas |
| `src/components/especialista/EspecialistaLayout.tsx` | Badge no item Chat |
| `src/pages/especialista/EspecialistaChat.tsx` | Menu "marcar não lido" + badge por conversa |
| Migration SQL | Policy DELETE em message_reads |

