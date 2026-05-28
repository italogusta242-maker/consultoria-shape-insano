# Correções no Relatório do Especialista

## Problemas identificados (pelas screenshots)

1. **Volume por Agrupamento**: os nomes dos grupos musculares (Ombro, Tríceps, Posterior, etc.) ficam cortados no eixo Y — só aparecem no hover. Causa: o YAxis categórico não tem `width` definido, então o Recharts reserva ~60px e corta nomes longos.

2. **Datas em formato ISO/curto**: nos gráficos "Evolução de Peso", "Progressão de Carga" e "Saúde Mental", o tooltip mostra a data crua (`2026-03-23`) e o eixo X mostra só `dd/mm`. Usuário quer **dd/mm/yyyy**.

3. **Faltando**: botão de **Exportar PDF** do relatório completo.

## Mudanças

### 1. `src/pages/especialista/EspecialistaRelatorio.tsx`

**a) Volume por Agrupamento (~linha 187-189)**
- Adicionar `width={80}` no `YAxis` categórico e reduzir `margin.left` adequadamente, para que os nomes dos grupos fiquem sempre visíveis.

**b) Formatação de datas dd/mm/yyyy** nos 3 gráficos (Progressão de Carga, Saúde Mental, Evolução de Peso):
- Criar helper `formatDateBR(val)` que recebe `YYYY-MM-DD` e retorna `DD/MM/YYYY`.
- Usar no `labelFormatter` do `<Tooltip>` (substituindo o atual que mostra a string crua).
- Manter o `tickFormatter` do XAxis em `dd/mm` (espaço curto), mas o tooltip ao tocar mostra a data completa `dd/mm/yyyy`.

**c) Botão Exportar PDF**
- Adicionar botão "Exportar PDF" no header (ao lado dos botões de tema/layout), com ícone `Download` do lucide-react.
- Envolver toda a área de conteúdo em uma `ref` (`reportRef`).
- Handler `handleExportPDF`:
  - Usar `html2canvas` (já presente como dep transitiva ou instalar) + `jsPDF` para capturar o `reportRef` e gerar A4 paisagem multi-página.
  - Nome do arquivo: `relatorio-{nomeAluno}-{mes-ano}.pdf`.
  - Forçar modo claro temporariamente durante a captura (melhor legibilidade no PDF) e restaurar ao final.
  - Mostrar toast de "Gerando PDF..." e "PDF exportado!".

### 2. Dependências
- `bun add jspdf html2canvas` se ainda não estiverem instaladas.

## Detalhes técnicos

```ts
const formatDateBR = (val: string) => {
  if (!val || !val.includes('-')) return val;
  const [y, m, d] = val.split('-');
  return `${d}/${m}/${y}`;
};
```

Exportação PDF (multi-página):
```ts
const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
const pdf = new jsPDF('p', 'mm', 'a4');
const pageW = 210, pageH = 297;
const imgH = (canvas.height * pageW) / canvas.width;
let heightLeft = imgH, position = 0;
pdf.addImage(canvas, 'PNG', 0, position, pageW, imgH);
heightLeft -= pageH;
while (heightLeft > 0) {
  position = heightLeft - imgH;
  pdf.addPage();
  pdf.addImage(canvas, 'PNG', 0, position, pageW, imgH);
  heightLeft -= pageH;
}
pdf.save(`relatorio-${nome}-${mes}.pdf`);
```

## Fora de escopo
- Não mexer em lógica de cálculo de dados (`useRelatorioPerformance`).
- Não alterar `StudentEvolutionChart`, `StudentLoadProgression`, `StudentMentalCheckins` (componentes separados usados em outras telas) — o reporte usa charts inline na própria página.
