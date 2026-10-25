# packages/shared/src/steps

Stepping a graphic on air (concept §2, "Next"; built by BAJAOVRLAY-47 for the podium):
`nextOnLayer.ts` is the command ("Próximo" on a Camadas row) and `graphicSteps.ts` the rule
the server and the control page share: a manifest's `stepCount` (anything but a whole number
of 1 or more reads as 1), and the step an instance goes to next, none on its last step.
The server's reducer is apps/server/src/core/store/reducers/nextOnLayer.ts; the renderer
plays the step when `currentStep` changes (apps/renderer/src/instanceReconciler.ts).
