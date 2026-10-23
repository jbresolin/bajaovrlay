/**
 * Test support shared by the manifest tests: the JSON Schema validator for the OGraf v1
 * schemas vendored in ograf-schema/, built the same way for the manifest itself
 * (noticeManifest.test.ts) and for its data schema (noticeManifestDataAgreement.test.ts).
 */
import { Ajv2020 } from 'ajv/dist/2020.js';

import gddBasicTypesSchema from '../ograf-schema/gdd/basic-types.json';
import gddTypesSchema from '../ograf-schema/gdd/gdd-types.json';
import gddObjectSchema from '../ograf-schema/gdd/object.json';
import ografActionSchema from '../ograf-schema/lib/action.json';
import ografBooleanConstraintSchema from '../ograf-schema/lib/constraints/boolean.json';
import ografNumberConstraintSchema from '../ograf-schema/lib/constraints/number.json';

/**
 * Builds a JSON Schema validator for the 2020-12 draft the OGraf schemas declare, with
 * every OGraf schema registered under its published $id so no $ref goes to the network.
 */
export function createOGrafSchemaValidator() {
  // These are OGraf annotations, not 2020-12 keywords: `example` (lib/action.json) and
  // the GDD form hints a data schema may carry (gdd/object.json). Strict mode refuses
  // unknown keywords, so it is told they are annotations that validate nothing.
  // `v_baja` is BajaOvrLay's own vendor field on a data property. The official manifest
  // schema allows any `v_` field there by pattern, but when the data schema is compiled
  // on its own (noticeManifestDataAgreement.test.ts) strict mode knows no such pattern and would
  // stop with `strict mode: unknown keyword: "v_baja"`.
  const validator = new Ajv2020({ allErrors: true });
  const annotationsThatValidateNothing = [
    'example',
    'gddType',
    'gddOptions',
    'hidden',
    'order',
    'v_baja',
  ];
  for (const annotation of annotationsThatValidateNothing) {
    validator.addKeyword(annotation);
  }
  validator.addSchema([
    gddBasicTypesSchema,
    gddTypesSchema,
    gddObjectSchema,
    ografActionSchema,
    ografBooleanConstraintSchema,
    ografNumberConstraintSchema,
  ]);
  return validator;
}
