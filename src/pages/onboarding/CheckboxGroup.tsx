import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CheckboxGroupProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (val: string[]) => void;
  columns?: number;
  required?: boolean;
}

const CheckboxGroup = ({ label, options, value, onChange, columns = 2, required }: CheckboxGroupProps) => {
  const toggle = (opt: string) => {
    onChange(
      value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt]
    );
  };

  return (
    <div>
      <Label className="text-muted-foreground text-xs mb-2 block">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 p-2 rounded-md bg-card border border-border cursor-pointer hover:border-primary/30 transition-colors text-sm"
          >
            <Checkbox checked={value.includes(opt)} onCheckedChange={() => toggle(opt)} />
            <span className="text-foreground text-xs leading-tight">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default CheckboxGroup;
