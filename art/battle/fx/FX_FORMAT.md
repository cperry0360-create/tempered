# Tempered combat FX

The approved combat effects are stored as base64-encoded PNG payloads (`*.png.b64`). The browser runtime converts each payload to an in-memory PNG data URL once and reuses it for every effect. This preserves the exact cleaned pixel art while keeping the repository's text-only upload path deterministic.

Effects:
- sword slash
- impact spark
- guard shield
- magic burst
- critical hit flash
- dust impact
