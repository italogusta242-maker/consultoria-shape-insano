## Diagnóstico Real (não é o que parecia)

Antes de implementar, fui ver o estado atual:

- **Bucket `anamnese-photos` está PÚBLICO** (`public = true`) ✅
- **Políticas SELECT do Storage permitem qualquer autenticado lê-las** ✅
- **`getPublicUrl` retorna URLs públicas que não dependem de RLS** ✅

Ou seja, **NÃO É um problema de RLS/bucket privado**. As fotos pretas têm outra causa que descobri checando o banco:

```text
55e04e2d-186b-4e07-8ee5-5e25cb2b809e | 2026-04-24 | foto_frente: NULL
17eb749d-1ad4-4231-bc94-bcb1bf95ee02 | 2026-04-24 | foto_frente: NULL
191924d3-7e28-4a37-b30a-d8d05b204438 | 2026-04-23 | foto_frente: NULL
```

A causa raiz das "fotos pretas" são **registros `monthly_assessments` salvos sem URLs**, ou então arquivos no Storage que existem mas estão corrompidos/vazios (uploads que falharam silenciosamente). O código de upload (`submitMonthlyAssessment.ts`) já tem retry, mas alguns ainda escapam. E quando a foto chega como string vazia ou arquivo quebrado, o `<img>` renderiza um quadrado preto **sem disparar `onError`**, então o `SafeImage` não detecta a falha.

(Boa notícia: a refatoração que fiz na resposta anterior ao `photoTimeline.ts` já filtra entradas inválidas — então o problema dos "quadrados pretos" do print **já foi resolvido em parte**. Mas vou completar o blindamento.)

## O Plano

### A. Endurecer detecção de fotos quebradas

1. **`SafeImage`**: adicionar detecção pós-load via `naturalWidth === 0` (captura imagens "0x0" / corrompidas que não disparam `onError`). Já mostra fallback "Indisponível".
2. **`monthly_assessments` sanitization**: na hora de ler do banco (no editor do especialista e no `photoTimeline`), validar URLs antes de exibir — se vazia/quebrada, ocultar o quadrado completamente em vez de renderizar caixa preta.
3. **Limpeza retroativa (opcional, comentado no código)**: incluir migration que zere `foto_*` para strings vazias (NULL). Não roda automaticamente; documentado para o admin executar se quiser.

### B. Botão "Exportar Anamnese em PDF"

Adicionar um botão **"Exportar PDF"** no header da tela `EspecialistaAnamneseSplit` (tela completa de anamnese do aluno).

**Implementação técnica (não-print, profissional):**

- **Sem `html2canvas`** — geração de bitmap fica feia em A4 e não é selecionável/copiável.
- Usar **`jspdf` + `jspdf-autotable`** (libs leves, sem dependências pesadas) para gerar PDF nativo com texto vetorial:
  - Cabeçalho: logo Shape Insano, nome do aluno, data, especialista
  - Seções estruturadas (Objetivo & Treino, Academia, Saúde, Nutricional, Estilo de Vida) — mesmas que aparecem na tela
  - Tabelas formatadas com `jspdf-autotable`
  - Fotos da anamnese embedadas como imagens reais (uma página dedicada com grid 2x3)
  - Rodapé com paginação e marca d'água sutil
- Texto **selecionável e pesquisável** (não é screenshot)
- Nome do arquivo: `Anamnese_${nomeAluno}_${data}.pdf`

### C. Mensagem de erro melhor no upload de fotos

Pequeno ajuste em `submitMonthlyAssessment.ts`: quando uma foto falha após retry, registrar no toast **qual** foto falhou em vez de erro genérico, para o aluno saber exatamente o que reenviar.

## Arquivos

- **`src/components/ui/SafeImage.tsx`** — detecção de imagens corrompidas via `naturalWidth`
- **`src/lib/photoTimeline.ts`** — já endurecido na resposta anterior; pequeno ajuste para coerência
- **`src/pages/especialista/EspecialistaAnamneseSplit.tsx`** — botão "Exportar PDF" no header
- **`src/lib/exportAnamnesePdf.ts`** *(novo)* — função de geração do PDF com jspdf
- **`src/lib/submitMonthlyAssessment.ts`** — mensagens de erro mais granulares
- **package.json** — adicionar `jspdf` e `jspdf-autotable`

## Resultado esperado

- **Painel do especialista**: zero "quadrados pretos" — fotos quebradas viram cards "Indisponível" claros.
- **Botão "Exportar PDF"**: clique gera um PDF profissional com toda a anamnese (texto selecionável + fotos), sem precisar tirar print.
- **Aluno**: se um upload falhar, sabe exatamente qual foto reenviar.
