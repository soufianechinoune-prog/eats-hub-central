import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

const countries: Country[] = [
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "BE", name: "Belgique", dialCode: "+32", flag: "🇧🇪" },
  { code: "CH", name: "Suisse", dialCode: "+41", flag: "🇨🇭" },
  { code: "LU", name: "Luxembourg", dialCode: "+352", flag: "🇱🇺" },
  { code: "MC", name: "Monaco", dialCode: "+377", flag: "🇲🇨" },
  { code: "DE", name: "Allemagne", dialCode: "+49", flag: "🇩🇪" },
  { code: "IT", name: "Italie", dialCode: "+39", flag: "🇮🇹" },
  { code: "ES", name: "Espagne", dialCode: "+34", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹" },
  { code: "GB", name: "Royaume-Uni", dialCode: "+44", flag: "🇬🇧" },
  { code: "NL", name: "Pays-Bas", dialCode: "+31", flag: "🇳🇱" },
  { code: "MA", name: "Maroc", dialCode: "+212", flag: "🇲🇦" },
  { code: "DZ", name: "Algérie", dialCode: "+213", flag: "🇩🇿" },
  { code: "TN", name: "Tunisie", dialCode: "+216", flag: "🇹🇳" },
  { code: "US", name: "États-Unis", dialCode: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "6 12 34 56 78",
  className,
  id,
}: PhoneInputProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedCountry, setSelectedCountry] = React.useState<Country>(
    countries[0]
  );
  const [phoneNumber, setPhoneNumber] = React.useState("");

  // Parse initial value to extract country code and number
  React.useEffect(() => {
    if (value) {
      const country = countries.find((c) => value.startsWith(c.dialCode));
      if (country) {
        setSelectedCountry(country);
        setPhoneNumber(value.replace(country.dialCode, "").trim());
      } else {
        setPhoneNumber(value);
      }
    }
  }, []);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setOpen(false);
    const fullNumber = phoneNumber ? `${country.dialCode} ${phoneNumber}` : "";
    onChange(fullNumber);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPhone = e.target.value;
    setPhoneNumber(newPhone);
    const fullNumber = newPhone
      ? `${selectedCountry.dialCode} ${newPhone}`
      : "";
    onChange(fullNumber);
  };

  return (
    <div className={cn("flex gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[90px] justify-between px-2 font-normal"
          >
            <span className="text-lg">{selectedCountry.flag}</span>
            <span className="text-xs text-muted-foreground">
              {selectedCountry.dialCode}
            </span>
            <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <ScrollArea className="h-[280px]">
            <div className="p-1">
              {countries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => handleCountrySelect(country)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer",
                    selectedCountry.code === country.code && "bg-accent"
                  )}
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="flex-1 text-left">{country.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {country.dialCode}
                  </span>
                  {selectedCountry.code === country.code && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        type="tel"
        value={phoneNumber}
        onChange={handlePhoneChange}
        placeholder={placeholder}
        className="flex-1"
      />
    </div>
  );
}
