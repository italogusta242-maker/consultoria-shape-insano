

## Linha do tempo do Nicolas Rocha

| Quando | O que aconteceu |
|---|---|
| **27/03 17:00** | Nicolas enviou a última reavaliação. Por causa do bug das fotos (já corrigido na última rodada), ela foi salva sem fotos. |
| **31/03 09:00** | Notificação automática "📋 Anamnese Mensal" → ele leu e ignorou. |
| **21/04 18:48** | Professor Guilherme Fernandes (personal) clicou em "Solicitar Anamnese" no portal. Foi criada a notificação `anamnese_request` no sino. |
| **21/04 → 22/04** | Nicolas abriu, leu (`read = true`), mas **nada acontecia ao clicar** — porque o `NotificationCenter` na versão que ele tem instalada (build antigo do PWA) só roteava `chat`, ignorando `anamnese_request`. |
| **Hoje** | `next_anamnese_due` dele está marcado como **26/04** (ainda futuro), então o banner amarelo grande "PREENCHER AGORA" também não aparece. Resultado: ele vê a notificação mas não consegue chegar na tela. |

A correção do roteamento já foi feita na rodada anterior (`NotificationCenter.tsx` agora navega para `/reavaliacao`), mas o Nicolas continua preso porque:
1. O PWA dele ainda está com o bundle antigo sem o roteamento.
2. Mesmo se atualizasse, a notificação atual já está marcada como lida e o banner do dashboard só aparece quando `next_anamnese_due ≤ hoje` — e a dele é 26/04.

## Plano de ação

**1. Forçar o caminho redundante no banco (resolve hoje, sem depender de update do app dele)**
- Atualizar `profiles.next_anamnese_due` do Nicolas para hoje (22/04). Isso faz o banner amarelo "⚠️ Anamnese Solicitada / PREENCHER AGORA" aparecer no dashboard dele assim que ele abrir o app, independente do sino e independente do bundle.
- Criar uma nova notificação `anamnese_request` (não lida) para ele, com texto reforçado do tipo "Seu professor reenviou a solicitação". Assim ele vê o badge vermelho voltando a piscar.

**2. Garantir que a correção definitiva chegue até ele**
- O fix do roteamento do sino já está no código. Quando o PWA dele atualizar (na próxima vez que abrir com rede), o clique na notificação também vai funcionar. O passo 1 funciona como caminho A prova de bundle antigo.

**3. Reforço estrutural (já incluído na rodada anterior, só validar)**
- Confirmar que em `EspecialistaAlunos.tsx`, ao clicar em "Solicitar Anamnese", o sistema agora também atualiza `next_anamnese_due = hoje` automaticamente. Isso evita que esse mesmo problema ocorra com qualquer outro aluno no futuro: o banner do dashboard sempre vai aparecer junto com a notificação no sino, eliminando o ponto único de falha.

## Resultado esperado para o Nicolas

- Ao abrir o app hoje: badge vermelho no sino + banner amarelo grande no dashboard com botão "PREENCHER AGORA" → clica e cai direto em `/reavaliacao`.
- Mesmo que o PWA dele esteja desatualizado, o banner do dashboard continua funcionando (não depende do roteamento do sino).
- Quando o app atualizar no background, o clique na própria notificação do sino também passa a funcionar.

## Detalhes técnicos

- 1 UPDATE em `profiles` (1 linha, campo `next_anamnese_due`).
- 1 INSERT em `notifications` (1 linha, tipo `anamnese_request`, `read = false`, com mensagem mais explícita).
- Validar no código que `EspecialistaAlunos.tsx` já está setando `next_anamnese_due = hoje` ao solicitar anamnese — se não estiver, completar o ajuste.
- Sem mudanças de schema, RLS ou triggers.

