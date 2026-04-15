
Diagnóstico objetivo

- Não é um problema específico do Diego.
- O Diego está em um caso “misto”:
  1. a anamnese dele tem 5 fotos legadas em links do Google Drive (`open?id=...`);
  2. esses links hoje não servem imagem pública — quando convertidos para thumbnail, retornam tela de login do Google;
  3. ele também tem uma reavaliação de 23/03 com fotos válidas no storage, mas o app não está escolhendo essa fonte corretamente.

O que está acontecendo no código

- `StudentPhotosPanel.tsx`
  - busca apenas a reavaliação mais recente;
  - se a mais recente não tiver fotos, cai direto para a anamnese;
  - isso ignora reavaliações anteriores que têm fotos válidas.
- `MinhaEvolucao.tsx`
  - só lê fotos de `anamnese`;
  - ignora totalmente `monthly_assessments`.
- `imageUtils.ts`
  - a conversão de URL do Google Drive está correta para links públicos;
  - o problema é que os arquivos legados do Diego não estão públicos, então o preview nunca vai abrir só com frontend.

Conclusão da causa raiz

- Existem 56 anamneses com links legados do Google Drive.
- Esses links não são confiáveis para preview porque hoje estão privados.
- Então há 2 problemas reais:
  1. lógica de seleção de fonte de foto está errada;
  2. parte do acervo legado está inacessível na origem.

Plano de correção

1. Criar um resolvedor único de fotos
- Centralizar a lógica em um util compartilhado para:
  - ler reavaliações com foto;
  - ler bucket `anamnese-photos`;
  - ler `dados_extras.fotos`;
  - normalizar labels/chaves (`foto_frente`, `frente`, `foto_direito`, etc.);
  - ordenar por data e retornar “a entrada mais recente com fotos reais”.

2. Corrigir o painel do especialista
- Em `src/components/especialista/StudentPhotosPanel.tsx`:
  - parar de usar “última reavaliação” e passar a usar “último registro com fotos”;
  - se a reavaliação mais nova estiver vazia, usar a reavaliação anterior com fotos antes de cair para anamnese;
  - manter timeline consolidada com todas as fontes.

3. Corrigir a tela do aluno
- Em `src/pages/MinhaEvolucao.tsx`:
  - incluir `monthly_assessments` na evolução;
  - usar o mesmo resolvedor do especialista;
  - assim o Diego passa a ver as fotos válidas de março mesmo que a anamnese legada continue privada.

4. Tratar links legados quebrados explicitamente
- Quando a origem for Google Drive legado e a imagem falhar:
  - exibir estado visual claro de “foto legada indisponível”;
  - evitar card vazio/quebrado;
  - no portal do especialista, oferecer caminho rápido para reenvio via `LegacyPhotosUpload`.

5. Resolver o problema histórico da plataforma
- Como os links legados do Google Drive estão privados, frontend não consegue recuperar essas imagens.
- A correção definitiva para os 56 casos é migrar o acervo legado para o storage da plataforma.
- Implementação proposta:
  - mapear todos os registros com `dados_extras.fotos` do Drive;
  - tentar usar qualquer foto já existente em `monthly_assessments`/bucket antes de marcar como pendente;
  - deixar os restantes como “necessitam reupload/migração”.
- Se houver acesso real aos arquivos do Drive, depois podemos fazer uma migração em lote; sem esse acesso, o máximo possível é sinalizar e reparar via upload.

Arquivos a ajustar

- `src/components/especialista/StudentPhotosPanel.tsx`
- `src/pages/MinhaEvolucao.tsx`
- `src/pages/especialista/EspecialistaAnamneseSplit.tsx` (para manter consistência visual e de fallback)
- `src/lib/imageUtils.ts`
- novo util compartilhado, por exemplo:
  - `src/lib/photoTimeline.ts` ou similar

Impacto esperado

- Diego volta a aparecer no especialista usando as fotos válidas da reavaliação.
- A evolução do aluno deixa de depender só da anamnese legada.
- Casos com Drive privado deixam de quebrar silenciosamente.
- A plataforma fica corrigida para trás também, com estratégia clara para os 56 registros legados.
