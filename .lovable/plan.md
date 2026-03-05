

# Plano: Exibir campos "Outros" na Anamnese do Especialista

## Problema
Quando o aluno seleciona "Outros" em campos como objetivo, doenças, alergias, etc., o formulário salva dois campos no `dados_extras`: o campo principal (ex: `objetivo` = "Outros") e o campo de texto livre (ex: `objetivo_outro` = "Ganhar massa magra focando em costas"). A tela do especialista só exibe o campo principal, perdendo a informação detalhada.

## Campos afetados (pares principal → texto livre)
| Campo principal | Campo "outro" no JSONB |
|---|---|
| `objetivo` | `objetivo_outro` |
| `doencas` | `doenca_outra` |
| `alergias` | `alergia_outra` |
| `suplementos` | `suplemento_outro` |
| `medicamentos` | `medicamento_outro` |
| `exercicio_nao_gosta` | `exercicio_nao_gosta_desc` |
| `historico_familiar` | `historico_familiar_desc` |
| `maquinas_nao_tem` | `maquina_outra` |
| `frutas` | `fruta_outra` |
| `agua` | `agua_outra` |

## Solução

Arquivo: `src/pages/especialista/EspecialistaAnamneseSplit.tsx`

1. **Criar helper `extraValWithOther`**: Uma nova função que recebe a chave principal e a chave "outro". Se o valor principal contiver "Outro" (case-insensitive), concatena com o texto livre. Se ambos existirem, exibe `"Outros: texto detalhado"`. Se só o texto livre existir, exibe ele diretamente.

2. **Atualizar cada `<Field>` afetado** para usar o novo helper, passando o par de chaves corretas. Exemplo:
   - `<Field label="Objetivo" value={extraValWithOther("objetivo", "objetivo_outro")} />`
   - `<Field label="Doenças" value={extraValWithOther("doencas", "doenca_outra")} />`
   - etc.

3. **Adicionar campos que estão completamente ausentes da UI**: Alguns campos do `dados_extras` (como `influenciador_favorito`, `uso_hormonios`, `frequencia_evacuacao`, `sintomas_digestao`, `escala_bristol`, `faixa_salarial`, `passos_calorias`) nunca são exibidos. Eles serão adicionados nas seções correspondentes.

4. **Também exibir campos da tabela `anamnese` direta** que atualmente são ignorados em favor do `dados_extras` (ex: `anamnese.objetivo`, `anamnese.lesoes`, `anamnese.medicamentos`, `anamnese.condicoes_saude`, `anamnese.restricoes_alimentares`, `anamnese.suplementos`, `anamnese.agua_diaria`, `anamnese.sono_horas`, `anamnese.nivel_estresse`, `anamnese.dieta_atual`). A lógica será: exibir o valor do `dados_extras` se disponível, senão fallback para o campo direto da tabela `anamnese`.

## Escopo
- Apenas `EspecialistaAnamneseSplit.tsx` (componente de renderização)
- Zero alteração no banco de dados
- Zero alteração no formulário de onboarding

