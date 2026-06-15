import * as FormDataImport from 'form-data';

type FormDataInstance = import('form-data');

function resolveFormDataConstructor(): new () => FormDataInstance {
  const mod = FormDataImport as typeof FormDataImport & {
    default?: new () => FormDataInstance;
  };

  if (typeof mod.default === 'function') {
    return mod.default;
  }

  return mod as unknown as new () => FormDataInstance;
}

export function createFormData(): FormDataInstance {
  const FormDataCtor = resolveFormDataConstructor();
  return new FormDataCtor();
}
