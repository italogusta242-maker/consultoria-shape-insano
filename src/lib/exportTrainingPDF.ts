import { jsPDF } from "jspdf";
import type { TrainingGroup } from "@/types/training";

interface ExportOptions {
  studentName: string;
  planTitle: string;
  groups: TrainingGroup[];
  updatedAt?: string;
  validUntil?: string;
  objetivoMesociclo?: string;
  pontosMelhoria?: string;
}

export function exportTrainingPDF(options: ExportOptions) {
  const { studentName, planTitle, groups, updatedAt, validUntil, objetivoMesociclo, pontosMelhoria } = options;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const checkPageBreak = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(planTitle, margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Aluno: ${studentName}`, margin, y);
  y += 5;

  if (updatedAt) {
    doc.text(`Atualizado: ${new Date(updatedAt).toLocaleDateString("pt-BR")}`, margin, y);
    y += 5;
  }
  if (validUntil) {
    doc.text(`Válido até: ${new Date(validUntil).toLocaleDateString("pt-BR")}`, margin, y);
    y += 5;
  }

  doc.setTextColor(0);

  const renderWrappedItalic = (label: string, content: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    const lines = doc.splitTextToSize(`${label}: ${content}`, contentWidth) as string[];
    for (const line of lines) {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
  };

  if (objetivoMesociclo) {
    y += 3;
    renderWrappedItalic("Objetivo", objetivoMesociclo);
  }

  if (pontosMelhoria) {
    renderWrappedItalic("Observações", pontosMelhoria);
  }

  // Separator
  y += 3;
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Groups
  for (const group of groups) {
    const exercises = group.exercises ?? [];
    const groupHeight = 10 + exercises.length * 7;
    checkPageBreak(groupHeight);

    // Group title
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(group.name || "Grupo", margin, y);
    y += 7;

    // Table header
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    doc.text("#", margin, y);
    doc.text("Exercício", margin + 8, y);
    doc.text("Séries", margin + contentWidth * 0.55, y);
    doc.text("Reps", margin + contentWidth * 0.68, y);
    doc.text("Descanso", margin + contentWidth * 0.80, y);
    y += 1;
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // Exercises
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    doc.setFontSize(9);

    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const maxNameWidth = contentWidth * 0.45;
      const nameLines = doc.splitTextToSize(ex.name, maxNameWidth) as string[];
      const notesLines = ex.notes
        ? (doc.splitTextToSize(`↳ ${ex.notes}`, contentWidth - 8) as string[])
        : [];
      const rowHeight = Math.max(6, nameLines.length * 4.5) + (notesLines.length ? notesLines.length * 3.5 + 1 : 0);

      checkPageBreak(rowHeight + 2);

      // Alternate row bg
      if (i % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y - 3.5, contentWidth, rowHeight, "F");
      }

      doc.text(String(i + 1), margin + 1, y);

      // Render multi-line exercise name
      for (let li = 0; li < nameLines.length; li++) {
        doc.text(nameLines[li], margin + 8, y + li * 4.5);
      }

      doc.text(String(ex.sets), margin + contentWidth * 0.57, y);
      doc.text(String(ex.reps), margin + contentWidth * 0.70, y);
      doc.text(ex.rest || "—", margin + contentWidth * 0.82, y);

      let nextY = y + Math.max(6, nameLines.length * 4.5);

      if (notesLines.length) {
        doc.setFontSize(7);
        doc.setTextColor(120);
        for (const line of notesLines) {
          doc.text(line, margin + 8, nextY);
          nextY += 3.5;
        }
        doc.setFontSize(9);
        doc.setTextColor(40);
        nextY += 1;
      }

      y = nextY;
    }

    y += 6;
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} — Shape Insano`, margin, doc.internal.pageSize.getHeight() - 10);

  // Download
  const fileName = `treino-${studentName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  doc.save(fileName);
}
