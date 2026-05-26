import { Card } from "@handeck/ui/components/card";

export default function TemplateEmptyPanel() {
  return (
    <Card className="flex h-28 min-h-0 flex-col overflow-hidden sm:h-32 lg:h-full" aria-hidden />
  );
}
