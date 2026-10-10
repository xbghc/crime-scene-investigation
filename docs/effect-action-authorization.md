# Effect action authorization

The server authorizes a witness action against the card drawn in the current advance, not a client-selected card. Only E01, E03, E05 and E08 create a pending action. A successful action consumes that authorization; rejected requests preserve it. Finishing the advance, ending the game, resetting, or entering a new advance clears it. Reconnecting does not replenish a consumed action.

- E01 requires a living non-witness target.
- E03 requires a non-witness player who is not the murderer.
- E05 requires an active board with a marker.
- E08 requires one of the two cards in the current solution.
- E02, E07 and E09 execute automatically and cannot be invoked through `effect_action`.
- E04, E06 and E10 remain pre-existing unimplemented interactions. They grant no `effect_action` authorization. An empty effect deck also grants none.

## Scope and compatibility

This is a server authorization fix, not completion of the effect-card feature. The client does not currently expose controls for the four interactive actions. Existing advance completion remains unchanged: an unused action does not block board replacement or Continue, and expires when the advance ends. Making effects mandatory would require a separate, complete UI and reconnect-state implementation and would otherwise deadlock existing clients.

Tests cover legitimate interactive actions through authenticated Socket.IO connections, forged card IDs, replay, invalid retry, role ownership, and authorization lifecycle. Existing browser scenarios exercise the automatic E07 effect and ordinary progression; they do not claim interactive-effect UI coverage.
