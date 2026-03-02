import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { parseAnamneseCSV, getImportPreview, type ParsedAnamneseRow } from "@/lib/csvAnamneseParser";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

const AdminImportarAlunos = () => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedAnamneseRow[]>([]);
  const [preview, setPreview] = useState<{ total: number; sample: { nome: string; email: string; objetivo: string }[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ imported: number; updated: number; errors: string[] } | null>(null);

  const handleFileSelect = async (file: File | null) => {
    setCsvFile(file);
    setParsedRows([]);
    setPreview(null);
    setResults(null);

    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseAnamneseCSV(text);

      if (rows.length === 0) {
        toast.error("Nenhum registro encontrado no CSV");
        return;
      }

      setParsedRows(rows);
      setPreview(getImportPreview(rows));
      toast.success(`${rows.length} registros encontrados no CSV`);
    } catch (err: any) {
      toast.error("Erro ao ler CSV: " + err.message);
    }
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    setProgress(0);
    setResults(null);

    try {
      // Send in batches of 10
      const batchSize = 10;
      const totalBatches = Math.ceil(parsedRows.length / batchSize);
      let totalImported = 0;
      let totalUpdated = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < totalBatches; i++) {
        const batch = parsedRows.slice(i * batchSize, (i + 1) * batchSize);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const response = await supabase.functions.invoke("import-anamnese", {
          body: { rows: batch },
        });

        if (response.error) {
          allErrors.push(`Lote ${i + 1}: ${response.error.message}`);
        } else if (response.data) {
          totalImported += response.data.imported || 0;
          totalUpdated += response.data.updated || 0;
          if (response.data.errors?.length) {
            allErrors.push(...response.data.errors);
          }
        }

        setProgress(Math.round(((i + 1) / totalBatches) * 100));
      }

      setResults({ imported: totalImported, updated: totalUpdated, errors: allErrors });

      if (allErrors.length === 0) {
        toast.success(`Importação concluída! ${totalImported} novos, ${totalUpdated} atualizados.`);
      } else {
        toast.warning(`Importação parcial: ${totalImported} novos, ${totalUpdated} atualizados, ${allErrors.length} erros.`);
      }
    } catch (err: any) {
      toast.error("Erro na importação: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Importar Anamneses</h1>
        <p className="text-sm text-muted-foreground">Importe os dados do Google Forms (CSV) para a plataforma</p>
      </div>

      <Tabs defaultValue="csv" className="w-full">
        <TabsList className="bg-secondary">
          <TabsTrigger value="csv" className="gap-2"><FileSpreadsheet size={14} /> CSV do Google Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="csv">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm">Importação via CSV da Anamnese</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload area */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-foreground mb-1">Arraste o CSV exportado do Google Forms</p>
                <p className="text-xs text-muted-foreground mb-4">
                  O arquivo deve ser o export do formulário "Anamnese Clube Shape Insano"
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="max-w-xs mx-auto bg-background border-border"
                />
              </div>

              {/* Preview */}
              {preview && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-sm font-medium text-foreground mb-2">
                      📋 {preview.total} registros encontrados
                    </p>
                    <div className="space-y-1">
                      {preview.sample.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground min-w-[140px] truncate">{s.nome}</span>
                          <span className="truncate">{s.email}</span>
                          <span className="text-primary truncate">{s.objetivo}</span>
                        </div>
                      ))}
                      {preview.total > 5 && (
                        <p className="text-xs text-muted-foreground mt-1">... e mais {preview.total - 5} registros</p>
                      )}
                    </div>
                  </div>

                  {/* Import button */}
                  <Button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="w-full crimson-gradient text-foreground"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Importando... {progress}%
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet size={16} className="mr-2" />
                        Importar {preview.total} Anamneses
                      </>
                    )}
                  </Button>

                  {/* Progress */}
                  {isImporting && <Progress value={progress} className="h-2" />}
                </div>
              )}

              {/* Results */}
              {results && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <CheckCircle2 size={16} className="text-primary" />
                    <span className="text-sm text-foreground">
                      {results.imported} novos importados, {results.updated} atualizados
                    </span>
                  </div>
                  {results.errors.length > 0 && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-destructive" />
                        <span className="text-sm font-medium text-foreground">{results.errors.length} erros</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto">
                        {results.errors.map((err, i) => (
                          <p key={i} className="text-xs text-muted-foreground">{err}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info */}
              <div className="p-3 rounded-lg bg-secondary/20 border border-border">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Mapeamento automático:</strong> O sistema mapeia as {Object.keys({}).length || 82} colunas do formulário 
                  para os campos corretos de perfil e anamnese. Fotos (URLs do Google Drive) são preservadas nos dados extras.
                  Se o aluno já existe (por email), os dados são atualizados.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminImportarAlunos;
