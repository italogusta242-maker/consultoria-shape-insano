import { useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import PhotoSourcePicker from "@/components/PhotoSourcePicker";

interface FileUploadFieldProps {
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  accept?: string;
}

const FileUploadField = ({ label, value, onChange, required, accept }: FileUploadFieldProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const isImageAccept = !accept || !accept.includes("pdf");

  const handleFile = (file: File) => {
    onChange(file);
    setFileName(file.name);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const clear = () => {
    onChange(null);
    setPreview(null);
    setFileName(null);
  };

  const hasFile = value !== null;

  if (hasFile) {
    return (
      <div>
        <Label className="text-muted-foreground text-xs">
          {label} {required && <span className="text-primary">*</span>}
        </Label>
        {preview ? (
          <div className="relative mt-1 rounded-lg overflow-hidden border border-border bg-card">
            <img src={preview} alt={label} className="w-full h-32 object-cover" />
            <button onClick={clear} className="absolute top-1 right-1 bg-background/80 rounded-full p-1">
              <X size={14} className="text-foreground" />
            </button>
          </div>
        ) : (
          <div className="relative mt-1 rounded-lg border border-border bg-card p-3 flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            <span className="text-xs text-foreground truncate flex-1">{fileName}</span>
            <button onClick={clear} className="bg-background/80 rounded-full p-1">
              <X size={14} className="text-foreground" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // For non-image accept types (like PDF), use a regular file input
  if (!isImageAccept) {
    return (
      <div>
        <Label className="text-muted-foreground text-xs">
          {label} {required && <span className="text-primary">*</span>}
        </Label>
        <label className="mt-1 w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 bg-card hover:border-primary/40 transition-colors cursor-pointer">
          <Upload size={20} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Selecionar arquivo</span>
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-muted-foreground text-xs">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      <PhotoSourcePicker onFile={handleFile}>
        <button
          type="button"
          className="mt-1 w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 bg-card hover:border-primary/40 transition-colors"
        >
          <Upload size={20} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Selecionar foto</span>
        </button>
      </PhotoSourcePicker>
    </div>
  );
};

export default FileUploadField;
