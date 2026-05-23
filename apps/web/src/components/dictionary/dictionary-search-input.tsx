import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@handeck/ui/components/input-group";
import { cn } from "@handeck/ui/lib/utils";
import { Search, X } from "lucide-react";

type DictionarySearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
};

export function DictionarySearchInput({
  value,
  onChange,
  onClear,
  className,
  inputClassName,
  autoFocus,
}: DictionarySearchInputProps) {
  const showClear = value.trim().length > 0;

  return (
    <InputGroup className={cn("h-9 w-full sm:h-10 md:h-11", className)}>
      <InputGroupAddon align="inline-start" className="py-0 sm:py-0.5 md:py-1">
        <Search
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground sm:size-4.5 md:size-5"
        />
      </InputGroupAddon>
      <InputGroupInput
        aria-label="Search the dictionary"
        autoFocus={autoFocus}
        className={cn(
          "h-9 px-3 text-sm placeholder:text-sm sm:h-10 sm:px-3.5 sm:text-base sm:placeholder:text-base md:h-11 md:px-4 md:text-lg",
          inputClassName,
        )}
        placeholder="Search the dictionary..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {showClear ? (
        <InputGroupAddon align="inline-end" className="py-0 sm:py-0.5 md:py-1">
          <InputGroupButton
            aria-label="Clear search"
            size="icon-xs"
            type="button"
            onClick={onClear}
          >
            <X className="size-4 text-muted-foreground" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
