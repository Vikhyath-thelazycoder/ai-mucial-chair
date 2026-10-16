# Gates — P3 · Player site

- [x] G1: Player logic unit tests pass (validation, QR parsing, error messages, view state machine, countdown, focus guard)
  CHECK: npx vitest run src/lib/player src/lib/qr.test.ts src/lib/errors.test.ts src/hooks && echo GATE_GREEN
  EXPECT: GATE_GREEN
  EVIDENCE: automatic-evidence=v1; definition-sha256=ca4f0ed70d95bbdef2294c9155f064f94d391320089ae0cfbd184d38b6eb273c; exit=0; EXPECT=matched; output-sha256=590e80541b67a330370bade18ab8c9a886be7968a8df983620748afaf45238a8; output-bytes=615; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G2: Real sign-up / login / re-join flow works against the test project (synthetic USN email, PIN, my_status)
  CHECK: npm run test:integration -- player-auth && echo GATE_GREEN
  EXPECT: GATE_GREEN
  EVIDENCE: automatic-evidence=v1; definition-sha256=3f1ee8927cc3be6b809abe34075b78136072a98de596001078555b729c54928a; exit=0; EXPECT=matched; output-sha256=0b8b1fb28778ea42f1b0586cf40a0eeb990716316113ae96fd13d3ff8ed427be; output-bytes=691; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G3: All earlier integration suites stay green (security, game, sessions)
  CHECK: npm run test:integration && echo GATE_GREEN
  EXPECT: GATE_GREEN
  EVIDENCE: automatic-evidence=v1; definition-sha256=e922d15186c2202b8c92ad0f73ae709d3729e9267920a9b99c64034401d56af3; exit=0; EXPECT=matched; output-sha256=14ad808e16aa08d88591d4687ba7e7c622b947103e8c0e09a0b0e1aed1a04ca2; output-bytes=672; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G4: The chair landing page has no side effects and never echoes the QR secret
  CHECK: npx vitest run src/app/c && echo GATE_GREEN
  EXPECT: GATE_GREEN
  EVIDENCE: automatic-evidence=v1; definition-sha256=e9f05b6f67c291f05bf630b46b23995bf7f385fd390e877f6fac84b44451a067; exit=0; EXPECT=matched; output-sha256=1bf36ecee972efaf42091dddae3b7ce012e7ac7464a164d9c6869738f28f478d; output-bytes=615; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G5: Scanner and question screens don't pull three.js into the /play bundle
  CHECK: node scripts/check-player-bundle.mjs && echo GATE_GREEN
  EXPECT: GATE_GREEN
  EVIDENCE: automatic-evidence=v1; definition-sha256=d1bd2a2dadd71de9fbc0eabb7b5d6cfc86dc27793b6417ba5560b33f89d631ee; exit=0; EXPECT=matched; output-sha256=ddb31d08d9edef7c05baca9b687138ec53c77e2f6422d2f3ca5dd6dada5d4a97; output-bytes=71; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G6: Types, lint and build stay green
  CHECK: npm run typecheck && npm run lint && npm run build
  EXPECT: Compiled successfully
  EVIDENCE: automatic-evidence=v1; definition-sha256=65448b972e3c0c98e17062549d87ec01d2808833318488ddbbfe0cd52b1627b8; exit=0; EXPECT=matched; output-sha256=95059d9c02b811b16896f020f68a92f5fc737192d298032efd65fd92fb9604b4; output-bytes=1224; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries
