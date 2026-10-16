# Gates — P2 · Game engine & database

- [x] G1: Pure engine rules pass their unit tests (spin loop, eliminations, podium, transitions, admin-set chair counts)
  CHECK: npx vitest run src/lib/engine.test.ts && echo GATE_GREEN
  EXPECT: GATE_GREEN
  EVIDENCE: automatic-evidence=v1; definition-sha256=d0743aa22d0f8c8e8e67c325cd42ba3eb73b943539b06d0b8052182a0972f840; exit=0; EXPECT=matched; output-sha256=a26a2baadc6aaadbe96303a1307fcf0fd76a9ee1f5d7ecbe131b990fb8f07281; output-bytes=615; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G2: Every local migration is applied to the aimc-test cloud project
  CHECK: supabase migration list --linked
  EXPECT: 0005
  EVIDENCE: automatic-evidence=v1; definition-sha256=16a586b3856578fcea2760f186aefdabf2a732a22dc7049a7aecf89305189293; exit=0; EXPECT=matched; output-sha256=5f0d079fa71421e6b6719dfb08cda7d4a9a4127b3ac2697d6a4ebd374bcd1d2e; output-bytes=570; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G3: Security integration tests (RLS, grants, RPC guards, answer secrecy) pass against aimc-test
  CHECK: npm run test:integration -- security && echo GATE_GREEN
  EXPECT: GATE_GREEN
  EVIDENCE: automatic-evidence=v1; definition-sha256=a48710f395fadf14a410dd94ba8dde5153f33b9b2f29e919be053404d65bf352; exit=0; EXPECT=matched; output-sha256=2e6afa1a0af8efef0f46a78fb222082f09ab87510b48452dfdb6c01acd04d7df; output-bytes=681; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G4: Full-game integration test (claims, grading, spin loop, eliminations, podium) passes against aimc-test
  CHECK: npm run test:integration -- game && echo GATE_GREEN
  EXPECT: GATE_GREEN
  EVIDENCE: automatic-evidence=v1; definition-sha256=324b476edc36ea23498d69fc2fa57b1d16a080f95b9d779bc9f55711798fdd6e; exit=0; EXPECT=matched; output-sha256=6574da0734aa34111995cb725b666a4faad6be64fe2ab1af13c6d11a0dea33f5; output-bytes=675; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G5: Seed question bank has at least 150 valid questions covering difficulty 1-5
  CHECK: npx vitest run src/lib/questions/seed.test.ts && echo GATE_GREEN
  EXPECT: GATE_GREEN
  EVIDENCE: automatic-evidence=v1; definition-sha256=4246aba7d2f959bc90cb7f44a978afff7899eb9680da6e50db5054251d58c0ff; exit=0; EXPECT=matched; output-sha256=82537ea3374635791db88d419d83c19fa30e0498c032199586c03b866133c783; output-bytes=602; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries

- [x] G6: Types, lint and build stay green
  CHECK: npm run typecheck && npm run lint && npm run build
  EXPECT: Compiled successfully
  EVIDENCE: automatic-evidence=v1; definition-sha256=65448b972e3c0c98e17062549d87ec01d2808833318488ddbbfe0cd52b1627b8; exit=0; EXPECT=matched; output-sha256=0ab213f387b7aefcb6b892ae3c23bdcfda28252f0b226850bbe75a53d2d83b21; output-bytes=1090; shell=/bin/sh; cwd=/Users/vikhyathmgowda007/Developer/ai musical chair; path=41f1bee6fce0/30 entries
