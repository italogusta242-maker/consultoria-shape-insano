/**
 * ============================================================
 * GOOGLE APPS SCRIPT - Copie e cole no Google Apps Script
 * ============================================================
 *
 * INSTRUÇÕES:
 * 1. Crie uma planilha no Google Sheets
 * 2. Na primeira linha, adicione os cabeçalhos (ou deixe em branco - o script cria automaticamente)
 * 3. Vá em Extensões > Apps Script
 * 4. Apague todo o conteúdo e cole o código abaixo
 * 5. Clique em "Implantar" > "Nova implantação"
 * 6. Tipo: "App da Web"
 * 7. Executar como: "Eu" (sua conta)
 * 8. Quem tem acesso: "Qualquer pessoa"
 * 9. Clique em "Implantar" e copie a URL gerada
 * 10. Cole a URL na constante WEBHOOK_URL em src/lib/submitAnamnese.ts
 *
 * ============================================================
 * CÓDIGO DO GOOGLE APPS SCRIPT (copie a partir daqui):
 * ============================================================
 *
 * function doPost(e) {
 *   try {
 *     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *     var data = JSON.parse(e.postData.contents);
 *
 *     // Se a planilha estiver vazia, cria os cabeçalhos
 *     if (sheet.getLastRow() === 0) {
 *       var headers = Object.keys(data);
 *       sheet.appendRow(headers);
 *     }
 *
 *     // Pega os cabeçalhos da primeira linha
 *     var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
 *
 *     // Monta a linha na ordem dos cabeçalhos
 *     var row = headers.map(function(header) {
 *       return data[header] || "";
 *     });
 *
 *     // Adiciona colunas novas que não existem ainda
 *     for (var key in data) {
 *       if (headers.indexOf(key) === -1) {
 *         headers.push(key);
 *         row.push(data[key]);
 *         sheet.getRange(1, headers.length).setValue(key);
 *       }
 *     }
 *
 *     sheet.appendRow(row);
 *
 *     return ContentService.createTextOutput(
 *       JSON.stringify({ result: "success" })
 *     ).setMimeType(ContentService.MimeType.JSON);
 *
 *   } catch (error) {
 *     return ContentService.createTextOutput(
 *       JSON.stringify({ result: "error", message: error.toString() })
 *     ).setMimeType(ContentService.MimeType.JSON);
 *   }
 * }
 *
 * // Necessário para lidar com requisições OPTIONS (CORS preflight)
 * function doGet(e) {
 *   return ContentService.createTextOutput("OK");
 * }
 *
 * ============================================================
 */

// Este arquivo serve apenas como documentação/referência.
// O código acima deve ser colado no Google Apps Script.
export {};
