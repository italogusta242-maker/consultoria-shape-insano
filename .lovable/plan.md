

## Diagnóstico: Imagens quebradas no app

### Causa raiz

No arquivo `src/components/especialista/StudentPhotosPanel.tsx` (linha 185), as URLs das fotos recebem parâmetros de transformação de imagem (`?width=300&height=400&resize=contain`) que **não são suportados** pelo storage do projeto. Isso faz com que as imagens retornem erro em vez de carregar.

```typescript
// Linha 185 — PROBLEMA
const thumbUrl = p.url! + (p.url!.includes('?') ? '&' : '?') + 'width=300&height=400&resize=contain';
```

Esse código foi adicionado numa tentativa de otimizar performance, mas quebrou a exibição das fotos.

### Sobre a página de login

O arquivo de imagem `auth-bg.webp` existe corretamente no projeto. Se a imagem não aparece para o usuário, pode ser cache do navegador. O código está correto.

### Plano de correção

**Arquivo:** `src/components/especialista/StudentPhotosPanel.tsx`

1. Remover a linha que adiciona os parâmetros de transformação de imagem (linha 185)
2. Usar a URL original direta do storage para as thumbnails

| Arquivo | Mudança |
|---------|---------|
| `src/components/especialista/StudentPhotosPanel.tsx` | Remover query params de transformação de imagem que quebram as URLs |

