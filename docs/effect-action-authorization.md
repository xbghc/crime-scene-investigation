# Effect action authorization

The server authorizes a witness action against the card drawn in the current advance, not a client-selected card. Only E01, E03, E05 and E08 create a pending action. A successful action consumes that authorization; rejected requests preserve it. Finishing the advance, ending the game, resetting, or entering a new advance clears it. Reconnecting does not replenish a consumed action.

- E01 requires a living non-witness target.
- E03 requires a non-witness player who is not the murderer.
- E05 requires an active board with a marker.
- E08 requires one of the two cards in the current solution.
- E02, E07 and E09 execute automatically and cannot be invoked through `effect_action`.
- E04, E06 and E10 remain pre-existing unimplemented interactions. They grant no `effect_action` authorization. An empty effect deck also grants none.

## Scope and compatibility

PR #4 originally introduced only server authorization. The subsequent interactive-effect iteration adds client controls and reconnect-safe state for E01/E03/E05/E08. E01/E03/E05 now block replacement and completion until executed; the server automatically resolves a mandatory card with an explanation if no legal targets exist. E08 requires either a valid selected answer card or explicit `{ skip: true }` before completing the advance. Invalid and repeated requests retain the authorization protections above.

Witness-only `pendingEffect` is restored from snapshots and never sent to other players. Public `effectCard` / `effectResult` survives refresh, including E08's intentionally revealed card name. Closing the announcement or cancelling a selection does not consume an action. See [interactive effect controls and verification](interactive-effect-cards.md).

Authenticated Socket.IO tests cover forged card IDs, replay, invalid retry, role ownership and authorization lifecycle. Browser suites now include six interactive-effect scenarios in addition to the existing automatic E07 and ordinary progression coverage. E04/E06/E10 remain outside the completed gameplay scope.
