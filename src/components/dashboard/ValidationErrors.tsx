import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { ValidationError } from "@/hooks/useMenuValidation";

interface ValidationErrorsProps {
  errors: ValidationError[];
}

export function ValidationErrors({ errors }: ValidationErrorsProps) {
  if (errors.length === 0) return null;

  const errorCount = errors.filter(e => e.type === 'error').length;
  const warningCount = errors.filter(e => e.type === 'warning').length;

  return (
    <div className="space-y-4">
      {errorCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Menu Validation Errors ({errorCount})</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {errors
                .filter(e => e.type === 'error')
                .map((error, index) => (
                  <div key={index} className="text-sm">
                    <strong>{error.message}</strong>
                    <p className="text-muted-foreground mt-1">{error.details}</p>
                    <p className="text-xs text-muted-foreground mt-1">Field: {error.field}</p>
                  </div>
                ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {warningCount > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Menu Validation Warnings ({warningCount})</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {errors
                .filter(e => e.type === 'warning')
                .map((error, index) => (
                  <div key={index} className="text-sm">
                    <strong>{error.message}</strong>
                    <p className="text-muted-foreground mt-1">{error.details}</p>
                    <p className="text-xs text-muted-foreground mt-1">Field: {error.field}</p>
                  </div>
                ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
