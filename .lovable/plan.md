

## Diagnóstico: Fotos do Diogo (e 55 outros alunos) são URLs do Google Drive

### Causa raiz

As fotos da anamnese deste aluno (e de outros 56 registros) estão armazenadas como URLs do Google Drive no formato:
```
https://drive.google.com/open?id=1LF4ngYez98xEimLp-El5ca8Swd3yljOq
```

Esse formato **não funciona** como `src` de uma tag `<img>` porque o Google Drive não serve a imagem diretamente nessa URL. Além disso, o `StudentPhotosPanel` busca fotos **apenas no storage bucket** e ignora completamente as URLs salvas no campo `dados_extras.fotos` da anamnese.

Ou seja: o componente procura no bucket, não encontra nada, e mostra "Nenhuma foto disponível" — ou, se encontra algo no bucket, mostra só isso e ignora as fotos do Drive.

### Escopo do problema

- **56 anamneses** com URLs do Google Drive (dados importados via CSV/Sheets)
- **0 anamneses** com URLs do Supabase Storage (novos uploads via app já vão pro bucket)
- `monthly_assessments`: sem URLs do Drive (OK)

### Plano de correção

#### 1. Atualizar `getDisplayableImageUrl` para converter URLs do Google Drive
**Arquivo:** `src/lib/imageUtils.ts`

Adicionar lógica para converter `drive.google.com/open?id=XXX` para `drive.google.com/thumbnail?id=XXX&sz=w800`, que é o formato que o Google Drive serve como imagem direta.

#### 2. Adicionar fallback de `dados_extras.fotos` no `StudentPhotosPanel`
**Arquivo:** `src/components/especialista/StudentPhotosPanel.tsx`

Quando o bucket storage não tem arquivos, buscar as URLs de `anamnese.dados_extras->fotos` como fallback. Aplicar `getDisplayableImageUrl` nessas URLs.

#### 3. Aplicar conversão nas fotos da anamnese no split view
**Arquivo:** `src/pages/especialista/EspecialistaAnamneseSplit.tsx`

Garantir que as fotos exibidas (tanto do bucket quanto do `dados_extras`) passem pelo `getDisplayableImageUrl`.

#### 4. Aplicar na página de evolução do aluno
**Arquivo:** `src/pages/MinhaEvolucao.tsx`

Mesma lógica de fallback e conversão de URLs.

---

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `src/lib/imageUtils.ts` | Converter Google Drive URLs para formato de thumbnail exibível |
| `src/components/especialista/StudentPhotosPanel.tsx` | Fallback para `dados_extras.fotos` quando bucket vazio |
| `src/pages/especialista/EspecialistaAnamneseSplit.tsx` | Garantir conversão de URLs |
| `src/pages/MinhaEvolucao.tsx` | Garantir conversão de URLs |

