## Problema

O sistema de "UI gamificada" (Trégua / Chama Extinta) foi desenhado exclusivamente para o modo escuro:

- Os tokens `--dishonor-*` e `--truce-*` em `index.css` têm valores escuros e nunca são redefinidos no bloco `.light`.
- `Dashboard.tsx` e `FlameCard.tsx` usam **dezenas de cores HSL hardcoded** (ex.: `hsl(270, 15%, 60%)`, `hsl(210, 25%, 7%)`) para fundos de página, bordas, textos de citação, gradientes de botão e barras de progresso.

Resultado no print: no modo claro com Chama Extinta, o `pageBg` força fundo arroxeado escuro, o card "Bem-vindo ao Coliseu / ITALO..." fica com texto roxo invisível, os stat cards (Performance / Mental) ficam roxos com texto ilegível, e o card da chama central fica preto sobre quase preto.

## Plano de ação (cirúrgico)

### 1. `src/index.css` — adicionar overrides `.light` para os tokens dinâmicos

Dentro do bloco `.light { ... }` redefinir:

- `--dishonor-bg`, `--dishonor-card`, `--dishonor-border`, `--dishonor-muted`, `--dishonor-accent`, `--dishonor-glow` → versões claras (fundo lavanda muito suave, bordas finas roxa-acinzentadas, texto roxo escuro legível sobre branco).
- `--truce-bg`, `--truce-card`, `--truce-border`, `--truce-muted`, `--truce-accent`, `--truce-glow` → versões claras equivalentes em azul.

Isso resolve automaticamente todo o uso de `hsl(var(--dishonor-card))`, `hsl(var(--truce-border))` etc. em `FlameCard.tsx`, `StoicQuote` do Dashboard, e nos overrides `bg-[hsl(var(--dishonor-card))]`.

### 2. `src/pages/Dashboard.tsx` — desligar overrides hardcoded no modo claro

Adicionar `const isLight = document.documentElement.classList.contains("light")` (ou via `useTheme()`) no topo do componente e ramificar todas as constantes que hoje usam HSL escuros:

- `pageBg` → `undefined` em light (deixa o `bg-background` neutro aparecer).
- `quoteBorder`, `quoteTextColor` → versões claras (`hsl(270, 20%, 35%)` para texto, `hsl(220, 13%, 91%)` para borda).
- Gradientes de botão (`buttonGradient`/`buttonShadow`) para Trégua/Extinta → versões saturadas mais vivas em fundo claro (mantém o roxo/azul de marca mas com luminância adequada para texto branco).
- `mealBarColor`/`sleepBarColor`/`waterBarColor`/`volumeBarColor`/`chartColor` → versões com saturação maior em light (acentos vívidos, conforme já exigido pela diretriz "destacar vividamente em ambos os modos").
- `iconAccentColor`/`iconAccentClass`/`dropletsClass`/`statIconColor` → usar HSL com luminância em torno de 45% no light em vez de 40-50% no dark.
- Pequeno ajuste: o trilho da barra de Performance (`hsl(0, 0%, 20%)` linha 350) também precisa virar `hsl(var(--muted))` para não ficar quase preto sobre branco.

### 3. `src/components/FlameCard.tsx` — fazer o card respeitar o modo

Trocar `progressColor`, `gradientStart`, `iconColor`, `numberColor`, `labelColor`, `subtitleColor` por valores `light`-aware nos states `tregua` e `extinta`. Em particular:

- `numberColor` em Extinta hoje é `hsl(0, 0%, 60%)` → em fundo claro fica fantasma; usar token `hsl(var(--foreground))` ou um cinza escuro (`hsl(270, 20%, 30%)`).
- Trilho do círculo SVG (`stroke="hsl(0, 0%, 22%)"`, linha 106) → `hsl(var(--muted))`.
- `subtitleColor` Extinta `hsl(270, 15%, 40%)` continua ok em claro; verificar contraste e ajustar para `hsl(270, 25%, 35%)`.

Implementação: mesmo padrão de detectar `isLight` e selecionar o conjunto de cores adequado dentro do `stateConfig`.

### 4. Verificação visual

Após as mudanças, rodar o preview no modo claro nas três telas-chave:

- `/` Dashboard com Chama Extinta (caso do print) → confirmar fundo branco/slate, textos legíveis, acento roxo nítido.
- `/` Dashboard com Trégua → mesmo check em azul.
- Componente `FlameCard` nos 3 estados (normal/ativa/tregua/extinta).

E re-verificar o modo escuro para garantir que nada regrediu (os tokens dark continuam intactos no `:root`).

## Detalhes técnicos

- Sem mudanças em DB, edge functions, ou lógica de negócio. Estritamente UI/CSS.
- Sem mudanças em outros componentes (`WorkoutShareCard` usa os tokens, então herdará automaticamente as cores claras do passo 1).
- Não vou expandir o escopo para criar um `useThemeAwareColor` global agora — apenas a detecção pontual em Dashboard e FlameCard, mantendo o "surgical strike".
