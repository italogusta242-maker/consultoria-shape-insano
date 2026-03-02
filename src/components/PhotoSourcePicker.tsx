import { useRef, useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PhotoSourcePickerProps {
  accept?: string;
  onFile: (file: File) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

/**
 * Wraps a trigger element and shows a popover with "Galeria" and "Câmera" options.
 * On mobile, the camera option opens the device camera directly.
 */
export default function PhotoSourcePicker({ accept = "image/*", onFile, children, disabled }: PhotoSourcePickerProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
    setOpen(false);
  };

  return (
    <>
      <input ref={galleryRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          {children}
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" side="top" align="center">
          <button
            type="button"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-foreground hover:bg-secondary transition-colors"
            onClick={() => { galleryRef.current?.click(); }}
          >
            <ImageIcon size={16} className="text-muted-foreground" />
            Galeria
          </button>
          <button
            type="button"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-foreground hover:bg-secondary transition-colors"
            onClick={() => { cameraRef.current?.click(); }}
          >
            <Camera size={16} className="text-muted-foreground" />
            Câmera
          </button>
        </PopoverContent>
      </Popover>
    </>
  );
}
