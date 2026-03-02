/**
 * Parser e mapeamento do CSV de Anamnese (Google Forms) para os campos da plataforma.
 * O CSV exportado do Google Forms tem headers multiline com campos quoted.
 * 
 * Mapeamento por índice de coluna (0-based):
 */

// Column index → field mapping
const COLUMN_MAP: Record<number, { table: 'profile' | 'anamnese' | 'extras' | 'skip'; field: string }> = {
  0:  { table: 'skip', field: 'timestamp' },
  1:  { table: 'profile', field: 'nome' },
  2:  { table: 'profile', field: 'email' },
  3:  { table: 'profile', field: 'telefone' },
  4:  { table: 'profile', field: 'nascimento' },
  5:  { table: 'profile', field: 'cpf' },
  6:  { table: 'profile', field: 'cidade_estado' },
  7:  { table: 'profile', field: 'sexo' },
  8:  { table: 'profile', field: 'faixa_etaria' },
  9:  { table: 'profile', field: 'tempo_acompanha' },
  10: { table: 'profile', field: 'altura' },
  11: { table: 'profile', field: 'fatores_escolha' },
  12: { table: 'profile', field: 'peso' },
  13: { table: 'profile', field: 'indicacao' },
  14: { table: 'profile', field: 'indicacao_nome' },
  15: { table: 'profile', field: 'indicacao_telefone' },
  16: { table: 'skip', field: 'instrucoes_foto' },
  17: { table: 'extras', field: 'foto_frente_url' },
  18: { table: 'extras', field: 'foto_costas_url' },
  19: { table: 'extras', field: 'foto_direito_url' },
  20: { table: 'extras', field: 'foto_esquerdo_url' },
  21: { table: 'extras', field: 'foto_perfil_url' },
  22: { table: 'anamnese', field: 'objetivo' },
  23: { table: 'extras', field: 'objetivo_outro' },
  24: { table: 'extras', field: 'fisiculturismo' },
  25: { table: 'extras', field: 'foto_pose_frente_url' },
  26: { table: 'extras', field: 'foto_pose_lado_url' },
  27: { table: 'extras', field: 'foto_pose_costas_url' },
  28: { table: 'extras', field: 'influenciador_favorito' },
  29: { table: 'anamnese', field: 'experiencia_treino' },
  30: { table: 'anamnese', field: 'local_treino' },
  31: { table: 'anamnese', field: 'equipamentos' },
  32: { table: 'anamnese', field: 'disponibilidade_treino' },
  33: { table: 'anamnese', field: 'frequencia_treino' },
  34: { table: 'extras', field: 'horario_treino' },
  35: { table: 'extras', field: 'tempo_treino' },
  36: { table: 'extras', field: 'tempo_cardio' },
  37: { table: 'extras', field: 'treino_antigo' },
  38: { table: 'extras', field: 'grupos_prioritarios' },
  39: { table: 'extras', field: 'tem_dor' },
  40: { table: 'anamnese', field: 'lesoes' },
  41: { table: 'extras', field: 'exercicio_nao_gosta' },
  42: { table: 'extras', field: 'exercicio_nao_gosta_desc' },
  43: { table: 'extras', field: 'maquinas_nao_tem' },
  44: { table: 'skip', field: 'maquina_foto' },
  45: { table: 'anamnese', field: 'condicoes_saude' },
  46: { table: 'extras', field: 'doenca_outra' },
  47: { table: 'extras', field: 'historico_familiar' },
  48: { table: 'extras', field: 'historico_familiar_desc' },
  49: { table: 'anamnese', field: 'medicamentos' },
  50: { table: 'extras', field: 'alergias' },
  51: { table: 'extras', field: 'alergia_outra' },
  52: { table: 'extras', field: 'nivel_atividade' },
  53: { table: 'extras', field: 'passos_calorias' },
  54: { table: 'extras', field: 'faz_cardio' },
  55: { table: 'extras', field: 'tempo_cardio_nutri' },
  56: { table: 'extras', field: 'tempo_cardio_outro' },
  57: { table: 'extras', field: 'refeicoes_dia' },
  58: { table: 'extras', field: 'horario_refeicoes' },
  59: { table: 'anamnese', field: 'dieta_atual' },
  60: { table: 'extras', field: 'tempo_calorias' },
  61: { table: 'anamnese', field: 'sono_horas' },
  62: { table: 'anamnese', field: 'nivel_estresse' },
  63: { table: 'extras', field: 'alimentos_diarios' },
  64: { table: 'extras', field: 'alimentos_nao_come' },
  65: { table: 'anamnese', field: 'agua_diaria' },
  66: { table: 'extras', field: 'agua_outra' },
  67: { table: 'extras', field: 'liquido_refeicao' },
  68: { table: 'extras', field: 'liquido_qual' },
  69: { table: 'extras', field: 'investimento_dieta' },
  70: { table: 'extras', field: 'faixa_salarial' },
  71: { table: 'anamnese', field: 'restricoes_alimentares' },
  72: { table: 'extras', field: 'frutas' },
  73: { table: 'extras', field: 'fruta_outra' },
  74: { table: 'anamnese', field: 'suplementos' },
  75: { table: 'extras', field: 'suplemento_outro' },
  76: { table: 'extras', field: 'uso_hormonios' },
  77: { table: 'extras', field: 'frequencia_evacuacao' },
  78: { table: 'extras', field: 'sintomas_digestao' },
  79: { table: 'extras', field: 'escala_bristol' },
  80: { table: 'skip', field: 'termo' },
  81: { table: 'skip', field: 'final' },
};

