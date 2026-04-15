

## Fotos do Diogo Moreira (e outros alunos com dados do Google Drive)

### O que está acontecendo

O Diogo tem as fotos salvas como URLs do Google Drive no campo `dados_extras.fotos` da anamnese:
```
foto_frente: https://drive.google.com/open?id=1t6AE65...
foto_costas: https://drive.google.com/open?id=1LF4ng...
(etc.)
```

O código **tenta primeiro** buscar fotos no storage bucket. Quando faz `.list()` na pasta do storage, o Supabase retorna arquivos placeholder (como `.emptyFolderPlaceholder`). Como `files.length > 0`, o código acha que tem fotos lá e nunca chega ao fallback que leria as URLs reais do Google Drive.

Alunos que **não** têm essa pasta no storage funcionam porque `files` volta vazio e o fallback é acionado. Outros alunos com fotos reais no bucket também funcionam. O problema é específico de alunos que têm pasta criada mas sem fotos reais — só placeholders.

### Correção

**Filtrar arquivos do storage** para aceitar apenas extensões de imagem válidas. Se nenhum arquivo válido for encontrado, o fallback para `dados_extras.fotos` é acionado normalmente.

```typescript
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|heic|heif|gif|tiff?)$/i;
const validFiles = (files || []).filter(f => IMAGE_EXT.test(f.name));
```

| Arquivo | Mudança |
|---------|---------|
| `src/components/especialista/StudentPhotosPanel.tsx` | Filtrar placeholders em 3 pontos (query fotos, fallback anamnese, timeline) |
| `src/pages/MinhaEvolucao.tsx` | Mesmo filtro na listagem do storage |

