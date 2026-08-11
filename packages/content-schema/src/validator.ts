import Ajv, { type ValidateFunction } from "ajv";
import { loadSchema } from "./schemas.js";

const ajv = new Ajv({ allErrors: true });
const validators = new Map<string, ValidateFunction>();

function getValidator(schemaName: string): ValidateFunction {
  let validate = validators.get(schemaName);
  if (!validate) {
    validate = ajv.compile(loadSchema(schemaName));
    validators.set(schemaName, validate);
  }
  return validate;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEntity(data: unknown, schemaName = "entity"): ValidationResult {
  const validate = getValidator(schemaName);
  const valid = validate(data);
  return {
    valid,
    errors: valid
      ? []
      : (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`),
  };
}