export interface ParsedAnamneseRow {
  profile: Record<string, string>;
  anamnese: Record<string, string>;
  dados_extras: Record<string, string>;
  timestamp: string;
}

/**
 * Parse a CSV string handling quoted fields with newlines and commas.
 */
function parseCSVLine(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.length > 1) { // skip empty lines
          rows.push(currentRow);
        }
        currentRow = [];
        if (char === '\r') i++; // skip \n after \r
      } else {
        currentField += char;
      }
    }
  }
  
  // Last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

/**
 * Find where data rows start (skip multiline header).
 * Data rows start with a timestamp pattern like DD/MM/YYYY HH:MM:SS
 */
function isDataRow(row: string[]): boolean {
  if (!row[0]) return false;
  return /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/.test(row[0]);
}

/**
 * Parse the full CSV and return structured rows ready for import.
 */
export function parseAnamneseCSV(csvText: string): ParsedAnamneseRow[] {
  const allRows = parseCSVLine(csvText);
  const dataRows = allRows.filter(isDataRow);
  
  return dataRows.map((row) => {
    const profile: Record<string, string> = {};
    const anamnese: Record<string, string> = {};
    const dados_extras: Record<string, string> = {};
    let timestamp = '';
    
    row.forEach((value, index) => {
      const mapping = COLUMN_MAP[index];
      if (!mapping || !value) return;
      
      if (index === 0) {
        timestamp = value;
        return;
      }
      
      switch (mapping.table) {
        case 'profile':
          profile[mapping.field] = value;
          break;
        case 'anamnese':
          anamnese[mapping.field] = value;
          break;
        case 'extras':
          dados_extras[mapping.field] = value;
          break;
      }
    });
    
    // Handle "tem_dor" → merge into anamnese.lesoes
    if (dados_extras.tem_dor?.toLowerCase() === 'não' || dados_extras.tem_dor?.toLowerCase() === 'nao') {
      delete anamnese.lesoes; // no injury
    }
    delete dados_extras.tem_dor;
    
    // Handle fotos → group into dados_extras.fotos
    const fotos: Record<string, string> = {};
    const fotoKeys = ['foto_frente_url', 'foto_costas_url', 'foto_direito_url', 'foto_esquerdo_url', 'foto_perfil_url',
                      'foto_pose_frente_url', 'foto_pose_lado_url', 'foto_pose_costas_url'];
    fotoKeys.forEach(k => {
      if (dados_extras[k]) {
        fotos[k.replace('_url', '')] = dados_extras[k];
        delete dados_extras[k];
      }
    });
    if (Object.keys(fotos).length > 0) {
      (dados_extras as any).fotos = fotos;
    }
    
    return { profile, anamnese, dados_extras, timestamp };
  });
}

/**
 * Get a preview summary of parsed data for confirmation UI.
 */
export function getImportPreview(rows: ParsedAnamneseRow[]): { 
  total: number; 
  sample: { nome: string; email: string; objetivo: string }[] 
} {
  return {
    total: rows.length,
    sample: rows.slice(0, 5).map(r => ({
      nome: r.profile.nome || '(sem nome)',
      email: r.profile.email || '(sem email)',
      objetivo: r.anamnese.objetivo || r.dados_extras.objetivo_outro || '(não informado)',
    })),
  };
}
