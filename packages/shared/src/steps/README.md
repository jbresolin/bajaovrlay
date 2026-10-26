# packages/shared/src/steps

Stepping a graphic on air (concept §2, "Next"; built by BAJAOVRLAY-47 for the podium):
`nextOnLayer.ts` is the command ("Próximo" on a Camadas row) and `graphicSteps.ts` the rule
the server and the control page share: a manifest's `stepCount` (anything but a whole number
of 1 or more reads as 1), an instance's (`readStepCountOfInstance`: with `stepCount: -1` and a
`v_baja.stepCounter`, counted from its data by `stepCounters.ts`, BAJAOVRLAY-25), and the step
an instance goes to next, none on its last step. `bracketSteps.ts` plans and counts a bracket's
steps from its rounds; zod-free, it is also the bracket graphic's (`@bajaovrlay/shared/bracketSteps`).
The server keeps every instance's step within its count (`instanceStepsWithinTheirCount.ts`).
The server's reducer is apps/server/src/core/store/reducers/nextOnLayer.ts; the renderer
plays the step when `currentStep` changes (apps/renderer/src/instanceReconciler.ts).
