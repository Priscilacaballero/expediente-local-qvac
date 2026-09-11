export type DocumentType = "identity" | "income" | "address" | "form" | "other";

export function classifyDocument(filename: string, text: string): DocumentType {
  const value = `${filename} ${text}`.toLocaleLowerCase("es");
  if (/identidad|identity|documento|pasaporte|c[eé]dula/iu.test(value)) return "identity";
  if (/ingreso|income|salario|salary|emplead/iu.test(value)) return "income";
  if (/direcci[oó]n|address|domicilio/iu.test(value)) return "address";
  if (/formulario|form|solicitud/iu.test(value)) return "form";
  return "other";
}
