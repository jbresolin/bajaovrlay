# apps/control/src/features/dataSources/flexSource

The form of the flex HTTP/JSON source ("HTTP/JSON (flexível)" on "+ Fonte" and "Editar"),
with its "Testar" panel and "Importar / Exportar configuração". Start at `FlexSourceForm.tsx`.

- What the form holds and how it is filled: `flexSourceFormValues.ts`; turned into a config
  by `flexConfigFromFormValues.ts` and checked with the shared HttpJsonConfigSchema by
  `flexSourceFormReading.ts`, which puts each refusal under its field. A typed "Valor fixo"
  or value table cell is read as JSON or text by `typedValueText.ts`.
- The parts: `FlexRequestsSection.tsx` (requests, `NameAndValueRows.tsx` for headers and
  query parameters), `FlexMappingsSection.tsx` → `FlexMappingBlock.tsx` → `FlexFieldRuleRow.tsx`
  (`ValueTableEditor.tsx` for mapValues), `FlexConfigImportExport.tsx`
  (`flexConfigImportAndExport.ts`).
- "Testar": `FlexTestPanel.tsx`, `FlexSampleBox.tsx` (`fetchHttpJsonSample.ts`, the sample
  route), `flexSampleTesting.ts` (the shared applyFlexMapping + validateDataShape, in the
  browser) and `FlexTestResult.tsx` (the source detail's own tables). Nothing there is saved.
