# READY6 recovery QA · product remains original47

Product manifest: outputs/flight3d-v1/delivery-manifest.json
SHA 1d247460e9573c16a1473402b633cd1b64877c991a133e70669f3677da9c86aa
All47 owned +4 readonly are restored and verified exact. No product revision.
Prior changed metadata preserved at outputs/flight3d-ready6-browser-qa-v1/frozen-metadata/ with original relative paths; original harness remains unchanged in tools/flight3d/.
The abandoned ad5bf2…/48 recovery registration is superseded by this external QA-only package.

Failure evidence: original raw12 has11PASS/bank1FAIL, E-release timeout; original18 not completed.
New7 only: bank,E,grab,J,mobile,reset,errors. Original11 not repeated.

Bank proof: app input x=D-A; helm.turn=-x, so D->yawRate<0. sim roll target includes -yawRate*forwardSpeed*.042-lateralAcceleration*.018-yawAcceleration*.10. In steady forward D, positive roll is expected. Check |roll|>.30rad, <=.46 and roll*yawRate<0; collision0.

E observation: reset, fixed1.2sim-second E press (same duration as CPU before/after sequence), then4sim-second release. rAF reads actual heave, velocity, Y, time without mutating state. Record full trajectory/starting phase, upward suspension load on descending acceleration, opposite-sign negative release peak at least25% of loaded peak, final1second envelope below85% of larger peak, and continuing actual downward Y after release. Relative reversal/decay replaces arbitrary absolute -.25. The fixed energy press avoids stopping the input at different idle phases. Idle buoyancy remains, so settle means decaying envelope rather than zero heave. This is an observation definition, not user-approved tuning.
Read-only CPU observer sanity at reset offsets.05/.08/.15/.25: load .644/.651/.664/.676, reverse -.444/-.456/-.479/-.511, final envelope .182/.181/.178/.174. No browser pass claim.

Product sim/app/renderer/flight.js unchanged. Original11 source-bound passes stay in their first report. Browser7 pending START; no repeat of first18 or old15/20/37. Real brake browser untested; Node37 brake checks only. Human art/control approval separate.

superseded-recovery-notes.md is an abandoned early threshold proposal, not this package's current observer specification.
