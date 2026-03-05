import { describe, it, expect } from "vitest";
import { parseAnamneseCSV } from "../src/lib/csvAnamneseParser";

describe("csvAnamneseParser", () => {
    it("should parse a valid CSV line correctly into nested objects", () => {
        // Generate a mock CSV line matching the 81 expected columns
        const columns = Array(82).fill("");

        // Fill specific columns based on COLUMN_MAP
        columns[1] = "João Silva"; // nome (profile)
        columns[2] = "joao@example.com"; // email (profile)
        columns[10] = "180"; // altura (profile)
        columns[12] = "80"; // peso (profile)

        columns[17] = "https://drive.google.com/frente.jpg"; // foto_frente_url (extras)
        columns[22] = "Ganhar Massa Muscular"; // objetivo (anamnese)
        columns[23] = "Outro objetivo específico"; // objetivo_outro (extras)

        columns[46] = "Asma"; // doenca_outra (extras)
        columns[47] = "Sim"; // historico_familiar (extras)
        columns[48] = "Diabetes na família"; // historico_familiar_desc (extras)

        const csvContent = "header_mock\n" + '"' + columns.join('","') + '"';

        const result = parseAnamneseCSV(csvContent);

        expect(result).toHaveLength(1);
        const parsed = result[0];

        // Profile checks
        expect(parsed.profile.nome).toBe("João Silva");
        expect(parsed.profile.email).toBe("joao@example.com");
        expect(parsed.profile.altura).toBe("180");
        expect(parsed.profile.peso).toBe("80");

        // Anamnese checks
        expect(parsed.anamnese.objetivo).toBe("Ganhar Massa Muscular");

        // Extras checks
        expect(parsed.dados_extras.foto_frente_url).toBe("https://drive.google.com/frente.jpg");
        expect(parsed.dados_extras.objetivo_outro).toBe("Outro objetivo específico");
        expect(parsed.dados_extras.doenca_outra).toBe("Asma");
        expect(parsed.dados_extras.historico_familiar).toBe("Sim");
        expect(parsed.dados_extras.historico_familiar_desc).toBe("Diabetes na família");
    });

    it("should handle empty or malformed lines gracefully", () => {
        const csvContent = "header_mock\n\n,,,,\n";
        const result = parseAnamneseCSV(csvContent);
        expect(result).toHaveLength(0); // Empty lines skipped
    });
});
