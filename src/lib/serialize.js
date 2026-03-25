export function generateDeclarationJSON(schemasData, declarations) {
  return declarations.map(d => {
    const schema = schemasData.declarations[d.declarationId]
    const declarationType = schema?.payload?.declarationtype || d.declarationId
    return {
      Type: declarationType,
      Identifier: d.identifier || crypto.randomUUID(),
      ServerToken: d.serverToken || crypto.randomUUID(),
      Payload: { ...d.values },
    }
  })
}
