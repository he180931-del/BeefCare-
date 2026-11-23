# C├íc ─æiß╗âm lß╗çch v├á quyß║┐t ─æß╗ïnh triß╗ân khai

C├íc t├ái liß╗çu nguß╗ôn l├á dß╗» liß╗çu y├¬u cß║ºu cß╗ºa dß╗▒ ├ín. Nhß╗»ng chß╗ë dß║½n nß║▒m trong t├ái liß╗çu kh├┤ng thay thß║┐ y├¬u cß║ºu cß╗ºa chß╗º dß╗▒ ├ín trong cuß╗Öc trao ─æß╗òi.

| M├ú | Bß║▒ng chß╗®ng | Quyß║┐t ─æß╗ïnh | ß║ónh hã░ß╗ƒng |
|---|---|---|---|
| D01 | SRS Table III-6 liß╗çt k├¬ thß╗®c ─ân TA-01 ─æß║┐n TA-09; DB V2 Delta phß║ºn starter data chß╗ë tß║ío 6 thß╗®c ─ân v├á ─æß║Àt bß╗Ö ─æß║┐m bß║▒ng 6. | Theo SRS: tß║ío 9 thß╗®c ─ân, bß╗Ö ─æß║┐m bß║▒ng 9, m├ú tiß║┐p theo TA-10. | Kiß╗âm thß╗¡ ─æ─âng k├¢ trß║íi phß║úi x├íc nhß║¡n ─æß╗º 9 thß╗®c ─ân, tß╗ôn ─æß║ºu bß║▒ng 0. |
| D02 | DB V2 Delta dß╗▒a tr├¬n bß╗Ö V1 ri├¬ng gß╗ôm 75 entity v├á d├╣ng UUID ß╗ƒ c├íc trã░ß╗Øng/quan hß╗ç mß╗øi; codebase nh├ính dev hiß╗çn tß║íi d├╣ng Long/bigint v├á Liquibase. | Giß╗» Long/bigint; chuyß╗ân c├íc thay ─æß╗òi nghiß╗çp vß╗Ñ sang migration tã░ãíng th├¡ch vß╗øi schema hiß╗çn c├│. | Kh├┤ng chß║íy nguy├¬n c├íc ─æoß║ín SQL/JDL cß╗ºa Delta l├¬n DB hiß╗çn tß║íi. ─É├óy l├á kh├íc biß╗çt giß╗»a t├ái liß╗çu DB v├á code, chã░a phß║úi m├óu thuß║½n nghiß╗çp vß╗Ñ trong SRS. |
| D03 | File Word Report3 ─æã░ß╗úc cung cß║Ñp c├│ c├íc ├┤ ÔÇ£[Figure to be inserted]ÔÇØ cho context diagram, BF01ÔÇô09, ERD, 5 sãí ─æß╗ô trß║íng th├íi v├á use case/screen flow. Chß╗ë logo ─æã░ß╗úc li├¬n kß║┐t tß╗½ phß║ºn th├ón t├ái liß╗çu. C├íc ß║únh image2ÔÇôimage10 c├▓n lã░u trong g├│i Word l├á ß║únh TalentHub/tuyß╗ân dß╗Ñng hoß║Àc setting mß║½u, kh├┤ng ─æã░ß╗úc phß║ºn th├ón t├ái liß╗çu tham chiß║┐u. | D├╣ng bß║úng business flow, bß║úng chuyß╗ân trß║íng th├íi, UC v├á GBR tã░ãíng ß╗®ng l├ám nß╗Öi dung luß╗ông; ─æß╗æi chiß║┐u quan hß╗ç vß╗øi file BeefCare_Conceptual_ERD.drawio ri├¬ng. Kh├┤ng d├╣ng ß║únh TalentHub l├ám y├¬u cß║ºu BeefCare. | Bß║ún Word n├áy chã░a ─æß╗º ─æß╗â x├íc nhß║¡n trß╗▒c quan m┼®i t├¬n/nh├ún cß╗ºa sãí ─æß╗ô BeefCare; t├ái liß╗çu b├án giao cß║ºn ghi r├Á hß║ín chß║┐ nguß╗ôn. |
| D04 | SRS UC-FE23-02 Assumptions (SRS d├▓ng 2727): "lots are recorded for expiry warnings only"; GBR-99/102/105 t├¡nh tß╗ôn bß║▒ng tß╗òng stock movement theo kg v├á gi├í vß╗æn b├¼nh qu├ón gia quyß╗ün; SCR-77 chß╗ë c├│ cß╗Öt "Lot near expiry". DB V2 Delta kh├┤ng c├│ FEFO. Handoff 28/10 lß║íi ─æß╗ü xuß║Ñt "ho├án thiß╗çn FEFO thß║¡t". | Theo SRS, chß╗º dß╗▒ ├ín x├íc nhß║¡n ng├áy 28/10/2026: kh├┤ng ph├ón bß╗ò xuß║Ñt kho theo l├┤. L├┤ v├á hß║ín d├╣ng lã░u tr├¬n d├▓ng phiß║┐u nhß║¡p; "Lot near expiry" l├á l├┤ c├│ hß║ín gß║ºn nhß║Ñt trong 30 ng├áy cß╗ºa c├íc phiß║┐u POSTED. Bß║úng `feed_inventory_lot`/`feed_lot_allocation` (migration 00800) giß╗» nguy├¬n, kh├┤ng ─æã░ß╗úc ─æß╗ìc/ghi, kh├┤ng phß║úi nguß╗ôn t├¡nh tß╗ôn. | Kh├┤ng th├¬m logic l├┤ v├áo nhß║¡p/hß╗ºy/─æiß╗üu chß╗ënh/cho ─ân. Nß║┐u sau n├áy SRS ─æß╗òi sang FEFO th├¼ l├ám bß║▒ng changeSet mß╗øi v├á backfill. |
| D05 | UC-FE01-02 E1: "The message does not reveal which value is wrong". M├ú c┼® trß║ú 403 cho t├ái khoß║ún chß╗ë d├╣ng Google nhã░ng 401 cho sai mß║¡t khß║®u. | T├ái khoß║ún chß╗ë d├╣ng Google ─æ─âng nhß║¡p bß║▒ng mß║¡t khß║®u nhß║¡n ─æ├║ng nhã░ sai mß║¡t khß║®u: 401 `MSG-FE01-01`, kh├┤ng ─æß║┐m lß║ºn kh├│a. | Hai test x├íc thß╗▒c ─æß╗òi kß╗│ vß╗ìng sang 401. |
| D06 | UC-FE01-05 AF1: "the email advises signing in with Google; no password is created". M├ú c┼® kh├┤ng gß╗¡i g├¼. | Gß╗¡i email hã░ß╗øng dß║½n ─æ─âng nhß║¡p bß║▒ng Google qua h├áng ─æß╗úi mail bß╗ün vß╗»ng (template `GOOGLE_SIGN_IN_ADVICE`), c├╣ng giß╗øi hß║ín 5 mail/giß╗Ø, kh├┤ng link, kh├┤ng token; job bß╗Å mail nß║┐u t├ái khoß║ún ─æ├ú c├│ mß║¡t khß║®u l├║c gß╗¡i. | C├óu trß║ú lß╗Øi cß╗ºa API vß║½n giß╗æng hß╗çt mß╗ìi ─æß╗ïa chß╗ë. |
| D07 | UC-FE01-06 AF1/AF2 cß║ºn "re-authenticate with Google (sign-in within the last 5 minutes)"; SRS kh├┤ng c├│ m├ú th├┤ng b├ío ri├¬ng cho trã░ß╗Øng hß╗úp chã░a x├íc thß╗▒c lß║íi. | Thß╗Øi ─æiß╗âm ─æ─âng nhß║¡p Google ─æã░ß╗úc lã░u trong session; trong 5 ph├║t, ─æß╗òi mß║¡t khß║®u kh├┤ng cß║ºn mß║¡t khß║®u hiß╗çn tß║íi (chß╗ë khi t├ái khoß║ún c├│ Google subject). Thiß║┐u x├íc thß╗▒c lß║íi: 403 `MSG-COM-01`, `params.reason=google_reauthentication_required`. | FE gß╗ìi `POST /api/account/google-reauthentication` rß╗ôi chuyß╗ân tß╗øi Google. |
| D08 | JOB-05 (24.5) v├á GBR-71 (kh├┤ng tß║ío y├¬u cß║ºu thanh to├ín khi SUSPENDED). | Trß║íi SUSPENDED kh├┤ng nhß║¡n th├┤ng b├ío mß╗ƒ gia hß║ín v├á sß║»p hß║┐t hß║ín, chß╗ë nhß║¡n th├┤ng b├ío ─æ├ú hß║┐t hß║ín. Th├┤ng b├ío "─æ├ú hß║┐t hß║ín" d├╣ng chung event key vß╗øi JOB-04 ─æß╗â chß╗ë c├│ mß╗Öt th├┤ng b├ío trong app, email gß╗¡i mß╗Öt lß║ºn. Lß║ºn chß║íy chß╗ë tß║ío th├┤ng b├ío cß╗ºa ch├¡nh ng├áy ─æ├│ (kh├┤ng b├╣ ng├áy bß╗ï lß╗í, theo "Job fails"). | Nß║┐u chß╗º dß╗▒ ├ín muß╗æn b├ío cß║ú trß║íi SUSPENDED th├¼ bß╗Å mß╗Öt ─æiß╗üu kiß╗çn trong `SubscriptionNoticeJob`. |
| D09 | SCR-61 "Search: Farm name or subscription code"; schema kh├┤ng c├│ m├ú g├│i (subscription code). | T├¼m theo t├¬n trß║íi hoß║Àc m├ú thanh to├ín (payment code) cß╗ºa c├íc kß╗│ ─æ├ú mua; kh├┤ng tß╗▒ ─æß║Àt m├ú g├│i mß╗øi. | Cß║ºn chß╗º dß╗▒ ├ín x├íc nhß║¡n nß║┐u SRS muß╗æn mß╗Öt m├ú ri├¬ng. |
| D10 | SCR-48 "Getting started": hai bã░ß╗øc "Review breeds and production purposes", "Check farm parameters" kh├┤ng c├│ dß╗» liß╗çu chß╗®ng minh ─æ├ú xem. | Bã░ß╗øc dß╗» liß╗çu (chuß╗ông, thuß╗æc, mß╗Øi th├ánh vi├¬n, phiß║┐u nhß║¡p ─æß║ºu ti├¬n) suy ra tß╗½ dß╗» liß╗çu; ba bã░ß╗øc xem lß║íi (giß╗æng/mß╗Ñc ─æ├¡ch, tham sß╗æ, liß╗üu vaccine) xong khi ─æ├ú sß╗¡a dß╗» liß╗çu tã░ãíng ß╗®ng hoß║Àc ngã░ß╗Øi d├╣ng ─æ├ính dß║Ñu. Trß║íng th├íi lã░u ß╗ƒ `farm.onboarding_steps_done` / `onboarding_dismissed_at` c├│ sß║Án. | Kh├┤ng th├¬m migration. |
| D11 | GBR-14, MSG-COM-12, UC-FE02-02 AF1: trß║íi kh├┤ng ACTIVE chß╗ë c├▓n th├┤ng tin trß║íi, g├│i dß╗ïch vß╗Ñ v├á hß╗ù trß╗ú. Test c┼® cß╗ºa FE04/06/13 kß╗│ vß╗ìng vß║½n ─æß╗ìc ─æã░ß╗úc dß╗» liß╗çu vß║¡n h├ánh. | Giß╗» h├ánh vi cß╗ºa m├ú: cß║ú ─æß╗ìc lß║½n ghi dß╗» liß╗çu vß║¡n h├ánh ─æß╗üu trß║ú `MSG-COM-12`. Test c┼® ─æã░ß╗úc sß╗¡a theo SRS. | Kh├┤ng ─æß╗òi API. |
| D12 | Repo c├│ hai bß║ún SRS: `docs/requirements/SRS_2026-10-28.txt` (86 SCR) v├á `SRS_2026-11-01_SEP490_G35_Report.txt` tr├¬n nh├ính LamKD (104 SCR, ─æ├ính sß╗æ kh├íc, v├¡ dß╗Ñ Tß╗ôn kho thß╗®c ─ân SCR-77 Ôåö SCR-111). Spec c┼® trong `docs/superpowers/specs/` viß║┐t trã░ß╗øc khi chß╗æt. | Nh├│m chß╗æt ng├áy 07/11/2026: nguß╗ôn y├¬u cß║ºu ─æß╗â triß╗ân khai v├á nghiß╗çm thu l├á SRS 28/10 c├╣ng 23 spec trong `docs/requirements/specs/`. M├ú UC, SCR, MSG, GBR theo bß║ún 28/10. Bß║ún 01/11 kh├┤ng d├╣ng. Spec trong `docs/superpowers/specs/` chß╗ë ─æß╗â tham khß║úo lß╗ïch sß╗¡. | Mß╗ìi PR, test case (TC-xx-nn) v├á b├ío c├ío 5.1ÔÇô5.5 dß║½n theo SRS 28/10 v├á spec. Checklist d├╣ng sß╗æ SCR bß║ún 01/11 phß║úi ─æß╗òi vß╗ü bß║ún 28/10. C├óu hß╗Åi c├▓n mß╗ƒ theo d├Ái tß║íi `docs/requirements/specs/OPEN_QUESTIONS.md`; route thiß║┐u tß║íi `MISSING_ROUTES.md`. |
| D13 | 19 c├óu hß╗Åi mß╗Ñc 10 cß╗ºa spec FE-08 ÔåÆ FE-12 (`docs/requirements/specs/OPEN_QUESTIONS.md`). | Chß╗º feature (Tuß║Ñn) chß╗æt ng├áy 07/11/2026 theo ─æß╗ü xuß║Ñt trong spec. ─Éiß╗âm cß║ºn lã░u ├¢: FE-10 Q3 bß╗Å chß╗®c n─âng sß╗¡a viß╗çc ─æ├│ng ca v├¼ SRS kh├┤ng c├│; FE-08 Q3 thang BCS 1ÔÇô9 d├╣ng ngã░ß╗íng dã░ß╗øi 4,0; FE-11 Q2 kiß╗âm tr├╣ng 12 giß╗Ø ├íp cho cß║ú ─æß╗Öng dß╗Ñc v├á phß╗æi, trß╗½ phß╗æi lß║ºn hai c├│ chß╗º ├¢; FE-12 Q1 sau kß║┐t quß║ú KH├öNG C├ô THAI con c├íi vß╗ü Chß╗Ø phß╗æi theo Table 3.4-3. | Kh├┤ng ─æß╗òi y├¬u cß║ºu trong SRS. Route sß╗¡a ─æ├│ng ca hiß╗çn c├│ trong code ─æã░ß╗úc gß╗í khi l├ám FE-10. Test case viß║┐t theo quyß║┐t ─æß╗ïnh n├áy. |
| D14 | SRS Part III ┬º19.1.1 SCR-57 y├¬u cß║ºu sß╗æ ng├áy tß╗øi cuß╗æi kß╗│ hiß╗çn tß║íi nhã░ng chã░a quy ─æß╗ïnh l├ám tr├▓n. `FarmWorkspaceService.details` d├╣ng `Duration.toDays()`; `subscriptionRules.daysUntil` d├╣ng `Math.floor`. FE-02 Q4 ─æ├ú chß╗æt kh├┤ng c├│ kß╗│ hiß╗çn tß║íi th├¼ hiß╗çn "ÔÇö", SUSPENDED vß║½n ─æß║┐m theo kß╗│. | V─ân ─Éß╗®c (DucNV) x├íc nhß║¡n ng├áy 09/11/2026: giß╗» sß╗æ ng├áy tr├▓n 24 giß╗Ø, l├ám tr├▓n xuß╗æng, tß╗æi thiß╗âu 0. C├▓n 23 giß╗Ø ÔåÆ 0 ng├áy nhã░ng vß║½n c├│ bao phß╗º tß╗øi ─æ├║ng end; kh├┤ng c├│ kß╗│ hiß╗çn tß║íi ÔåÆ null / "ÔÇö". SUSPENDED kh├┤ng dß╗½ng ─æß║┐m kß╗│ hiß╗çn tß║íi. | L├ám r├Á hiß╗ân thß╗ï SCR-57 v├á thß╗æng nhß║Ñt FE-02 / FE-19; kh├┤ng ─æß╗òi thß╗Øi ─æiß╗âm kß╗│, bao phß╗º [start, end), trß║íng th├íi dß╗ïch vß╗Ñ hoß║Àc tß║ím ngã░ng. Bß╗ò sung R-19-16, FE-19 Q6 v├á ti├¬u ch├¡ TC-19-36; ─æ├óy l├á quyß║┐t ─æß╗ïnh y├¬u cß║ºu, chã░a phß║úi bß║▒ng chß╗®ng API / UI ─æ├ú ─æã░ß╗úc kiß╗âm chß╗®ng. |

| D15 | UC-FE19-02, SCR-58/59: cß║ºn chß╗æt phß║ím vi, ├¢ ngh─®a bã░ß╗øc nhß║¡n giao dß╗ïch trã░ß╗øc x├íc nhß║¡n v├á c├ích tß╗▒ cß║¡p nhß║¡t m├án h├¼nh. | Ngã░ß╗Øi d├╣ng x├íc nhß║¡n ng├áy 09/11/2026 trong phi├¬n: l├ám backend + nß╗æi SCR-58/SCR-59, gß╗ôm tß║ío/mß╗ƒ lß║íi/─æß╗ìc chi tiß║┐t. Chß╗®ng tß╗½ ─æ├ú x├íc thß╗▒c, chiß╗üu v├áo, ─æ├║ng m├┤i trã░ß╗Øng/namespace/t├ái khoß║ún/m├ú ─æã░ß╗úc thß╗â hiß╗çn ─æ├ú nhß║¡n d├╣ sai sß╗æ tiß╗ün; chß╗ë shared confirmation hß╗úp lß╗ç mß╗øi PAID/cß║Ñp kß╗│. SCR-59 tß╗▒ ─æß╗ìc lß║íi mß╗ùi 5 gi├óy khi PENDING, kh├┤ng request chß╗ông; dß╗½ng khi PAID/EXPIRED hoß║Àc rß╗Øi m├án h├¼nh, giß╗» n├║t Kiß╗âm tra lß║íi; kiß╗âm tra th├¬m mß╗Öt lß║ºn khi hß║┐t thß╗Øi gian. | Bß╗ò sung mß╗æc nhß║¡n/x├íc nhß║¡n c├│ nguß╗ôn lã░u thß║¡t v├á API readback; kh├┤ng suy giß╗Ø x├íc nhß║¡n tß╗½ giß╗Ø ng├ón h├áng. Kh├┤ng mß╗ƒ rß╗Öng sang danh s├ích lß╗ïch sß╗¡, UI ─æß╗æi so├ít/c├┤ng bß╗æ gi├í hoß║Àc bß║¡t SePay LIVE. |

| D16 | UC-FE19-03, SCR-60, Q3: cß║ºn x├íc nhß║¡n scope, t├¼m m├ú, bi├¬n ng├áy v├á c├ích l├ám mß╗øi lß╗ïch sß╗¡. | Ngã░ß╗Øi d├╣ng x├íc nhß║¡n cß║ú bß╗æn ─æß╗ü xuß║Ñt ng├áy 09/11/2026: backend + SCR-60, d├╣ng lß║íi SCR-59 cß╗ºa UC2; t├¼m chß╗®a mß╗Öt phß║ºn m├ú kh├┤ng ph├ón biß╗çt hoa/thã░ß╗Øng, mß║Àc ─æß╗ïnh mß╗ìi trß║íng th├íi v├á ng├áy, mß╗øi nhß║Ñt theo requestedAt trã░ß╗øc; khoß║úng ng├áy tß║ío bao gß╗ôm trß╗ìn from/to theo Asia/Ho_Chi_Minh, cho nhß║¡p ri├¬ng tß╗½ng ─æß║ºu, from > to b├ío MSG-COM-11. Tß║úi mß╗øi khi v├áo m├án, thay filter/trang, trß╗ƒ lß║íi tß╗½ SCR-59 hoß║Àc bß║Ñm L├ám mß╗øi; polling 5 gi├óy ├íp dß╗Ñng SCR-59 theo D15. | Chß╗æt phß║ºn UC-03 cß╗ºa Q3. Theo Table III-1: 20 d├▓ng/trang, giß╗» bß╗Ö lß╗ìc trong phi├¬n; PAID/EXPIRED xem panel chß╗ë ─æß╗ìc nhã░ SCR-60. Bß╗ò sung paging/filter/sort ß╗ƒ API A3, giß╗» quyß╗ün Owner hiß╗çn tß║íi v├á dß╗» liß╗çu snapshot; kh├┤ng thay logic x├íc nhß║¡n/cß║Ñp kß╗│. |

| D17 | UC-FE19-04 / SCR-61 thiß║┐u ─æß║Àc tß║ú Part II (FE-19 Q3); trang hiß╗çn c├│ d├╣ng demo, thiß║┐u coverage/paging/sort v├á li├¬n kß║┐t thanh to├ín cß╗Ñ thß╗â. D09 chã░a diß╗àn giß║úi trã░ß╗Øng m├ú subscription trong chi tiß║┐t. | Ngã░ß╗Øi d├╣ng x├íc nhß║¡n ng├áy 09/11/2026 thß╗▒c hiß╗çn cß║ú s├íu ─æß╗ü xuß║Ñt: ho├án thiß╗çn backend + nß╗æi SCR-61 hiß╗çn c├│ v├á phß║ºn ─æß╗ìc ─æ├║ng thanh to├ín nguß╗ôn ß╗ƒ SCR-62. CURRENT = c├│ kß╗│ bao phß╗º now; FUTURE_ONLY = kh├┤ng c├│ kß╗│ hiß╗çn tß║íi, c├│ kß╗│ tã░ãíng lai; NONE = kh├┤ng c├│ cß║ú hai, gß╗ôm chã░a mua v├á ─æ├ú hß║┐t hß║ín; ─æß╗Öc lß║¡p vß╗øi SUSPENDED. ├üp dß╗Ñng D09: nhß║¡n diß╗çn bß║▒ng t├¬n trß║íi, t├¼m t├¬n trß║íi hoß║Àc m├ú thanh to├ín cß╗ºa kß╗│ PAID, kh├┤ng tß║ío/hiß╗ân thß╗ï m├ú subscription giß║ú. Hiß╗ân thß╗ï v├á lß╗ìc ng├áy x├íc nhß║¡n ─æß║┐n theo ng├áy cuß╗æi phß╗Ñc vß╗Ñ (end trß╗½ mß╗Öt ─æãín vß╗ï thß╗Øi gian trã░ß╗øc khi ─æß╗òi sang Asia/Ho_Chi_Minh); nhß║¡n ─æß╗Öc lß║¡p hai ─æß║ºu ng├áy, khoß║úng ─æß║úo MSG-COM-11. Lß║ºn mua mß╗øi nhß║Ñt theo confirmedAt cß╗ºa PAID; ph├ón biß╗çt chã░a c├│ subscription vß╗øi ─æ├ú ─æ─âng k├¢ nhã░ng chã░a c├│ kß╗│ mua. T├¼m contains kh├┤ng ph├ón biß╗çt hoa/thã░ß╗Øng; mß║Àc ─æß╗ïnh mß╗ìi lß╗ìc, confirmedUntil giß║úm dß║ºn, null cuß╗æi; 20 d├▓ng/trang, giß╗» lß╗ìc trong phi├¬n, l├ám mß╗øi theo thao t├íc/v├áo m├án/quay lß║íi hoß║Àc n├║t L├ám mß╗øi. | Chß╗æt ri├¬ng UC-04 cß╗ºa Q3; d├╣ng lß║íi trang v├á API sß║Án c├│, bß╗ò sung contract/tests theo ma trß║¡n tß║íi docs/reviews/FE19_UC04_REVIEW.md. Trß║íng th├íi ─æß╗ìc suy ra tß║íi mß╗Öt clock, kß╗│ vß║½n [start,end), max(end) gß╗ôm kß╗│ tã░ãíng lai, mß╗ƒ gia hß║ín = end ÔêÆ 90 ng├áy; kh├┤ng thay nghiß╗çp vß╗Ñ ghi tiß╗ün/cß║Ñp kß╗│. ─É├óy l├á quyß║┐t ─æß╗ïnh y├¬u cß║ºu, chã░a phß║úi bß║▒ng chß╗®ng ─æ├ú kiß╗âm chß╗®ng hay READY_FOR_FE. |

SRS m├┤ tß║ú ERD ß╗ƒ mß╗®c kh├íi niß╗çm: c├íc d├▓ng chi tiß║┐t, lß╗ïch sß╗¡ v├á phi├¬n bß║ún nß║▒m trong phß║ºn m├┤ tß║ú entity. Viß╗çc cß║ºn th├¬m bß║úng chi tiß║┐t so vß╗øi c├íc ├┤ tr├¬n sãí ─æß╗ô l├á triß╗ân khai quan hß╗ç ─æ├│, kh├┤ng tß╗▒ n├│ l├á m├óu thuß║½n.

Mß╗ùi vß║Ñn ─æß╗ü mß╗øi cß║ºn ghi phß║ºn nguß╗ôn cß╗Ñ thß╗â, quyß║┐t ─æß╗ïnh v├á ß║únh hã░ß╗ƒng ─æß║┐n API/dß╗» liß╗çu. Nß║┐u SRS v├á ERD kh├┤ng ─æß╗º ─æß╗â giß║úi quyß║┐t mß╗Öt m├óu thuß║½n nghiß╗çp vß╗Ñ, phß║úi trao ─æß╗òi vß╗øi chß╗º dß╗▒ ├ín trã░ß╗øc khi chß╗æt phß║ºn phß╗Ñ thuß╗Öc.

### D18 ÔÇö UC-FE19-05 (10/11/2026)

Ngã░ß╗Øi d├╣ng x├íc nhß║¡n cß║ú s├íu ─æß╗ü xuß║Ñt: backend + nß╗æi SCR-62 hiß╗çn c├│ cho phß║ºn xem
hai tab, tß╗òng hß╗úp, chi tiß║┐t, ß╗®ng vi├¬n v├á lß╗ïch sß╗¡. API-03 (ID/khoß║úng ng├áy, Q2)
v├á mß╗ìi thao t├íc ghi ─æß╗æi so├ít ─æß╗â g├│i UC6. Tß╗òng hß╗úp to├án hß╗ç thß╗æng ─æß╗Öc lß║¡p lß╗ìc;
PENDING chß╗ë khi now < expiresAt; Cß║ºn xem gß╗ôm UNMATCHED/NEEDS_REVIEW chã░a kh├│a,
HOLD/HELD v├á kh├│a c├│ ├┤ ri├¬ng. Mß║Àc ─æß╗ïnh Tß║Ñt cß║ú/kh├┤ng giß╗øi hß║ín ng├áy; chß╗®ng tß╗½
theo bankPaidAt desc/id desc, y├¬u cß║ºu theo requestedAt desc/id desc; t├¼m m├ú/t├¬n
trß║íi contains kh├┤ng ph├ón biß╗çt hoa thã░ß╗Øng v├á lß╗ìc trß║íng th├íi hiß╗çu lß╗▒c. Danh s├ích
che m├ú chß╗ë c├▓n bß╗æn sß╗æ cuß╗æi, chi tiß║┐t PM xem ─æß║ºy ─æß╗º. Tß║úi khi v├áo m├án/─æß╗òi
tab/lß╗ìc/trang/quay lß║íi/L├ám mß╗øi; giß╗» lß╗ìc/trang trong phi├¬n, kh├┤ng polling.

Chß╗æt phß║ºn xem UC-05 cß╗ºa Q3; ph├ón trang 20 v├á ng├áy VN theo SRS III-1/GBR-66.
Ma trß║¡n, test v├á giß╗øi hß║ín: `docs/reviews/FE19_UC05_REVIEW.md`. GET kh├┤ng ghi
tiß╗ün/cß║Ñp kß╗│/─æß╗òi chß╗®ng tß╗½; kh├┤ng suy sai thß╗Øi gian tß╗½ trß║íng th├íi EXPIRED. Phß║ºn
tra cß╗®u v├á ghi UC6 ghi r├Á l├á ho├ún, chã░a chß╗®ng nhß║¡n to├án SCR-62/READY_FOR_FE.

### D19 ÔÇö UC-FE19-06 (10/11/2026)

Ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ cß║ú n─âm ─æß╗ü xuß║Ñt:

1. SCR-62 giß╗» **mß╗Öt ├┤** "L├¢ do v├á tham chiß║┐u chß╗®ng tß╗½" (SRS 4961), tß╗æi ─æa
   1.000 k├¢ tß╗▒ cho quyß║┐t ─æß╗ïnh ACCEPT/HOLD/REJECT v├á l├¢ do kh├│a/mß╗ƒ kh├│a (Q4);
   A9 bß╗Å `references?`. Migration mß╗øi mß╗ƒ rß╗Öng `review_reason` l├¬n 1.000, kh├┤ng
   sß╗¡a migration ─æ├ú chß║íy.
2. LOCK / UNLOCK / RETURN_VERIFIED ─æã░ß╗úc lã░u th├ánh d├▓ng `evidence_review` (SRS
   815), audit vß║½n ghi. Lß╗ïch sß╗¡ SCR-62 ─æß╗ìc bß║úng n├áy; dß╗» liß╗çu c┼® chß╗ë c├│ audit
   vß║½n hiß╗ân thß╗ï, kh├┤ng tr├╣ng.
3. Ghi ho├án trß║ú c├│ ng├áy ho├án trß║ú bß║»t buß╗Öc (cß╗Öt mß╗øi), ng├áy Viß╗çt Nam, kh├┤ng ß╗ƒ
   tã░ãíng lai v├á kh├┤ng trã░ß╗øc ng├áy ng├ón h├áng nhß║¡n; ghi mß╗Öt lß║ºn, sau ─æ├│ bß║Ñt biß║┐n.
4. Tra cß╗®u SePay (API-03, Q2) l├ám cß║ú theo m├ú giao dß╗ïch v├á theo khoß║úng ng├áy:
   khoß║úng ng├áy trß║ú danh s├ích ─æß╗â PM lã░u tß╗½ng giao dß╗ïch th├ánh chß╗®ng tß╗½. C├╣ng giao
   dß╗ïch ─æß║┐n tß╗½ webhook v├á tra cß╗®u ─æã░ß╗úc so theo trã░ß╗Øng nghiß╗çp vß╗Ñ, kh├┤ng theo hash
   payload, ─æß╗â kh├┤ng trß║ú 409 sai.
5. L├ám tiß║┐p tr├¬n nh├ính `feat/fe19-goi-thanh-toan`, t├ích commit code v├á docs.

Theo SRS kh├┤ng cß║ºn quyß║┐t th├¬m: lß╗ùi theo MSG-FE19-11/COM-05/COM-06/COM-02,
`Idempotency-Key` cho lß╗çnh ghi, m├ú ch├¡nh x├íc th├¼ kh├┤ng bß║»t chß╗ìn ß╗®ng vi├¬n,
kh├┤ng kh├│a ho├án trß║ú giao dß╗ïch chiß╗üu ra. Ma trß║¡n v├á bß║▒ng chß╗®ng:
`docs/reviews/FE19_UC06_REVIEW.md`.

### D20 ÔÇö Giao dß╗ïch chuyß╗ân ra kh├┤ng v├áo h├áng "Cß║ºn xem" (10/11/2026)

Ngã░ß╗Øi d├╣ng chß╗ìn phã░ãíng ├ín (a) sau review runtime UC-06. Bã░ß╗øc 1 cß╗ºa
UC-FE19-06 (SRS 2447) chß╗ë coi l├á cß║ºn xem c├íc trã░ß╗Øng hß╗úp tiß╗ün v├áo: m├ú kh├┤ng
khß╗øp, y├¬u cß║ºu hß║┐t hß║ín, kh├┤ng c├│ y├¬u cß║ºu, sai sß╗æ tiß╗ün. Giao dß╗ïch chuyß╗ân ra
kh├┤ng thß╗â trß║ú cho y├¬u cß║ºu n├áo, n├¬n chß╗®ng tß╗½ chiß╗üu ra chã░a ─æã░ß╗úc PM quyß║┐t ─æß╗ïnh
c├│ trß║íng th├íi hiß╗ân thß╗ï `NO_ACTION` ("Kh├┤ng cß║ºn xß╗¡ l├¢"), kh├┤ng t├¡nh v├áo ├┤
"Chß╗®ng tß╗½ cß║ºn xem" v├á kh├┤ng c├│ trong bß╗Ö lß╗ìc "Cß║ºn xem"; vß║½n xem ─æã░ß╗úc ß╗ƒ "Tß║Ñt cß║ú".
Chß╗®ng tß╗½ chã░a c├│ chiß╗üu (dß╗» liß╗çu c┼®) vß║½n coi l├á cß║ºn xem. PM vß║½n c├│ thß╗â Tß║ím giß╗»
hoß║Àc Tß╗½ chß╗æi chß╗®ng tß╗½ chiß╗üu ra; khi ─æ├│ trß║íng th├íi theo quyß║┐t ─æß╗ïnh. ─Éiß╗üu chß╗ënh
quy tß║»c ─æß║┐m cß╗ºa D18. Bß║▒ng chß╗®ng: `docs/reviews/FE19_UC06_REVIEW.md`.

### D21 ÔÇö UC-FE19-06: x├íc nhß║¡n tß╗½ tra cß╗®u v├á y├¬u cß║ºu li├¬n quan trong lß╗ïch sß╗¡ (10/11/2026)

Ngã░ß╗Øi d├╣ng x├íc nhß║¡n hai ─æß╗ü xuß║Ñt trong phi├¬n:

1. Giao dß╗ïch t├¼m lß║íi qua SePay ─æã░ß╗úc tß╗▒ x├íc nhß║¡n nß║┐u ─æß╗º to├án bß╗Ö ─æiß╗üu kiß╗çn
   GBR-72/84, d├╣ng chung cãí chß║┐ x├íc nhß║¡n vß╗øi webhook, nguß╗ôn SEPAY. Kh├┤ng th├¬m
   bã░ß╗øc PM duyß╗çt cho giao dß╗ïch hß╗úp lß╗ç. Kh├┤ng khß╗øp th├¼ chß╗ë lã░u chß╗®ng tß╗½ ─æß╗â PM
   ─æß╗æi so├ít; tra cß╗®u theo khoß║úng vß║½n chß╗ë ─æß╗ìc. Chß║íy lß║íi kh├┤ng cß║Ñp tr├╣ng kß╗│ hay
   bi├¬n lai; thanh to├ín kh├┤ng gß╗í SUSPENDED.
2. Mß╗ùi d├▓ng Evidence Review lã░u ri├¬ng y├¬u cß║ºu thanh to├ín li├¬n quan tß║íi l├║c
   quyß║┐t ─æß╗ïnh. ACCEPT lu├┤n lã░u y├¬u cß║ºu ─æã░ß╗úc x├íc nhß║¡n (kß╗â cß║ú t├¼m bß║▒ng m├ú ch├¡nh
   x├íc); HOLD/REJECT lã░u y├¬u cß║ºu PM chß╗ìn nß║┐u c├│ v├á vß║½n ─æã░ß╗úc lã░u khi kh├┤ng chß╗ìn.
   Li├¬n kß║┐t n├áy chß╗ë l├á ngß╗» cß║únh lß╗ïch sß╗¡, kh├┤ng ph├ón bß╗ò tiß╗ün hay cß║Ñp dß╗ïch vß╗Ñ.
   Kh├┤ng suy li├¬n kß║┐t cß╗ºa lß╗ïch sß╗¡ c┼® tß╗½ thanh to├ín ─æã░ß╗úc ph├ón bß╗ò cuß╗æi c├╣ng.

Bß╗ò sung phß║ºn `related payment request` tß╗½ng ho├ún trong b├ío c├ío UC6; thay quy
ã░ß╗øc HOLD/REJECT bß╗Å qua `paymentId` cß╗ºa D19. Kh├┤ng bß║¡t SePay LIVE hoß║Àc mß╗ƒ rß╗Öng
JOB-06. Ma trß║¡n v├á bß║▒ng chß╗®ng tß║íi `docs/reviews/FE19_UC06_REVIEW.md`.

### D22 ÔÇö UC-FE19-06: m├ú ch├¡nh x├íc chß╗ë cß║Ñp cho trß║íi cß╗ºa m├ú; m├ú giao dß╗ïch l├á kh├│a tra cß╗®u (10/11/2026)

Ngã░ß╗Øi d├╣ng chß╗ìn hai ─æß╗ü xuß║Ñt sau review UC6:

1. Khi nß╗Öi dung chuyß╗ân khoß║ún c├│ m├ú ch├¡nh x├íc cß╗ºa y├¬u cß║ºu X, PM chß╗ë ─æã░ß╗úc chß║Ñp
   nhß║¡n chß╗®ng tß╗½ cho mß╗Öt y├¬u cß║ºu **c├╣ng trß║íi vß╗øi X** (kß╗â cß║ú ch├¡nh X). Danh s├ích
   ß╗®ng vi├¬n chß╗ë gß╗ôm y├¬u cß║ºu cß╗ºa trß║íi ─æ├│; chß╗ìn y├¬u cß║ºu trß║íi kh├íc bß╗ï MSG-FE19-11
   `OTHER_FARM`, kh├┤ng ph├ón bß╗ò g├¼. Trã░ß╗Øng hß╗úp Owner d├╣ng lß║íi m├ú cß╗ºa y├¬u cß║ºu c┼®
   ─æ├ú hß║┐t hß║ín ─æß╗â trß║ú cho y├¬u cß║ºu mß╗øi cß╗ºa c├╣ng trß║íi vß║½n ─æã░ß╗úc chß║Ñp nhß║¡n. M├ú g├Á sai
   hoß║Àc kh├┤ng c├│ m├ú: giß╗» GBR-72, ß╗®ng vi├¬n gß╗ôm mß╗ìi trß║íi.
2. Tra cß╗®u SePay theo m├ú (`POST ÔÇª/lookup/{transactionId}`) kh├┤ng th├¬m
   `Idempotency-Key`: m├ú giao dß╗ïch SePay l├á request key theo BR-D24/GBR-88. Gß╗ìi
   lß║íi c├╣ng m├ú lu├┤n trß║ú chß╗®ng tß╗½ v├á kß║┐t quß║ú ─æß║ºu, kh├┤ng cß║Ñp kß╗│ hai lß║ºn.

C├╣ng ─æß╗út review (kh├┤ng cß║ºn quyß║┐t th├¬m, theo SRS): x├íc nhß║¡n v├á JOB-04 kh├│a trß║íi
trã░ß╗øc khi ─æß╗ìc subscription (GBR-72/73); tra cß╗®u ghi PM thß╗▒c hiß╗çn v├áo audit
(GBR-86), nguß╗ôn x├íc nhß║¡n vß║½n SEPAY (D21); giao dß╗ïch chiß╗üu ra kh├┤ng gß╗¡i th├┤ng b├ío
cß║ºn ─æß╗æi so├ít (D20); dß╗» liß╗çu SePay kh├┤ng lã░u ─æã░ß╗úc khi tra cß╗®u l├á 502. Ma trß║¡n v├á
bß║▒ng chß╗®ng tß║íi `docs/reviews/FE19_UC06_REVIEW.md`.

### D23 ÔÇö UC-FE19-07: c├┤ng bß╗æ, r├║t v├á lß╗ïch sß╗¡ bß║úng gi├í (10/11/2026)

Ngã░ß╗Øi d├╣ng x├íc nhß║¡n cß║ú n─âm ─æß╗ü xuß║Ñt trong phi├¬n, sau khi l├ám r├Á rß║▒ng thß╗Øi ─æiß╗âm
c├┤ng bß╗æ do hß╗ç thß╗æng tß╗▒ ghi v├á kh├íc thß╗Øi ─æiß╗âm hiß╗çu lß╗▒c do PM chß╗ìn:

1. Ho├án thiß╗çn backend v├á nß╗æi SCR-63 hiß╗çn c├│; kiß╗âm gi├í hiß╗çu lß╗▒c cho y├¬u cß║ºu mß╗øi
   v├á trang c├┤ng khai; y├¬u cß║ºu ─æ├ú ph├ít h├ánh v├á kß╗│ ─æ├ú mua giß╗» nguy├¬n.
2. Bß╗ò sung `POST /api/platform/plan-prices/{version}/withdraw` (Q1), l├¢ do r├║t
   bß║»t buß╗Öc, ├¡t nhß║Ñt 5 k├¢ tß╗▒ kh├┤ng phß║úi khoß║úng trß║»ng v├á tß╗æi ─æa 1.000 k├¢ tß╗▒ theo
   Table III-1 (chß╗æt phß║ºn UC7 cß╗ºa Q4). Lã░u l├¢ do/ngã░ß╗Øi/giß╗Ø r├║t, giß╗» lß╗ïch sß╗¡;
   backend kiß╗âm lß║íi ─æiß╗üu kiß╗çn strictly before effectiveAt, revision v├á key.
3. Bß╗Å n├║t Lã░u nh├íp; kh├┤ng th├¬m API/bß║úng lã░u nh├íp. Giß╗» nß╗Öi dung khi lß╗ùi, hß╗Åi trã░ß╗øc
   khi hß╗ºy chß╗ënh sß╗¡a; kh├┤ng lß║Ñy dß╗» liß╗çu demo ─æß╗â thay lß╗ùi backend.
4. C├┤ng bß╗æ ngay kh├┤ng tß╗▒ hß╗ºy lß╗ïch tã░ãíng lai, kß╗â cß║ú lß╗ïch c├│ sß╗æ phi├¬n bß║ún nhß╗Å hãín;
   chß╗ìn gi├í bß║▒ng thß╗Øi ─æiß╗âm hiß╗çu lß╗▒c. Phi├¬n bß║ún ─æ├ú r├║t kh├┤ng chiß║┐m mß╗æc thß╗Øi gian,
   cho ph├®p c├┤ng bß╗æ phi├¬n bß║ún thay thß║┐ tß║íi mß╗æc ─æ├│.
5. Lß╗ïch sß╗¡ 20 d├▓ng/trang, mß╗øi c├┤ng bß╗æ trã░ß╗øc; ─æß╗º gi├í ch├¡nh x├íc, trß║íng th├íi, hiß╗çu
   lß╗▒c, ngã░ß╗Øi/giß╗Ø c├┤ng bß╗æ v├á th├┤ng tin r├║t. Tß║úi khi v├áo m├án, c├┤ng bß╗æ/r├║t th├ánh
   c├┤ng, L├ám mß╗øi v├á tß╗øi mß╗æc hiß╗çu lß╗▒c; kh├┤ng polling ─æß╗ïnh kß╗│.

Giß╗» m├ú phi├¬n bß║ún backend hiß╗çn c├│ (`PlanVersion.id`, kh├┤ng cam kß║┐t li├¬n tiß║┐p);
frontend kh├┤ng tß╗▒ dß╗▒ ─æo├ín max+1. Metadata c┼® chß╗ë lß║Ñy tß╗½ audit c├┤ng bß╗æ thß║¡t, thiß║┐u
th├¼ null / ÔÇ£ÔÇöÔÇØ, kh├┤ng suy tß╗½ effectiveAt. Ma trß║¡n, contract thay ─æß╗òi v├á bß║▒ng
chß╗®ng tß║íi `docs/reviews/FE19_UC07_REVIEW.md`.

### D24 ÔÇö UC-FE19-08: nhß║¡n webhook, xß╗¡ l├¢ bß╗ün vß╗»ng v├á email thanh to├ín (10/11/2026)

Ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ cß║ú n─âm ─æß╗ü xuß║Ñt sau khi ─æß╗ìc spec19/UC8:

1. L├ám API-02, JOB-06 v├á phß║ºn JOB-07 cß╗ºa thanh to├ín, d├╣ng chung cho webhook,
   tra cß╗®u v├á PM x├íc nhß║¡n; kh├┤ng k├¡ch hoß║ít consumer cho c├íc sß╗▒ kiß╗çn outbox cß╗ºa
   feature kh├íc (Chung Q1 vß║½n mß╗ƒ).
2. Giß╗» `POST /api/webhooks/sepay`, th├¬m alias SRS
   `POST /api/v1/payments/sepay/webhook`. Cß║ú hai x├íc thß╗▒c HMAC/raw body nhã░ SRS,
   chß╗ë trß║ú `200 {"success":true}` sau khi chß╗®ng tß╗½ v├á job c├╣ng commit; 200 chã░a
   c├│ ngh─®a PAID. API-03/simulator giß╗» kß║┐t quß║ú th├ánh c├┤ng ngay nhã░ hiß╗çn c├│,
   chß║íy chung bß╗Ö xß╗¡ l├¢ chß╗®ng tß╗½ ─æ├ú lã░u; lß╗ùi kß╗╣ thuß║¡t sau lã░u c├▓n job ─æß╗â retry.
3. JOB-06 retry sau1/5/15 ph├║t, rß╗ôi mß╗ùi giß╗Ø, giß╗øi hß║ín24h t├¡nh tß╗½ lß╗ùi ─æß║ºu;
   sau ─æ├│ dß╗½ng tß╗▒ ─æß╗Öng, giß╗» dß╗» liß╗çu/lß╗ùi ─æß╗â PM xß╗¡ l├¢ tr├¬n SCR-62, th├┤ng b├ío mß╗Öt
   lß║ºn. Lß╗ùi kß╗╣ thuß║¡t ph├ón biß╗çt sai m├ú/sß╗æ tiß╗ün; D20 vß║½n loß║íi th├┤ng b├ío ─æß╗æi so├ít
   cho chiß╗üu ra. Job kh├┤ng ghi ─æ├¿ quyß║┐t ─æß╗ïnh/kh├│a PM hoß║Àc ph├ón bß╗ò ─æ├ú commit.
4. M├ú trong `code`, `referenceCode`, `content` m├óu thuß║½n hoß║Àc nhiß╗üu m├ú kh├íc nhau
   th├¼ kh├┤ng chß╗ìn m├ú ─æß║ºu; giß╗» chß╗®ng tß╗½ cho PM. Giao lß║Àp vß║½n theo dß╗» liß╗çu nghiß╗çp
   vß╗Ñ D19/D22, kh├┤ng theo hash payload ─æãín thuß║ºn.
5. Q5 chß╗æt email tiß║┐ng Viß╗çt cho Owner hiß╗çn tß║íi: trß║íi, m├ú thanh to├ín, sß╗æ tiß╗ün,
   kß╗│ hß║ín, kß╗│ ─æ├ú x├íc nhß║¡n, bi├¬n lai v├á link ─æ├║ng trß║íi, dß╗▒a MSG-FE19-06. Kh├┤ng
   tuy├¬n bß╗æ gß╗í SUSPENDED. Lã░u ├¢ ─æß╗ïnh gß╗¡i c├╣ng PAID, chß╗æng tr├╣ng; gß╗¡i/retry ─æß╗Öc
   lß║¡p ─æß║┐n24h, kiß╗âm lß║íi quyß╗ün/ngã░ß╗Øi nhß║¡n l├║c gß╗¡i.

Kh├┤ng quyß║┐t lß║íi c├íc luß║¡t ─æ├ú r├Á: GBR-72/73/84, cß╗¡a sß╗ò ng├ón h├áng [tß║ío,hß║┐t hß║ín),
kh├│a theo trß║íi, kh├┤ng cß║Ñp tr├╣ng, kh├┤ng gß╗í tß║ím ngã░ng. Mß╗æc kß╗À niß╗çm 29/02 theo
GBR-73 suy tß╗½ chuß╗ùi kß╗│ ─æ├ú mua li├¬n tß╗Ñc, kh├┤ng tß║ío mß╗æc lß╗ïch sß╗¡ giß║ú. Chß╗ë kiß╗âm
MOCK/PostgreSQL/Mailpit local; chã░a SePay LIVE hay READY_FOR_FE. Ma trß║¡n,
test, readback v├á runtime: `docs/reviews/FE19_UC08_REVIEW.md`.

Review UC8 (10/11/2026), ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ sß╗¡a cß║ú bß╗æn ─æiß╗âm:

1. Tra cß╗®u/simulator giß╗» lease job ngay trong commit lã░u; JOB-06 kh├┤ng lß║Ñy chen
   v├áo l├ám mß║Ñt kß║┐t quß║ú trß║ú ngay cß╗ºa D21. Request chß║┐t th├¼ lease hß║┐t hß║ín v├á job
   retry nhã░ E3.
2. Giao lß║Àp t─âng sß╗æ lß║ºn giao bß║▒ng bulk update, kh├┤ng ─æß╗òi version chß╗®ng tß╗½, n├¬n
   quyß║┐t ─æß╗ïnh PM ─æang mß╗ƒ kh├┤ng bß╗ï MSG-COM-05 v├┤ cß╗ø.
3. Trã░ß╗Øng chß╗» cß╗ºa giao dß╗ïch ─æ├ú x├íc thß╗▒c (gateway, referenceCode, accountNumber,
   code) lu├┤n ─æã░ß╗úc lã░u ─æß╗º: chß╗ìn nß╗øi cß╗Öt theo giß╗øi hß║ín body 65.536 byte thay v├¼
   tß╗½ chß╗æi 400 hoß║Àc l├ám hß╗Ång cß║ú khoß║úng tra cß╗®u 502 (R-19-08, E3).
4. Metadata lß╗Øi gß╗ìi bß╗ï 401 giß╗» 30 ng├áy rß╗ôi JOB-08 x├│a; kh├┤ng lã░u ─æã░ß╗úc metadata
   vß║½n trß║ú 401.

### D25 ÔÇö UC-FE03-01: gß╗¡i lß╗Øi mß╗Øi th├ánh vi├¬n (11/11/2026)

Ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ cß║ú bß╗æn ─æß╗ü xuß║Ñt trong phi├¬n:

1. Email thuß╗Öc membership INACTIVE trß║ú `MSG-FE03-21`, k├¿m `email` v├á
   `membershipId`, ─æß╗â Owner mß╗ƒ popup K├¡ch hoß║ít lß║íi cß╗ºa UC6. Kh├┤ng tß║ío lß╗Øi mß╗Øi,
   kh├┤ng tß╗▒ k├¡ch hoß║ít hoß║Àc ─æß╗òi vai tr├▓. Popup vß║½n y├¬u cß║ºu ng├áy hiß╗çu lß╗▒c v├á l├¢
   do; k├¡ch hoß║ít lß║íi giß╗» vai tr├▓ hiß╗çn tß║íi cß╗ºa membership.
2. T├ái khoß║ún SUSPENDED chã░a l├á th├ánh vi├¬n trß║íi vß║½n ─æã░ß╗úc nhß║¡n lß╗Øi mß╗Øi. Trß║íng th├íi
   n├áy tiß║┐p tß╗Ñc chß║Àn ─æ─âng nhß║¡p/chß║Ñp nhß║¡n; chß╗ë c├│ thß╗â chß║Ñp nhß║¡n sau khi t├ái khoß║ún
   ─æã░ß╗úc kh├┤i phß╗Ñc v├á lß╗Øi mß╗Øi c├▓n hß║ín. Quy tß║»c membership ACTIVE/INACTIVE vß║½n
   ─æã░ß╗úc kiß╗âm trã░ß╗øc; kh├┤ng c├┤ng bß╗æ trß║íng th├íi t├ái khoß║ún platform cho Owner.
3. Th├ánh c├┤ng lã░u lß╗Øi mß╗Øi v├á ├¢ ─æß╗ïnh gß╗¡i email d├╣ng `MSG-FE03-01` vß╗øi nß╗Öi dung
   ÔÇ£─É├ú tß║ío lß╗Øi mß╗Øi tß╗øi {email}. Hß╗ç thß╗æng ─æang gß╗¡i email.ÔÇØ, k├¿m hß║ín ch├¡nh x├íc.
   Kh├┤ng coi HTTP th├ánh c├┤ng l├á email ─æ├ú ─æß║┐n. Lß╗ùi nh├á cung cß║Ñp giß╗» lß╗Øi mß╗Øi
   PENDING, retry t─âng dß║ºn tß╗æi ─æa 24 giß╗Ø theo JOB-07; kh├┤ng rollback nghiß╗çp vß╗Ñ.
   Gß╗¡i lß║íi d├╣ng th├┤ng b├ío tã░ãíng ß╗®ng: ─æ├ú cß║¡p nhß║¡t lß╗Øi mß╗Øi, hß╗ç thß╗æng ─æang gß╗¡i
   email (MSG-FE03-05), giß╗» c├╣ng lß╗Øi mß╗Øi thay v├¼ tuy├¬n bß╗æ tß║ío lß╗Øi mß╗Øi mß╗øi.
4. Scope gß╗ôm backend, popup Mß╗Øi tß╗½ SCR-13/SCR-14, gß╗¡i email v├á ─æß╗ìc lß║íi kß║┐t quß║ú;
   nß╗æi nh├ính Gß╗¡i lß║íi (UC3) v├á K├¡ch hoß║ít lß║íi (UC6), kiß╗âm phß║ºn phß╗Ñ thuß╗Öc ─æã░ß╗úc d├╣ng.
   UC4 Chß║Ñp nhß║¡n lß╗Øi mß╗Øi l├á g├│i ri├¬ng; kh├┤ng chß╗®ng nhß║¡n to├án UC3/UC6 hoß║Àc FE-03.

Chß╗æt FE-03 Q1 v├á ri├¬ng phß║ºn nhß║¡n lß╗Øi mß╗Øi cß╗ºa Q4; phß║ºn cß║Ñp quyß╗ün platform cß╗ºa
Q4 vß║½n mß╗ƒ. Giß╗» t├¬n field API hiß╗çn c├│ `validityDays` (3/7/14, mß║Àc ─æß╗ïnh 7), ─æß╗ông
bß╗Ö spec thay cho t├¬n m├┤ tß║ú `validDays`; kh├┤ng ─æß╗òi route. Ghi kiß╗âm thß╗¡ v├á giß╗øi
hß║ín tß║íi `docs/reviews/FE03_UC01_REVIEW.md`; quyß║┐t ─æß╗ïnh chã░a phß║úi READY_FOR_FE.

### D26 ÔÇö UC-FE03-02: xem lß╗Øi mß╗Øi cß╗ºa trß║íi (12/11/2026)

Ngã░ß╗Øi d├╣ng x├íc nhß║¡n cß║ú s├íu ─æß╗ü xuß║Ñt trong phi├¬n, sau khi ─æß╗ìc spec FE-03 Q2:

1. Ho├án thiß╗çn backend v├á SCR-14: danh s├ích, tab, sß╗æ lã░ß╗úng, ph├ón trang, sß║»p xß║┐p,
   tß║úi/lß╗ùi/rß╗ùng. T├íi d├╣ng popup Mß╗Øi UC1 v├á c├íc lß╗çnh UC3; chß╗ë kiß╗âm phß║ºn phß╗Ñ thuß╗Öc
   ─æã░ß╗úc sß╗¡ dß╗Ñng, kh├┤ng chß╗®ng nhß║¡n to├án UC3/UC4 hoß║Àc to├án FE-03.
2. Owner c├│ membership ACTIVE ─æã░ß╗úc xem lß╗Øi mß╗Øi ─æ├║ng trß║íi ß╗ƒ mß╗ìi trß║íng th├íi dß╗ïch
   vß╗Ñ, gß╗ôm PENDING_PAYMENT/EXPIRED/SUSPENDED, ─æß╗â thu hß╗ôi quyß╗ün truy cß║¡p. Mß╗Øi v├á
   Gß╗¡i lß║íi vß║½n cß║ºn trß║íi ACTIVE; Hß╗ºy chß╗ë ├íp dß╗Ñng lß╗Øi mß╗Øi c├▓n PENDING, chã░a hß║┐t hß║ín.
   ─É├óy l├á ngoß║íi lß╗ç ─æß╗ìc phß╗Ñc vß╗Ñ viß╗çc hß╗ºy ß╗ƒ GBR-14, kh├┤ng mß╗ƒ dß╗» liß╗çu vß║¡n h├ánh kh├íc.
3. Lß║ºn ─æß║ºu mß╗ƒ chß╗ìn PENDING; mß║Àc ─æß╗ïnh lastSentAt giß║úm dß║ºn, bß║Ñm cß╗Öt ─æß╗â ─æß║úo chiß╗üu.
   Khi bß║▒ng thß╗Øi ─æiß╗âm, id giß║úm dß║ºn giß╗» thß╗® tß╗▒ ß╗òn ─æß╗ïnh. Giß╗» lß╗▒a chß╗ìn theo tß╗½ng
   trß║íi/t├ái khoß║ún trong phi├¬n; ─æß╗òi tab hoß║Àc chiß╗üu sß║»p xß║┐p trß╗ƒ vß╗ü trang ─æß║ºu.
4. Tß║íi mß╗Öt clock cß╗ºa mß╗ùi lß║ºn ─æß╗ìc, PENDING c├│ expiresAt <= now ─æã░ß╗úc trß║ú v├á ─æß║┐m
   nhã░ EXPIRED, kh├┤ng c├│ thao t├íc. GET kh├┤ng sß╗¡a bß║ún ghi/version/audit/mail;
   JOB-02 v├á luß╗ông ghi tiß║┐p tß╗Ñc quß║ún l├¢ trß║íng th├íi lã░u.
5. API danh s├ích trß║ú `{items,total,page,size,counts,asOf}`, thay cho mß║úng.
   `counts` c├│ ─æß╗º PENDING/ACCEPTED/EXPIRED/CANCELLED, t├¡nh tr├¬n to├án trß║íi trã░ß╗øc
   lß╗ìc/ph├ón trang; `total` theo bß╗Ö lß╗ìc hiß╗çn tß║íi. UI 20 d├▓ng/trang theo Table III-1.
   Cß║¡p nhß║¡t ─æß╗ông bß╗Ö UC1; tra lß╗Øi mß╗Øi xung ─æß╗Öt bß║▒ng ID, kh├┤ng chß╗ë t├¼m ß╗ƒ trang ─æß║ºu.
6. Tß║úi lß║íi khi v├áo/quay lß║íi m├án, ─æß╗òi tab/trang/sß║»p xß║┐p, sau Mß╗Øi/Gß╗¡i lß║íi/Hß╗ºy hoß║Àc
   bß║Ñm L├ám mß╗øi. Kh├┤ng polling ─æß╗ïnh kß╗│.

Chß╗æt ri├¬ng UC2 cß╗ºa FE-03 Q2; UC5 v├á UC7 vß║½n mß╗ƒ. `hasAccount` tiß║┐p tß╗Ñc chß╗ë b├ío
c├│ t├ái khoß║ún tß║íi lß║ºn ─æß╗ìc, kh├┤ng c├┤ng bß╗æ trß║íng th├íi t├ái khoß║ún platform (D25).
Ng├áy giß╗Ø hiß╗ân thß╗ï theo m├║i giß╗Ø trß║íi (Table III-1), mß║Àc ─æß╗ïnh Asia/Ho_Chi_Minh.
Ma trß║¡n, kiß╗âm thß╗¡ v├á giß╗øi hß║ín ghi tß║íi `docs/reviews/FE03_UC02_REVIEW.md`;
quyß║┐t ─æß╗ïnh y├¬u cß║ºu kh├┤ng tß╗▒ tß║ío bß║▒ng chß╗®ng READY_FOR_FE.

### D27 ÔÇö UC-FE03-03: gß╗¡i lß║íi / hß╗ºy lß╗Øi mß╗Øi ─æang chß╗Ø (14/11/2026)

Ngã░ß╗Øi d├╣ng chß╗ìn cß║ú bß╗æn ─æß╗ü xuß║Ñt trong phi├¬n, sau khi ─æß╗ìc spec FE-03 v├á SRS
UC-FE03-03:

1. Gß╗¡i lß║íi v├┤ hiß╗çu link c┼®: mß╗ùi lß║ºn gß╗¡i lß║íi tß║ío token mß╗øi, chß╗ë link trong email
   mß╗øi nhß║Ñt mß╗ƒ ─æã░ß╗úc lß╗Øi mß╗Øi; link c┼® b├ío lß╗Øi mß╗Øi kh├┤ng c├▓n hiß╗çu lß╗▒c. Theo mß║½u
   "link mß╗øi thay link c┼®" cß╗ºa FE-01 (UC-FE01-01 AF4, UC-FE01-05 AF2, SCR-04).
   Vß║½n l├á c├╣ng lß╗Øi mß╗Øi; email, vai tr├▓, sß╗æ ng├áy hiß╗çu lß╗▒c giß╗» nguy├¬n, hß║ín t├¡nh
   lß║íi tß╗½ lß║ºn gß╗¡i (GBR-16).
2. Kh├┤ng giß╗øi hß║ín sß╗æ lß║ºn Gß╗¡i lß║íi: SRS kh├┤ng ─æß║Àt giß╗øi hß║ín cho lß╗Øi mß╗Øi, kh├┤ng ├íp
   giß╗øi hß║ín 60 gi├óy / 5 lß║ºn mß╗ùi giß╗Ø cß╗ºa email x├íc minh FE-01. Chß╗æng bß║Ñm tr├╣ng
   bß║▒ng Idempotency-Key v├á kh├│a n├║t khi ─æang gß╗¡i; rß╗ºi ro Owner gß╗¡i lß║Àp email
   ─æã░ß╗úc ghi trong review.
3. X├íc nhß║¡n Hß╗ºy (MSG-FE03-06) l├á hß╗Öp thoß║íi modal vß╗øi n├║t "Quay lß║íi" /
   "Hß╗ºy lß╗Øi mß╗Øi", giß╗» version ─æ├ú thß║Ñy khi mß╗ƒ (TC-03-45). Th├┤ng b├ío th├ánh c├┤ng
   MSG-FE03-05/07 vß║½n l├á banner nhã░ UC1.
4. Hiß╗ân thß╗ï link sau khi Hß╗ºy (SCR-15 "Lß╗Øi mß╗Øi kh├┤ng c├▓n hiß╗çu lß╗▒c" k├¿m trß║íng th├íi
   v├á hß║ín, JOB-08 chß╗ë x├│a hash sau 7 ng├áy) chuyß╗ân sang UC4, l├ám c├╣ng trã░ß╗Øng hß╗úp
   EXPIRED (FE-03 Q6). UC3 giß╗» h├ánh vi hiß╗çn c├│: Hß╗ºy x├│a hash, link kh├┤ng cß║Ñp g├¼
   (POST-2) v├á SCR-15 b├ío "Li├¬n kß║┐t kh├┤ng hß╗úp lß╗ç".

Triß╗ân khai ─æi k├¿m, kh├┤ng ─æß╗òi route/DTO: kh├│a d├▓ng lß╗Øi mß╗Øi khi Gß╗¡i lß║íi/Hß╗ºy; thß╗® tß╗▒
lß╗ùi COM-01 ÔåÆ FE03-04 (chß╗ë Gß╗¡i lß║íi) ÔåÆ COM-08 (lß╗Øi mß╗Øi kh├┤ng thuß╗Öc trß║íi) ÔåÆ
FE03-08 k├¿m trß║íng th├íi hiß╗çn tß║íi, kß╗â cß║ú khi version c┼® ÔåÆ COM-05. PENDING ─æ├ú qu├í
hß║ín b├ío EXPIRED theo clock cß╗ºa lß║ºn gß╗ìi m├á kh├┤ng ghi; JOB-02 vß║½n quß║ún l├¢ trß║íng
th├íi lã░u. Audit Gß╗¡i lß║íi ghi lastSentAt/expiresAt trã░ß╗øc/sau, audit Hß╗ºy ghi
statusBefore/statusAfter (GBR-86). Frontend hiß╗çn MSG-FE03-08 k├¿m trß║íng th├íi v├á
tß║úi lß║íi danh s├ích khi lß╗Øi mß╗Øi ─æ├ú ─æß╗òi; lß╗ùi lã░u giß╗» hß╗Öp thoß║íi v├á c├╣ng key ─æß╗â thß╗¡
lß║íi. Spec A5/A6 d├╣ng t├¬n field `expectedVersion` nhã░ code. Kiß╗âm thß╗¡ v├á giß╗øi hß║ín
ghi tß║íi `docs/reviews/FE03_UC03_REVIEW.md`; quyß║┐t ─æß╗ïnh chã░a phß║úi READY_FOR_FE.

### D28 ÔÇö UC-FE03-04: chß║Ñp nhß║¡n lß╗Øi mß╗Øi (14/11/2026)

Ngã░ß╗Øi d├╣ng chß╗ìn cß║ú bß╗æn ─æß╗ü xuß║Ñt trong phi├¬n, sau khi ─æß╗ìc SRS UC-FE03-04, SCR-15 v├á
─æß╗æi chiß║┐u code:

1. Sß╗¡a tß╗æi thiß╗âu phß║ºn ─æ─âng nhß║¡p/─æiß╗üu hã░ß╗øng d├╣ng chung (FE-01) trong UC4, chß╗ë ß╗ƒ
   frontend: link lß╗Øi mß╗Øi ─æang mß╗ƒ khi chã░a ─æ─âng nhß║¡p ─æã░ß╗úc nhß╗ø trong tr├¼nh duyß╗çt
   (localStorage, 24 giß╗Ø, x├│a khi d├╣ng) v├á mß╗ƒ lß║íi sau khi ─æ─âng nhß║¡p Google hoß║Àc
   x├íc minh email (UC-FE01-02 AF2, UC4 AF3). Complete Owner Profile (SCR-07) chß╗ë
   l├á ─æ├¡ch khi t├ái khoß║ún chã░a c├│ trß║íi n├áo v├á chã░a c├│ vai tr├▓ platform (UC-FE01-02
   bã░ß╗øc 6, AF4); Manager/Technician ─æã░ß╗úc mß╗Øi v├áo thß║│ng trß║íi cß╗ºa m├¼nh. Kh├┤ng ─æß╗òi
   backend FE-01; ghi ch├║ cho chß╗º FE-01 (LamKD) trong review.
2. B├ío Owner khi lß╗Øi mß╗Øi ─æã░ß╗úc chß║Ñp nhß║¡n bß║▒ng email tiß║┐ng Viß╗çt qua h├áng ─æß╗úi JOB-07:
   ├¢ ─æß╗ïnh gß╗¡i lã░u c├╣ng transaction chß║Ñp nhß║¡n (GBR-64), mß╗Öt email mß╗ùi membership
   (BR-D22), retry tß╗æi ─æa 24 giß╗Ø, x├íc ─æß╗ïnh lß║íi Owner ACTIVE l├║c gß╗¡i v├á bß╗Å nß║┐u
   ngã░ß╗Øi nhß║¡n mß║Ñt quyß╗ün. Kh├┤ng th├¬m th├┤ng b├ío trong app (SCR-45 chß╗ë c├│ tab g├│i
   dß╗ïch vß╗Ñ v├á hß╗ù trß╗ú).
3. Mß╗ƒ lß║íi link ─æ├ú chß║Ñp nhß║¡n (AF2): nß║┐u ─æ├║ng email v├á membership c├▓n ACTIVE th├¼
   SCR-15 hiß╗çn "─æ├ú tham gia" vß╗øi n├║t V├áo trß║íi; membership ─æ├ú ngã░ng hoß║Àc trã░ß╗Øng hß╗úp
   kh├íc l├á link ─æ├ú d├╣ng (E1, MSG-FE03-08 k├¿m ACCEPTED).
4. Lß╗çnh Chß║Ñp nhß║¡n kh├┤ng d├╣ng Idempotency-Key: token trong link l├á kh├│a cß╗ºa ├¢ ─æß╗ïnh,
   gß╗ìi lß║íi trß║ú c├╣ng membership (GBR-17). Spec A8 sß╗¡a theo, response trß║ú
   `{membershipId, farmId, farmName, role, status}`.

─Éi k├¿m theo quyß║┐t ─æß╗ïnh UC3 (D27 mß╗Ñc 4, FE-03 Q6): hash cß╗ºa link ─æã░ß╗úc giß╗» sau khi
Hß╗ºy hoß║Àc hß║┐t hß║ín (kß╗â cß║ú JOB-02) ─æß║┐n khi JOB-08 x├│a sau 7 ng├áy; link vß║½n kh├┤ng cß║Ñp
g├¼ v├¼ trß║íng th├íi ─æã░ß╗úc kiß╗âm. A7 trß║ú `{status, farmId, farmName, timeZone, email,
role, invitedBy, sentAt, expiresAt, membershipId?}` cho ─æ├║ng email ─æã░ß╗úc mß╗Øi; lß╗ùi
MSG-FE03-08 k├¿m `status` v├á `expiresAt`. "Gß╗¡i l├║c" l├á lß║ºn gß╗¡i cuß╗æi. V├áo trß║íi sau
khi chß║Ñp nhß║¡n ─æi qua kiß╗âm tra cß╗ºa SCR-09 (quyß╗ün v├á dß╗ïch vß╗Ñ) rß╗ôi tß║úi lß║íi phi├¬n.
Kiß╗âm thß╗¡ v├á giß╗øi hß║ín ghi tß║íi `docs/reviews/FE03_UC04_REVIEW.md`; quyß║┐t ─æß╗ïnh chã░a
phß║úi READY_FOR_FE.

### D29 ÔÇö UC-FE03-05: xem th├ánh vi├¬n trß║íi (14/11/2026)

Ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ cß║ú s├íu ─æß╗ü xuß║Ñt trong phi├¬n, sau khi ─æß╗ìc SRS SCR-13 (d├▓ng
3043ÔÇô3080), Table III-1, GBR-14 v├á ─æß╗æi chiß║┐u code. Chß╗æt phß║ºn UC5 cß╗ºa FE-03 Q2:

1. Phß║ím vi UC5 l├á A1 v├á SCR-13: danh s├ích, tab, sß╗æ ─æß║┐m, sß║»p xß║┐p, ph├ón trang,
   bß║úng quyß╗ün, tß║úi/rß╗ùng/lß╗ùi v├á n├║t thao t├íc ─æ├║ng ─æiß╗üu kiß╗çn. N├║t mß╗ƒ popup c├│ sß║Án
   cß╗ºa UC6; popup v├á lß╗çnh ─æß╗òi vai tr├▓ / ngã░ng / k├¡ch hoß║ít lß║íi kh├┤ng ─æã░ß╗úc chß╗®ng
   nhß║¡n ß╗ƒ UC5.
2. Owner c├│ membership ACTIVE xem SCR-13 ß╗ƒ mß╗ìi trß║íng th├íi dß╗ïch vß╗Ñ, v├¼ GBR-14 cho
   Owner ngã░ng th├ánh vi├¬n khi trß║íi kh├┤ng ACTIVE v├á viß╗çc ─æ├│ cß║ºn thß║Ñy danh s├ích.
   Khi trß║íi kh├┤ng ACTIVE chß╗ë c├▓n Ngã░ng; Mß╗Øi, ─Éß╗òi vai tr├▓, K├¡ch hoß║ít lß║íi bß╗ï kh├│a
   k├¿m ghi ch├║ (c├ích l├ám cß╗ºa SCR-14). Manager chß╗ë xem khi trß║íi ACTIVE (MSG-COM-12);
   Technician kh├┤ng xem (Table III-2, TC-03-26). GBR-14 trong SRS 28/10 ghi ngoß║íi
   lß╗ç chß╗ë ─æß╗ìc n├áy, nhã░ D26 ─æ├ú l├ám cho lß╗Øi mß╗Øi.
3. Tab: "Tß║Ñt cß║ú" l├á mß╗ìi d├▓ng trß║ú vß╗ü (vß╗øi Owner gß╗ôm ch├¡nh Owner v├á ngã░ß╗Øi ─æ├ú ngã░ng);
   "Quß║ún l├¢" / "Kß╗╣ thuß║¡t vi├¬n" chß╗ë ngã░ß╗Øi ACTIVE cß╗ºa vai tr├▓ ─æ├│; "─É├ú ngã░ng" l├á
   membership INACTIVE. Mß╗ùi ngã░ß╗Øi chß╗ë thuß╗Öc mß╗Öt trong c├íc nh├│m Owner, Quß║ún l├¢,
   Kß╗╣ thuß║¡t vi├¬n, ─É├ú ngã░ng. Manager kh├┤ng c├│ tab ─É├ú ngã░ng n├¬n kh├┤ng nhß║¡n sß╗æ n├áy.
4. Ng├áy tham gia l├á cß╗Öt `joined_at` mß╗øi (SRS Part I ┬º3.2 "joined time"), ghi mß╗Öt
   lß║ºn khi tß║ío membership (─æ─âng k├¢ trß║íi cho Owner, chß║Ñp nhß║¡n lß╗Øi mß╗Øi); ─æß╗òi vai tr├▓,
   ngã░ng, k├¡ch hoß║ít lß║íi kh├┤ng ─æß╗òi. Dß╗» liß╗çu c┼® lß║Ñy tß╗½ audit `MEMBER_ACCEPT`, rß╗ôi
   `FARM_REGISTER` (Owner), rß╗ôi `accepted_at` cß╗ºa lß╗Øi mß╗Øi c├╣ng email, cuß╗æi c├╣ng
   `effective_date`. SCR-13 hiß╗çn mm/yyyy theo m├║i giß╗Ø trß║íi.
5. A1 trß║ú cß║ú danh s├ích cß╗ºa trß║íi (trß║íi nhß╗Å; FE-08 chß╗ìn ngã░ß╗Øi c├ón v├á popup Mß╗Øi khi
   gß║Àp MSG-FE03-21 cß║ºn cß║ú danh s├ích) dß║íng `{farmName, timeZone, serviceStatus,
   counts{all, managers, technicians, inactive?}, items}`; mß╗ùi d├▓ng `{id, userId,
   fullName, email, role, status, joinedAt, version, actions[]}`. Bß╗Å `reason` v├á
   `effectiveDate` cß╗ºa lß║ºn ─æß╗òi gß║ºn nhß║Ñt (SCR-13 kh├┤ng c├│; Manager kh├┤ng ─æã░ß╗úc thß║Ñy
   ghi ch├║ cß╗ºa Owner). Giß╗» t├¬n `id`/`userId` nhã░ code, spec A1 sß╗¡a theo. Thß╗® tß╗▒
   mß║Àc ─æß╗ïnh theo t├¬n tiß║┐ng Viß╗çt AÔåÆZ, kh├┤ng ph├ón biß╗çt hoa thã░ß╗Øng; chã░a c├│ t├¬n th├¼
   theo email; bß║▒ng nhau theo id; bß║Ñm cß╗Öt ─æß╗â ─æß║úo; kh├┤ng ghim Owner. Frontend chia
   20 d├▓ng/trang v├á nhß╗ø tab/chiß╗üu sß║»p xß║┐p theo t├ái khoß║ún + trß║íi trong phi├¬n.
6. Bß║úng "Quyß╗ün theo vai tr├▓" theo ─æ├║ng Table III-2: 17 nh├│m ├ù 3 vai tr├▓, nß╗Öi dung
   ├┤ lß║Ñy tß╗½ SRS. Bß║úng d├╣ng chung n├¬n popup Mß╗Øi v├á dß╗» liß╗çu m├┤ phß╗Ång cß╗ºa SCR-08 ─æß╗òi
   theo; mß╗®c FULL/RESTRICTED/NO khß╗øp backend SCR-08 (`AccountResource`). T├│m tß║»t 3
   d├▓ng ß╗ƒ SCR-15 giß╗» nguy├¬n.

─Éi k├¿m, kh├┤ng cß║ºn quyß║┐t ri├¬ng: Technician bß╗ï chß║Àn ß╗ƒ A1 (trã░ß╗øc ─æ├óy lß╗ìt qua quyß╗ün
`VIEW_CATALOGUES`); Manager mß╗ƒ ─æã░ß╗úc SCR-13 (trã░ß╗øc ─æ├óy trang gß╗ìi API chi tiß║┐t trß║íi
chß╗ë d├ánh cho Owner); nh├ún "─É├ú ngã░ng" / "Ngã░ng" theo spec; tß║úi lß║íi khi v├áo m├án,
sau thao t├íc v├á n├║t L├ám mß╗øi, kh├┤ng polling. Kiß╗âm thß╗¡ v├á giß╗øi hß║ín ghi tß║íi
`docs/reviews/FE03_UC05_REVIEW.md`; quyß║┐t ─æß╗ïnh chã░a phß║úi READY_FOR_FE.

### D30 ÔÇö UC-FE03-06: ─æß╗òi vai tr├▓ / ngã░ng / k├¡ch hoß║ít lß║íi th├ánh vi├¬n (14/11/2026)

Ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ cß║ú s├íu ─æß╗ü xuß║Ñt trong phi├¬n, sau khi ─æß╗ìc SRS UC-FE03-06 (d├▓ng
1817ÔÇô1830), popup (3115ÔÇô3130), MSG-FE03-11/12/13, Table III-1 v├á ─æß╗æi chiß║┐u code:

1. Phß║ím vi: popup "─Éß╗òi vai tr├▓ / Ngã░ng th├ánh vi├¬n", lß╗çnh A2 v├á tß║úi lß║íi SCR-13, gß╗ôm cß║ú
   lß╗æi K├¡ch hoß║ít lß║íi tß╗½ popup Mß╗Øi (MSG-FE03-21, D25). Giß╗» t├¬n trã░ß╗Øng `role` nhã░ code;
   spec A2 sß╗¡a theo (trã░ß╗øc ghi `newRole`).
2. Lß╗ïch sß╗¡ lã░u ß╗ƒ bß║úng mß╗øi `farm_membership_change`, chß╗ë th├¬m: h├ánh ─æß╗Öng, vai tr├▓ v├á
   trß║íng th├íi c┼®/mß╗øi, ng├áy hiß╗çu lß╗▒c, l├¢ do, ngã░ß╗Øi l├ám, thß╗Øi ─æiß╗âm; c├╣ng transaction vß╗øi
   membership v├á audit. Audit ghi gi├í trß╗ï trã░ß╗øc/sau (GBR-86), kh├┤ng ghi l├¢ do.
3. Ng├áy hiß╗çu lß╗▒c chß╗ë ─æß╗â ghi lß╗ïch sß╗¡ (chß╗æt FE-03 Q3): quyß╗ün ─æß╗òi tß╗½ request kß║┐ tiß║┐p cß╗ºa
   th├ánh vi├¬n kß╗â cß║ú khi chß╗ìn ng├áy trong qu├í khß╗®; chß╗ë chß║Àn ng├áy tã░ãíng lai, "h├┤m nay" theo
   m├║i giß╗Ø trß║íi.
4. L├¢ do bß╗Å khoß║úng trß║»ng ─æß║ºu cuß╗æi, 5ÔÇô500 k├¢ tß╗▒, ├¡t nhß║Ñt 5 k├¢ tß╗▒ kh├┤ng phß║úi khoß║úng trß║»ng
   (Table III-1 d├▓ng 2789 + popup); ngß║»n hãín hoß║Àc d├ái hãín ÔåÆ MSG-COM-10, trß╗æng ÔåÆ MSG-COM-06.
5. X├íc nhß║¡n ngay trong popup [Quay lß║íi] [X├íc nhß║¡n]: MSG-FE03-11 (ngã░ng), MSG-FE03-12
   (─æß╗òi vai tr├▓) v├á c├óu ri├¬ng cho k├¡ch hoß║ít lß║íi (SRS kh├┤ng c├│ m├ú): "K├¡ch hoß║ít lß║íi
   {member} vß╗øi vai tr├▓ {role}? Ngã░ß╗Øi n├áy v├áo lß║íi {farm} tß╗½ thao t├íc kß║┐ tiß║┐p." Th├ánh
   c├┤ng MSG-FE03-13. Hß╗ºy khi ─æ├ú nhß║¡p ÔåÆ MSG-COM-14.
6. Thß╗® tß╗▒ kiß╗âm sau khi kh├│a d├▓ng membership: COM-01 (kh├┤ng phß║úi Owner) ÔåÆ COM-08
   (membership kh├┤ng thuß╗Öc trß║íi) ÔåÆ COM-01 (─æ├¡ch l├á Owner) ÔåÆ dß╗» liß╗çu COM-06/07/10 ÔåÆ
   ─æß╗òi vai tr├▓ ngã░ß╗Øi INACTIVE (COM-10, `field=action`) ÔåÆ FE03-04 (trß║íi kh├┤ng ACTIVE, chß╗ë
   ─æß╗òi vai tr├▓ / k├¡ch hoß║ít lß║íi) ÔåÆ FE03-20 (─æ├ú ─æ├║ng, kß╗â cß║ú version c┼®) ÔåÆ COM-05. Lß╗çnh bß╗ï
   tß╗½ chß╗æi kh├┤ng ghi g├¼. Frontend: FE03-20 / FE03-04 / COM-05 / COM-08 hiß╗çn l├¢ do, ─æ├│ng
   popup, tß║úi lß║íi danh s├ích, kh├┤ng tß╗▒ thß╗¡ lß║íi bß║▒ng version mß╗øi; lß╗ùi lã░u / mß║íng giß╗» popup
   v├á c├╣ng Idempotency-Key.

─É├ú c├│ sß║Án, chß╗ë th├¬m test: quyß╗ün mß╗øi ├íp dß╗Ñng tß╗½ request kß║┐ tiß║┐p (GBR-09); bß║ún ghi giß╗» t├íc
giß║ú; th├┤ng b├ío nh├íp cß╗ºa Manager bß╗ï ngã░ng vß║½n ri├¬ng tã░ v├á kh├┤ng sß╗¡a ─æã░ß╗úc (AF2). Ghi nhß║¡n,
kh├┤ng l├ám trong UC6: th├ánh vi├¬n vß╗½a bß╗ï ngã░ng ─æang mß╗ƒ trang sß║¢ nhß║¡n MSG-COM-01 ß╗ƒ thao t├íc
kß║┐ tiß║┐p, chã░a tß╗▒ chuyß╗ân vß╗ü SCR-09 (SRS kh├┤ng quy ─æß╗ïnh). Kiß╗âm thß╗¡ v├á giß╗øi hß║ín ghi tß║íi
`docs/reviews/FE03_UC06_REVIEW.md`; quyß║┐t ─æß╗ïnh chã░a phß║úi READY_FOR_FE.

### D31 ÔÇö UC-FE03-07: xem t├ái khoß║ún ngã░ß╗Øi d├╣ng (14/11/2026)

Ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ cß║ú t├ím ─æß╗ü xuß║Ñt trong phi├¬n, sau khi ─æß╗ìc SRS SCR-16 (d├▓ng 3150ÔÇô3177), danh
s├ích UC (1114), ma trß║¡n quyß╗ün (1375), User Account (461ÔÇô468), UC-FE03-09 PRE-2 (1858),
GBR-10/11, Table III-1 (2789ÔÇô2794) v├á ─æß╗æi chiß║┐u code. Chß╗æt phß║ºn UC7 cß╗ºa FE-03 Q2:

1. Phß║ím vi: A9, A10 v├á SCR-16 (t├¼m, lß╗ìc, sß║»p xß║┐p, ph├ón trang, khung chi tiß║┐t, tß║úi / rß╗ùng /
   lß╗ùi), nß╗æi chß║┐ ─æß╗Ö backend cho danh s├ích v├á chi tiß║┐t. N├║t Tß║ím ngã░ng / Kh├┤i phß╗Ñc (UC8), Quyß╗ün
   nß╗ün tß║úng (UC9) v├á lß╗ïch sß╗¡ A11 giß╗» nhã░ c┼®, kh├┤ng ─æã░ß╗úc chß╗®ng nhß║¡n ß╗ƒ UC7; ß╗ƒ chß║┐ ─æß╗Ö backend
   ch├║ng vß║½n b├ío "chã░a t├¡ch hß╗úp". FE-03 Q4, Q5 ─æß╗â sang UC8 / UC9.
2. Danh s├ích gß╗ôm cß║ú t├ái khoß║ún ─æ─âng k├¢ mß║¡t khß║®u chã░a x├íc minh email, hiß╗çn "Chã░a x├íc minh". SRS
   tß╗▒ m├óu thuß║½n: d├▓ng 467 n├│i t├ái khoß║ún chß╗ë ─æã░ß╗úc tß║ío khi ─æ├ú x├íc minh, c├▓n d├▓ng 1858 v├á 3168
   ngß║ºm c├│ t├ái khoß║ún chã░a x├íc minh; code tß║ío `app_user` ngay khi ─æ─âng k├¢. ─É├ú x├íc minh = c├│
   Google subject hoß║Àc identity `jhi_user` c├╣ng email ─æ├ú k├¡ch hoß║ít (nhã░ SCR-08).
3. T├¼m kiß║┐m chß╗ë theo t├¬n hoß║Àc email (bß╗Å S─ÉT): bß╗Å khoß║úng trß║»ng ─æß║ºu cuß╗æi, kh├┤ng ph├ón biß╗çt hoa
   thã░ß╗Øng, giß╗» dß║Ñu, t├¼m chß╗®a chuß╗ùi; `%` v├á `_` l├á k├¢ tß╗▒ thã░ß╗Øng; tß╗æi ─æa 100 k├¢ tß╗▒ (short text,
   Table III-1).
4. Lß╗ìc CS / PM / SA theo vai tr├▓ platform ─æang ACTIVE; "Kh├┤ng c├│" (`NONE`) gß╗ôm ngã░ß╗Øi chã░a c├│
   vai tr├▓ v├á ngã░ß╗Øi bß╗ï thu hß╗ôi. API vß║½n trß║ú vai tr├▓ ─æang lã░u k├¿m `platformAccessStatus`; cß╗Öt
   hiß╗çn "Kh├┤ng c├│" k├¿m ch├║ th├¡ch "CS ─æ├ú thu hß╗ôi". Tham sß╗æ sai (`status`, `platformRole`,
   `page`, `size`, `sort`, `dir`, `q` qu├í d├ái, sai kiß╗âu) ÔåÆ 400 MSG-COM-10 k├¿m `params.field`.
5. Sß║»p xß║┐p theo t├¬n tiß║┐ng Viß╗çt AÔåÆZ (collation ICU `vi-x-icu` c├│ sß║Án trong PostgreSQL 16.15;
   chã░a c├│ t├¬n th├¼ theo email), rß╗ôi email, rß╗ôi id; `dir=desc` ─æß║úo cß║ú ba. Backend ph├ón trang 20
   d├▓ng (`page` tß╗½ 0, `size` 1ÔÇô100). ─Éß╗òi bß╗Ö lß╗ìc hoß║Àc chiß╗üu sß║»p xß║┐p vß╗ü trang 1; ├┤ t├¼m, bß╗Ö lß╗ìc
   v├á chiß╗üu sß║»p xß║┐p ─æã░ß╗úc giß╗» trong phi├¬n theo t├ái khoß║ún SA.
6. "Trß║íi tham gia" chß╗ë ─æß║┐m membership ACTIVE, kh├┤ng x├®t trß║íng th├íi dß╗ïch vß╗Ñ; vai tr├▓ theo thß╗® tß╗▒
   Chß╗º trß║íi ÔåÆ Quß║ún l├¢ ÔåÆ Kß╗╣ thuß║¡t vi├¬n, v├¡ dß╗Ñ "3 (Chß╗º trß║íi, Quß║ún l├¢)"; kh├┤ng c├│ trß║íi ÔåÆ "0".
7. A10: cß╗Öt mß╗øi `app_user.created_at` (Part I ┬º3.2 "created time", migration
   `20261114000300`; dß╗» liß╗çu c┼® lß║Ñy tß╗½ `jhi_user.created_date`, rß╗ôi thß╗Øi ─æiß╗âm li├¬n kß║┐t c├ích
   ─æ─âng nhß║¡p sß╗øm nhß║Ñt, rß╗ôi l├║c chß║Ñp nhß║¡n ─æiß╗üu khoß║ún, cuß╗æi c├╣ng l├║c n├óng cß║Ñp). ─É─âng nhß║¡p cuß╗æi l├á
   gi├í trß╗ï mß╗øi hãín giß╗»a `password_last_used_at` v├á `google_last_used_at`. Th├¬m `signInMethods`,
   ─æ─âng k├¢ Chß╗º trß║íi k├¿m thß╗Øi ─æiß╗âm, t├¬n c├íc trß║íi sß╗ƒ hß╗»u, vai tr├▓ / trß║íng th├íi / version quyß╗ün
   platform. Bß╗Å `phone` khß╗Åi mß╗ìi phß║ún hß╗ôi t├ái khoß║ún (cß║ú tß║ím ngã░ng, kh├┤i phß╗Ñc, quyß╗ün platform).
   Frontend ─æß╗ìc chi tiß║┐t bß║▒ng A10 theo id tr├¬n URL; id kh├┤ng tß╗ôn tß║íi ÔåÆ 404 MSG-COM-08.
8. Ng├áy giß╗Ø SCR-16 hiß╗çn dd/mm/yyyy HH:mm theo Asia/Ho_Chi_Minh (Table III-1 d├▓ng 2790).

─Éi k├¿m, kh├┤ng cß║ºn quyß║┐t ri├¬ng: nh├ún "Tß║ím kh├│a / Mß╗ƒ kh├│a" ─æß╗òi th├ánh "Tß║ím ngã░ng / Kh├┤i phß╗Ñc"
tr├¬n SCR-16 v├á hß╗Öp thoß║íi UC8; bß╗Å N+1 (fetch join quyß╗ün platform, ─æß║┐m membership v├á kiß╗âm x├íc
minh theo cß║ú trang); lß╗ùi DB khi GET ÔåÆ MSG-COM-03. Kiß╗âm thß╗¡ v├á giß╗øi hß║ín ghi tß║íi
`docs/reviews/FE03_UC07_REVIEW.md`; quyß║┐t ─æß╗ïnh chã░a phß║úi READY_FOR_FE.

### D32 ÔÇö UC-FE03-08: tß║ím ngã░ng / kh├┤i phß╗Ñc t├ái khoß║ún (14/11/2026)

Ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ cß║ú bß║úy ─æß╗ü xuß║Ñt trong phi├¬n ("theo ─æß╗ü xuß║Ñt"), sau khi ─æß╗ìc SRS UC-FE03-08 (d├▓ng
1833ÔÇô1850), SCR-16 (3154ÔÇô3174), ma trß║¡n quyß╗ün (1376, ch├║ th├¡ch 1440), User Account (461ÔÇô468),
Table III-1 (2789, 2794, 2795), GBR-04 (5771), GBR-10 (5777), GBR-77 (5872), BR-D06 (934),
MSG-FE03-14 ÔåÆ 20 (5981ÔÇô5987), SCR-67 "Needs attention" (5061) v├á ─æß╗æi chiß║┐u code:

1. Tß║ím ngã░ng chß╗ë chß║Àn ─æ─âng nhß║¡p (mß╗ìi c├ích, phi├¬n ─æang mß╗ƒ bß╗ï tß╗½ chß╗æi ß╗ƒ request kß║┐ tiß║┐p); kh├┤ng thu
   hß╗ôi vai tr├▓ platform hay membership. Kh├┤i phß╗Ñc ─æã░a t├ái khoß║ún vß╗ü ACTIVE; vai tr├▓ / membership ─æ├ú
   bß╗ï thu hß╗ôi hoß║Àc ngã░ng ri├¬ng vß║½n giß╗» nguy├¬n (MSG-FE03-15, POST-2). CS bß╗ï tß║ím ngã░ng vß║½n c├│ vai tr├▓
   CS ACTIVE trong DB nhã░ng kh├┤ng c├▓n "khß║ú dß╗Ñng"; SA bß╗ï tß║ím ngã░ng kh├┤ng ─æã░ß╗úc t├¡nh l├á SA ACTIVE.
2. Lß╗ïch sß╗¡ ß╗ƒ bß║úng mß╗øi `app_user_status_change` (Liquibase `20261114000400`), chß╗ë th├¬m: h├ánh ─æß╗Öng
   (SUSPEND / RESTORE), trß║íng th├íi trã░ß╗øc / sau, l├¢ do, SA thß╗▒c hiß╗çn, thß╗Øi ─æiß╗âm; c├╣ng transaction vß╗øi
   t├ái khoß║ún v├á audit. Audit `ACCOUNT_SUSPEND` / `ACCOUNT_RESTORE` ghi trã░ß╗øc / sau, kh├┤ng ghi l├¢ do
   (nhã░ D30). SCR-16 kh├┤ng c├│ trã░ß╗Øng lß╗ïch sß╗¡ n├¬n UC8 kh├┤ng th├¬m UI; A11 ─æß╗â sang UC9.
3. L├¢ do bß╗Å khoß║úng trß║»ng ─æß║ºu cuß╗æi, 5ÔÇô500 k├¢ tß╗▒, ├¡t nhß║Ñt 5 k├¢ tß╗▒ kh├┤ng phß║úi khoß║úng trß║»ng (Table III-1
   d├▓ng 2789 + SCR-16 d├▓ng 3171): trß╗æng ÔåÆ MSG-COM-06, ngo├ái khoß║úng ÔåÆ MSG-COM-10 (`field=reason`).
4. Tß║ím ngã░ng v├á kh├┤i phß╗Ñc ─æã░ß╗úc cß║ú t├ái khoß║ún chã░a x├íc minh email (D31 cho hiß╗çn loß║íi n├áy); bß╗Å lß╗ùi
   MSG-FE03-18 cß╗ºa lß╗çnh kh├┤i phß╗Ñc (th├┤ng b├ío ─æ├│ thuß╗Öc UC9).
5. Phiß║┐u hß╗ù trß╗ú chã░a CLOSED cß╗ºa CS bß╗ï tß║ím ngã░ng vß╗ü h├áng ─æß╗úi chã░a giao ngay trong transaction tß║ím
   ngã░ng (giß╗» trß║íng th├íi, lß╗ïch sß╗¡ `AUTO_REQUEUE`, th├┤ng b├ío CS khß║ú dß╗Ñng); job 60 gi├óy giß╗» l├ám lã░ß╗øi an
   to├án (bã░ß╗øc 6 d├▓ng 1842, GBR-77).
6. "─É├ính dß║Ñu cß║ºn giao lß║íi" y├¬u cß║ºu nß╗Öi bß╗Ö OPEN ─æã░ß╗úc t├¡nh l├║c ─æß╗ìc: `InternalView.needsReassignment`
   = OPEN v├á ngã░ß╗Øi nhß║¡n kh├┤ng c├▓n khß║ú dß╗Ñng (t├ái khoß║ún bß╗ï tß║ím ngã░ng hoß║Àc mß║Ñt vai tr├▓); SCR-68 hiß╗çn
   "Ngã░ß╗Øi nhß║¡n kh├┤ng c├▓n khß║ú dß╗Ñng ÔÇô cß║ºn ─æß╗òi ngã░ß╗Øi nhß║¡n". Kh├┤ng th├¬m cß╗Öt; tß╗▒ hß║┐t khi kh├┤i phß╗Ñc; UC9
   d├╣ng lß║íi. M├án cß╗ºa ch├¡nh ngã░ß╗Øi nhß║¡n (SCR-69) lu├┤n `false`.
7. A10 trß║ú `actions[]` do backend t├¡nh: `SUSPEND` cho t├ái khoß║ún ACTIVE kh├┤ng phß║úi cß╗ºa SA ─æang xem,
   `RESTORE` cho t├ái khoß║ún SUSPENDED. Frontend chß╗ë hiß╗çn ├┤ l├¢ do v├á n├║t theo `actions`; t├ái khoß║ún cß╗ºa
   ch├¡nh SA hiß╗çn "Bß║ín kh├┤ng thß╗â tß║ím ngã░ng t├ái khoß║ún cß╗ºa ch├¡nh m├¼nh." Backend vß║½n kiß╗âm FE03-17 khi lã░u.

─Éi k├¿m, kh├┤ng cß║ºn quyß║┐t ri├¬ng: thß╗® tß╗▒ kiß╗âm sau khi kh├│a d├▓ng COM-01 ÔåÆ COM-08 (404) ÔåÆ dß╗» liß╗çu
(COM-06 / COM-10; thiß║┐u `reason` / `version` / `Idempotency-Key` bß╗ï chß║Àn ß╗ƒ tß║ºng HTTP vß╗øi `field`) ÔåÆ
FE03-17 (tß╗▒ tß║ím ngã░ng) ÔåÆ FE03-20 (`{target: email, value: status}`, kß╗â cß║ú version c┼®) ÔåÆ COM-05 ÔåÆ
FE03-17 (SA cuß╗æi c├╣ng); FE03-17 l├á 409 cho cß║ú hai trã░ß╗Øng hß╗úp; lß╗çnh bß╗ï tß╗½ chß╗æi kh├┤ng ghi g├¼.
`Idempotency-Key` bß║»t buß╗Öc (c├╣ng key + dß╗» liß╗çu trß║ú kß║┐t quß║ú ─æß║ºu, kh├íc dß╗» liß╗çu ÔåÆ COM-19). Sß╗¡a race SA
cuß╗æi c├╣ng: lß╗çnh tß║ím ngã░ng kh├│a cß║ú d├▓ng t├ái khoß║ún cß╗ºa SA ─æang thao t├íc (kh├│a d├▓ng, kh├┤ng nß║íp entity)
theo thß╗® tß╗▒ id, ─æß╗ìc lß║íi tß╗½ DB rß║▒ng SA ─æ├│ c├▓n ACTIVE (kh├┤ng ÔåÆ COM-01) v├á c├▓n SA ACTIVE kh├íc; ─æß║┐m SA
bß║▒ng truy vß║Ñn ─æß╗ìc DB, d├╣ng chung cho thu hß╗ôi quyß╗ün ß╗ƒ UC9 (kh├│a d├▓ng SA ─æang thao t├íc cho UC9 l├ám khi
l├ám UC9). Frontend: MSG-FE03-14 / 15 / 16 / 17 theo spec; lß╗ùi FE03-17 / FE03-20 / COM-05 / COM-08
─æ├│ng hß╗Öp thoß║íi, hiß╗çn l├¢ do tr├¬n khung chi tiß║┐t, tß║úi lß║íi A9 + A10, giß╗» l├¢ do ─æ├ú nhß║¡p; lß╗ùi lã░u / mß║íng
giß╗» hß╗Öp thoß║íi v├á c├╣ng kh├│a. Runtime t├¼m ra lß╗ùi c├│ tß╗½ trã░ß╗øc: hß║┐t hß║ín phi├¬n d├╣ng `Set.of(login, email)`
n├¬n t├ái khoß║ún c├│ login tr├╣ng email (mß╗ìi t├ái khoß║ún thß║¡t) l├ám lß╗çnh tß║ím ngã░ng trß║ú 500; ─æ├ú sß╗¡a, c├│ test
hß╗ôi quy. Phi├¬n ─æ├ú ─æ─âng k├¢ bß╗ï hß║┐t hß║ín khi tß║ím ngã░ng n├¬n request kß║┐ tiß║┐p l├á 401, ─æ─âng nhß║¡p lß║íi l├á
MSG-FE01-03. Kiß╗âm thß╗¡ v├á giß╗øi hß║ín ghi tß║íi `docs/reviews/FE03_UC08_REVIEW.md`; quyß║┐t ─æß╗ïnh chã░a phß║úi
READY_FOR_FE.

### D33 ÔÇö UC-FE03-09: quyß╗ün nh├ón vi├¬n nß╗ün tß║úng (14/11/2026)

Ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ cß║ú s├íu ─æß╗ü xuß║Ñt trong phi├¬n ("thß╗▒c hiß╗çn theo ─æß╗ü xuß║Ñt"), sau khi ─æß╗ìc SRS UC-FE03-09
(d├▓ng 1852ÔÇô1869), popup "Platform Staff Access" (3179ÔÇô3190), thß╗▒c thß╗â CS / PM / SA (497ÔÇô517), GBR-10
(5777), GBR-11 (5778), BR-D06 (934), ma trß║¡n quyß╗ün (1377, ch├║ th├¡ch 1440), SCR-16 (1514),
MSG-FE03-17 ÔåÆ 20 (5984ÔÇô5987) v├á ─æß╗æi chiß║┐u code. Chß╗æt FE-03 Q4 (phß║ºn quyß╗ün nß╗ün tß║úng) v├á Q5:

1. (FE-03 Q5) Theo SRS: bß╗Å mß╗Ñc sidebar v├á trang "Quyß╗ün nh├ón sß╗▒ nß╗ün tß║úng" (`/nen-tang/quyen`) l├ám theo
   Figma; n├║t "Quyß╗ün nß╗ün tß║úng" mß╗ƒ popup ngay tr├¬n SCR-16 (`/nen-tang/tai-khoan/{id}?m=access`); link c┼®
   `/nen-tang/quyen/{id}` chuyß╗ân sang ─æ├│, `/nen-tang/quyen` vß╗ü SCR-16. Danh s├ích nh├ón sß╗▒ = bß╗Ö lß╗ìc vai tr├▓
   CS / PM / SA cß╗ºa SCR-16.
2. Lß╗ïch sß╗¡ ß╗ƒ bß║úng mß╗øi `platform_access_change` (Liquibase `20261114000500`), chß╗ë th├¬m: h├ánh ─æß╗Öng, vai
   tr├▓ v├á trß║íng th├íi trã░ß╗øc / sau, l├¢ do, SA thß╗▒c hiß╗çn, thß╗Øi ─æiß╗âm; c├╣ng transaction vß╗øi quyß╗ün v├á audit.
   Audit `PLATFORM_ACCESS_*` chß╗ë ghi trã░ß╗øc / sau (bß╗Å l├¢ do, nhã░ D30 / D32). A11 ─æß╗ìc bß║úng n├áy, trß║ú
   `[{id, action, roleBefore, statusBefore, roleAfter, statusAfter, reason, byName, byEmail, at}]`, mß╗øi nhß║Ñt
   trã░ß╗øc, tß╗æi ─æa 100 d├▓ng; chß╗ë lß╗ïch sß╗¡ vai tr├▓. Khi n├óng cß║Ñp (PostgreSQL), c├íc mß╗Ñc audit
   `PLATFORM_ACCESS_*` c┼® ─æã░ß╗úc ch├®p sang (NONE ÔåÆ null, thiß║┐u l├¢ do ÔåÆ "(kh├┤ng ghi l├¢ do)"); audit giß╗»
   nguy├¬n.
3. (FE-03 Q4) T├ái khoß║ún ─æang SUSPENDED: chß║Àn Cß║Ñp / ─Éß╗òi / Kh├┤i phß╗Ñc bß║▒ng m├ú mß╗øi **MSG-FE03-22** "T├ái khoß║ún
   {email} ─æang tß║ím ngã░ng. H├úy kh├┤i phß╗Ñc t├ái khoß║ún trã░ß╗øc khi cß║Ñp, ─æß╗òi hoß║Àc kh├┤i phß╗Ñc quyß╗ün."; vß║½n cho
   Thu hß╗ôi.
4. SA kh├┤ng ─æß╗òi / thu hß╗ôi quyß╗ün cß╗ºa ch├¡nh m├¼nh (SRS d├▓ng 517: thu hß╗ôi "by another System Admin"): popup
   tr├¬n t├ái khoß║ún cß╗ºa ch├¡nh m├¼nh chß╗ë xem lß╗ïch sß╗¡; backend trß║ú MSG-COM-01.
5. Lß╗çnh kh├┤ng khß╗øp trß║íng th├íi: gi├í trß╗ï y├¬u cß║ºu ─æ├ú c├│ hiß╗çu lß╗▒c (Cß║Ñp / ─Éß╗òi sang ─æ├║ng vai tr├▓ ─æang ACTIVE,
   Thu hß╗ôi khi ─æ├ú REVOKED, Kh├┤i phß╗Ñc khi ─æ├ú ACTIVE) ÔåÆ MSG-FE03-20 `{target: email, value: role|status}`;
   c├▓n lß║íi (Cß║Ñp khi ─æ├ú c├│ quyß╗ün kh├íc, ─Éß╗òi / Thu hß╗ôi khi kh├┤ng c├│ vai tr├▓ ACTIVE, Kh├┤i phß╗Ñc khi chã░a c├│
   quyß╗ün) ÔåÆ MSG-COM-05. Kh├┤ng bao giß╗Ø tß║ío vai tr├▓ ACTIVE thß╗® hai (TC-03-29).
6. A10 trß║ú `accessActions[]` do backend t├¡nh: theo quyß╗ün ─æang lã░u GRANT / CHANGE + REVOKE / RESTORE; t├ái
   khoß║ún bß╗ï tß║ím ngã░ng hoß║Àc chã░a x├íc minh chß╗ë c├▓n REVOKE (nß║┐u c├│ vai tr├▓ ACTIVE); t├ái khoß║ún cß╗ºa ch├¡nh SA
   rß╗ùng. Frontend chß╗ë hiß╗çn h├ánh ─æß╗Öng c├│ trong danh s├ích; rß╗ùng th├¼ popup hiß╗çn l├¢ do v├á lß╗ïch sß╗¡.

─Éi k├¿m, kh├┤ng cß║ºn quyß║┐t ri├¬ng (theo D32): `Idempotency-Key` bß║»t buß╗Öc; l├¢ do 5ÔÇô500 k├¢ tß╗▒; thß╗® tß╗▒ kiß╗âm sau
khi kh├│a d├▓ng (cß║ú d├▓ng cß╗ºa SA ─æang thao t├íc, theo thß╗® tß╗▒ id) COM-01 ÔåÆ COM-08 ÔåÆ dß╗» liß╗çu (`operation`,
`role`, `reason`) ÔåÆ cß╗ºa ch├¡nh m├¼nh (COM-01) ÔåÆ tß║ím ngã░ng (FE03-22) ÔåÆ chã░a x├íc minh (FE03-18) ÔåÆ trß║íng th├íi
(FE03-20 / COM-05) ÔåÆ version (COM-05) ÔåÆ SA ─æang thao t├íc c├▓n ACTIVE (COM-01) ÔåÆ SA cuß╗æi c├╣ng (FE03-17);
lß╗çnh bß╗ï tß╗½ chß╗æi kh├┤ng ghi g├¼. CS mß║Ñt quyß╗ün (thu hß╗ôi, hoß║Àc ─æß╗òi sang PM / SA) ÔåÆ phiß║┐u chã░a CLOSED vß╗ü h├áng
─æß╗úi trong c├╣ng lß╗çnh (lß╗ïch sß╗¡ `AUTO_REQUEUE` cause `CS_ACCESS_REMOVED`); PM / SA mß║Ñt quyß╗ün ÔåÆ y├¬u cß║ºu nß╗Öi bß╗Ö
OPEN tß╗▒ c├│ `needsReassignment=true` (D32). Frontend: popup "Quyß╗ün nh├ón vi├¬n nß╗ün tß║úng", l├¢ do l├á ├┤ chß╗» d├ái,
ghi ch├║ SA cuß╗æi c├╣ng cß╗æ ─æß╗ïnh, MSG-FE03-18 / 19 / 22 theo spec, hß╗ºy khi ─æ├ú nhß║¡p hß╗Åi lß║íi (MSG-COM-14), lß╗ùi
nghiß╗çp vß╗Ñ ─æ├│ng popup v├á tß║úi lß║íi, lß╗ùi lã░u / mß║íng giß╗» popup v├á c├╣ng kh├│a. Kiß╗âm thß╗¡ v├á giß╗øi hß║ín ghi tß║íi
`docs/reviews/FE03_UC09_REVIEW.md`; quyß║┐t ─æß╗ïnh chã░a phß║úi READY_FOR_FE.

### D34 ÔÇö UC-FE17-01: lß╗ïch sß╗¡ audit nß╗ün tß║úng (15/11/2026)

Ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ to├án bß╗Ö ─æß╗ü xuß║Ñt K1ÔÇôK12 trong phi├¬n ("theo ─æß╗ü xuß║Ñt"), sau khi ─æß╗ìc spec FE-17, SRS ┬º3.2 J
Audit Log Entry (d├▓ng 870ÔÇô876), SCR-51 (4647ÔÇô4667), GBR-86 (5885), GBR-88 (5887), NFR-S11 / NFR-R01 (5748,
5755), bß║úng MSG-COM (5925ÔÇô5935), c├íc UC c├│ ghi audit (FE-02 1715, FE-06 1953 / 1989, FE-13 2373 / 2391, FE-19
2465 / 2483, FE-23 2720, JOB 5574) v├á ─æß╗æi chiß║┐u code. Chß╗æt FE-17 Q1ÔÇôQ5:

1. (K1, Q5) Mß╗Öt bß║úng `audit_log`. SCR-51 chß╗ë hiß╗çn c├íc m├ú trong **danh mß╗Ñc audit trung t├óm**
   (`PlatformAuditCatalog`) theo 6 nh├│m cß╗ºa GBR-86; audit cß╗ºa dß╗» liß╗çu trß║íi (b├▓, ch─âm s├│c, l├óm s├áng, phiß║┐u,
   thß╗®c ─ân, danh mß╗ÑcÔÇª) vß║½n ghi v├á vß║½n phß╗Ñc vß╗Ñ lß╗ïch sß╗¡ trong trß║íi nhã░ng SA kh├┤ng thß║Ñy; A2 cß╗ºa mß╗Ñc ngo├ái danh
   mß╗Ñc trß║ú 404 MSG-COM-08 nhã░ mß╗Ñc kh├┤ng tß╗ôn tß║íi.
2. (K2) Kh├┤ng ─æß╗òi m├ú ─æ├ú lã░u (c├íc nãíi kh├íc ─æß╗ìc lß║íi). Danh mß╗Ñc ├ính xß║í m├ú lã░u ÔåÆ m├ú c├┤ng khai dß║íng SRS; API trß║ú
   v├á nhß║¡n m├ú c├┤ng khai.
3. (K3, Q2) Danh mß╗Ñc 30 m├ú / 8 loß║íi ─æ├¡ch cß╗ºa SCR-51: ACCOUNT_SUSPENDED / RESTORED; PLATFORM_ACCESS_GRANTED /
   CHANGED / REVOKED / RESTORED; MEMBERSHIP_JOINED / ROLE_CHANGED / DEACTIVATED / REACTIVATED;
   FARM_REGISTERED, FARM_SERVICE_SUSPENDED / RESTORED, FARM_SERVICE_STATUS_CHANGED (JOB-04, "System");
   PAYMENT_CONFIRMED (mß╗ìi `*_PAYMENT_PAID`), EVIDENCE_REVIEWED; FINANCE_RECORD_POSTED / VOIDED; TICKET_CREATED /
   ASSIGNED / HANDED_OVER / RELEASED / WAITING_CUSTOMER / RESOLVED / ACKNOWLEDGED / CLOSED / REOPENED;
   INTERNAL_REQUEST_CREATED / UPDATED / COMPLETED. Kh├┤ng hiß╗çn: lß╗Øi mß╗Øi, y├¬u cß║ºu / hß║┐t hß║ín thanh to├ín, lã░u v├á
   ho├án trß║ú chß╗®ng tß╗½, gi├í g├│i (`PlanVersion` kh├┤ng thuß╗Öc 8 loß║íi ─æ├¡ch), nh├íp v├á b├ío c├ío thu chi, trß║ú lß╗Øi /
   ghi ch├║ / ph├ón loß║íi ticket, sß╗¡a hß╗ô sãí trß║íi. `OWNERSHIP_TRANSFERRED` cß╗ºa spec bß╗Å (SRS kh├┤ng c├│ UC chuyß╗ân chß╗º
   trß║íi); `MEMBERSHIP_REMOVED` ─æß╗òi th├ánh `MEMBERSHIP_DEACTIVATED` theo FE-03.
4. (K4) Cß╗Öt mß╗øi `audit_log.actor_role`: vai tr├▓ l├║c thß╗▒c hiß╗çn. H├ánh ─æß╗Öng nß╗ün tß║úng lß║Ñy vai tr├▓ nh├ón vi├¬n
   ACTIVE (SA / PM / CS), h├ánh ─æß╗Öng trong trß║íi lß║Ñy vai tr├▓ th├ánh vi├¬n ACTIVE (OWNER / MANAGER / TECHNICIAN),
   thiß║┐u b├¬n n├áy th├¼ lß║Ñy b├¬n kia; lß╗çnh c├│ `FarmContext` d├╣ng vai tr├▓ ─æ├ú kiß╗âm. Hß╗ç thß╗æng: rß╗ùng. D├▓ng c┼® ─æß╗â
   trß╗æng ("ÔÇö"), kh├┤ng suy tß╗½ vai tr├▓ hiß╗çn tß║íi.
5. (K5) Cß╗Öt mß╗øi `audit_log.correlation_id`. Filter `CorrelationIdFilter` nhß║¡n `X-Request-Id` cß╗ºa client nß║┐u
   l├á chuß╗ùi 8ÔÇô64 k├¢ tß╗▒ `[A-Za-z0-9._-]`, nß║┐u kh├┤ng th├¼ tß║ío UUID; trß║ú lß║íi trong header `X-Request-Id`, ─æã░a v├áo
   MDC (`[%X{correlationId}]` trong log). Mß╗ùi lã░ß╗út job ─æß╗ïnh kß╗│ c├│ ID ri├¬ng (task decorator cß╗ºa scheduler).
   D├▓ng c┼® ─æß╗â trß╗æng. Liquibase `20261114000600` (2 cß╗Öt + index `logged_at,id` v├á `action,logged_at`).
6. (K6) Mß╗Öt chß╗ù ghi duy nhß║Ñt `AuditService` (MANDATORY transaction; lß║Àp key kh├┤ng ghi th├¬m theo GBR-88): 6
   service nß╗ün tß║úng v├á job (FE-02, FE-03, FE-19, FE-21, SePay, JOB-04) th├┤i tß╗▒ tß║ío `AuditLog`, nß╗Öi dung
   details giß╗» nguy├¬n. Ticket: `SUPPORT_PROCESS` t├ích th├ánh `SUPPORT_<CLAIM|HANDOVER|RELEASE|CLASSIFY|
   ASK_CUSTOMER>`; details ticket c├│ `statusBefore` (khi biß║┐t), `status`, `assignee` (t├¬n CS phß╗Ñ tr├ích). Y├¬u
   cß║ºu nß╗Öi bß╗Ö ghi ─æ├¡ch `InternalRequest` (id cß╗ºa y├¬u cß║ºu) vß╗øi trß║íng th├íi trã░ß╗øc / sau v├á ngã░ß╗Øi nhß║¡n.
7. (K7, R-17-04) Trã░ß╗øc / sau: mß╗ùi m├ú c├│ danh s├ích trã░ß╗Øng ri├¬ng (role, status, assignee, name, decision,
   amountVnd, termYears, periodStart, periodEnd, receiptCode), ─æß╗ìc tß╗½ c├íc dß║íng nguß╗ôn ─æang ghi
   (`xBefore/xAfter`, `fromX/toX`, `before{x}/after{x}`, mß╗Öt gi├í trß╗ï = sau); "NONE" bß╗Å. **Kh├┤ng hiß╗çn l├¢ do**
   (nhã░ D30 / D32 / D33), nß╗Öi dung ticket, chß╗®ng tß╗½ ng├ón h├áng, b├¡ mß║¡t. Kh├┤ng sß╗¡a c├ích ghi cß╗ºa FE nguß╗ôn (SCR-11
   cß╗ºa FE-02 vß║½n ─æß╗ìc l├¢ do tß╗½ audit).
8. (K8, Q1, Q3) A1 `from`, `to` bß║»t buß╗Öc (ng├áy lß╗ïch giß╗Ø Asia/Ho_Chi_Minh, t├¡nh cß║ú hai ─æß║ºu, MSG-COM-06);
   `from` sau `to` ÔåÆ MSG-COM-11; qu├í 12 th├íng (`to` > `from` + 12 th├íng theo `plusMonths`) ÔåÆ MSG-COM-10
   `field=dateRange`. Mß║Àc ─æß╗ïnh 7 ng├áy gß╗ôm h├┤m nay (h├┤m nay ÔêÆ 6 ÔåÆ h├┤m nay). ├ö Ngã░ß╗Øi thß╗▒c hiß╗çn: t├¼m mß╗Öt phß║ºn t├¬n
   hoß║Àc email (kh├┤ng ph├ón biß╗çt hoa thã░ß╗Øng); "Hß╗ç thß╗æng" / "System" ÔåÆ `system=true` (kh├┤ng d├╣ng chung vß╗øi
   `actor`). `dir=desc|asc` (mß║Àc ─æß╗ïnh mß╗øi nhß║Ñt trã░ß╗øc), 20 d├▓ng / trang, tß╗æi ─æa 100. Spec ghi sai m├ú MSG, sß╗¡a
   theo bß║úng MSG-COM cß╗ºa SRS: kh├┤ng phß║úi SA ÔåÆ MSG-COM-01, tß║úi lß╗ùi ÔåÆ MSG-COM-03, kh├┤ng c├│ kß║┐t quß║ú ÔåÆ MSG-COM-04
   [X├│a bß╗Ö lß╗ìc]. M├án h├¼nh c├│ d├▓ng gß╗úi ├¢ cß╗æ ─æß╗ïnh "Tß╗æi ─æa 12 th├íng" v├¼ nß╗Öi dung MSG-COM-10 cß╗æ ─æß╗ïnh.
9. (K9) ─É├¡ch hiß╗çn t├¬n l├║c ─æß╗ìc (gom theo loß║íi, kh├┤ng N+1): t├ái khoß║ún ÔåÆ hß╗ì t├¬n, kh├┤ng c├│ t├¬n th├¼ email che
   (`ng***@domain`); th├ánh vi├¬n ÔåÆ "t├¬n ┬À trß║íi"; trß║íi ÔåÆ t├¬n; thanh to├ín / duyß╗çt chß╗®ng tß╗½ ÔåÆ m├ú thanh to├ín; bß║ún
   ghi thu chi, ticket, y├¬u cß║ºu nß╗Öi bß╗Ö ÔåÆ m├ú. Ngã░ß╗Øi thß╗▒c hiß╗çn: t├¬n (hoß║Àc email che), chß╗» viß║┐t tß║»t, vai tr├▓; danh
   s├ích kh├┤ng hiß╗çn email.
10. (K10) A3 `GET /api/platform/audit/actions` trß║ú `[{code, targetType}]` tß╗½ danh mß╗Ñc; frontend giß╗» nh├ún tiß║┐ng
    Viß╗çt, m├ú lß║í hiß╗çn nguy├¬n m├ú.
11. (K11) Bß╗Å n├║t Xuß║Ñt CSV v├á dropdown ngã░ß╗Øi thß╗▒c hiß╗çn cß╗ºa frontend (SRS kh├┤ng c├│); thay bß║▒ng ├┤ t├¼m theo SRS.
    T├¬n mß╗Ñc menu ─æß╗òi th├ánh "Lß╗ïch sß╗¡ audit" theo t├¬n SCR-51.
12. (K12) Ngo├ái phß║ím vi: ─æß╗òi / ─æß║Àt lß║íi mß║¡t khß║®u (FE-01) chã░a ghi audit, TC-17-06 kiß╗âm bß║▒ng allowlist; job trß║ú
    ticket vß╗ü h├áng ─æß╗úi kh├┤ng ghi audit; mß╗Ñc `SUPPORT_PROCESS` c┼® kh├┤ng hiß╗çn. Ghi ß╗ƒ `MISSING_ROUTES.md`.
    Q4: audit kh├┤ng x├│a, kh├┤ng c├│ job dß╗ìn.

Hß╗úp ─æß╗ông (thay ─æß╗òi ph├í vß╗í, FE chã░a nß╗æi trã░ß╗øc ─æ├óy): A1 `GET /api/platform/audit?from&to&actor|system&action&
targetType&dir&page&size` ÔåÆ `{items[{id, time, actor{id, name, initials, role}|null, action, targetType,
targetLabel}], total, page, size}`; A2 `GET /api/platform/audit/{id}` ÔåÆ `{id, time, actor, farm{id, name}|null,
action, targetType, targetId, targetLabel, before{}, after{}, correlationId}`; A3 nhã░ tr├¬n. Kh├┤ng c├│ route sß╗¡a /
x├│a (405). Kiß╗âm thß╗¡ v├á giß╗øi hß║ín ghi tß║íi `docs/reviews/FE17_UC01_REVIEW.md`; quyß║┐t ─æß╗ïnh chã░a phß║úi
READY_FOR_FE.

### D35 ÔÇö FE-10: popup Cß║¡p nhß║¡t / ─É├│ng ca c├│ ├┤ chß╗ìn diß╗àn biß║┐n; bß║»t buß╗Öc khi lã░u th├ánh lß║ºn theo d├Ái (14/11/2026; m├ú c┼® D30, ─æß╗òi khi gß╗Öp FE-03 / FE-17 v├áo `dev` v├¼ tr├╣ng D30 cß╗ºa UC-FE03-06)

SRS mß╗Ñc 3.2 y├¬u cß║ºu mß╗ùi lß║ºn theo d├Ái c├│ diß╗àn biß║┐n (Tß╗æt hãín / Kh├┤ng ─æß╗òi / Xß║Ñu
hãín), nhã░ng popup Cß║¡p nhß║¡t / ─É├│ng ca (Part III ┬º10) chß╗ë c├│ ├┤ chß╗» "Diß╗àn biß║┐n mß╗øi
nhß║Ñt". Bß║ún trã░ß╗øc cß╗ºa adapter tß╗▒ suy diß╗àn biß║┐n tß╗½ kß║┐t quß║ú (Khß╗Åi ÔåÆ Tß╗æt hãín, Chß║┐t ÔåÆ
Xß║Ñu hãín, c├▓n lß║íi ÔåÆ Kh├┤ng ─æß╗òi), tß╗®c l├á ghi mß╗Öt gi├í trß╗ï ngã░ß╗Øi d├╣ng kh├┤ng chß╗ìn.

Quyß║┐t ─æß╗ïnh (TuanPQ):

1. Popup c├│ nh├│m radio "Diß╗àn biß║┐n" cß║ính ├┤ "Diß╗àn biß║┐n mß╗øi", kh├┤ng chß╗ìn sß║Án.
2. Bß║»t buß╗Öc khi lß╗çnh tß║ío lß║ºn theo d├Ái: Giß╗» trß║íng th├íi (├┤ chß╗» bß║»t buß╗Öc theo
   FE-10 Q1), hoß║Àc ├┤ chß╗» c├│ nß╗Öi dung. Thiß║┐u ÔåÆ `MSG-COM-06` dã░ß╗øi nh├│m radio.
   ─Éß╗òi trß║íng th├íi / ─É├│ng ca m├á ├┤ chß╗» trß╗æng th├¼ kh├┤ng tß║ío theo d├Ái, kh├┤ng bß║»t buß╗Öc.
3. A5 `POST ÔÇª/health-cases/{caseId}/status` th├¬m `progress?`; c├│
   `latestProgress` m├á thiß║┐u `progress` ÔåÆ 400 `MSG-COM-06 {field: progress}`.
   Backend kh├┤ng tß╗▒ ─æiß╗ün gi├í trß╗ï mß║Àc ─æß╗ïnh. Frontend (backend v├á local) gß╗¡i / lã░u
   ─æ├║ng gi├í trß╗ï ngã░ß╗Øi d├╣ng chß╗ìn; bß╗Å ─æoß║ín tß╗▒ suy.

Nh├ún diß╗àn biß║┐n trong FE theo spec FE-10 (Tß╗æt hãín / Kh├┤ng ─æß╗òi / Xß║Ñu hãín). Test:
TC-10-27, TC-10-28.

### D36 ÔÇö FE-11 / FE-12: thß║╗ tai b├¬ "─É─âng k├¢ ngay" kh├┤ng bß║»t buß╗Öc; c├íc chß╗æt triß╗ân khai sinh sß║ún (15/11/2026)

FE-12 Q5: Figma bß║»t buß╗Öc thß║╗ tai khi chß╗ìn "─É─âng k├¢ ngay", SRS (┬º3.5, SCR-40 d├▓ng
13) kh├┤ng bß║»t buß╗Öc. Quyß║┐t ─æß╗ïnh (TuanPQ): **theo SRS (D12), kh├┤ng bß║»t buß╗Öc**, khß╗øp
Q3 ÔÇö b├¬ ─æ─âng k├¢ ngay kh├┤ng c├│ thß║╗ ─æã░ß╗úc cß║Ñp m├ú khi ghi sß╗ò phiß║┐u nhß║¡p FARM_BORN
(FE-06). Khi c├│ nhß║¡p vß║½n kiß╗âm Ôëñ 50 k├¢ tß╗▒ v├á tr├╣ng m├ú (MSG-FE12-08). FE bß╗Å lß╗ùi bß║»t
buß╗Öc, chß║┐ ─æß╗Ö local tß╗▒ cß║Ñp m├ú nhã░ backend.

C├íc chß╗æt triß╗ân khai khi ─æß╗æi chiß║┐u spec FE-11 / FE-12 mß╗Ñc 7 vß╗øi code (TuanPQ):

1. P1: ngã░ß╗Øi quan s├ít / thß╗▒c hiß╗çn / kh├ím / ─æß╗í ─æß║╗ c├│ thß╗â l├á th├ánh vi├¬n ACTIVE
   (`observer_id`, `performer_id`, `examiner_id`, `attendant_id` ÔÇö changeset mß╗øi,
   FK `app_user`, nullable) hoß║Àc t├¬n ngo├ái (cß╗Öt chß╗» c┼®). Ngã░ß╗Øi quan s├ít mß║Àc ─æß╗ïnh
   l├á ngã░ß╗Øi ghi.
2. P2: kiß╗âm tr├╣ng 12 giß╗Ø (MSG-FE11-03) cho cß║ú ─æß╗Öng dß╗Ñc v├á phß╗æi; kh├┤ng hß╗Åi khi lß║ºn
   phß╗æi c├╣ng `linkedEstrusId` vß╗øi lß║ºn phß╗æi VALID trã░ß╗øc (phß╗æi lß║ºn hai c├│ chß╗º ├¢,
   R-11-08) hoß║Àc client gß╗¡i `confirmDuplicate=true`.
3. P3: bß║ún ghi c├│ bß║ún ghi phß╗Ñ thuß╗Öc ÔåÆ 409 MSG-FE11-07 `{records, dependents[]}`.
   MSG-FE12-02 chß╗ë cho m├óu thuß║½n kh├ím / thai; MSG-FE12-12 cho thai ─æ├ú ─æ├│ng v├á ─æß║╗
   tr├╣ng trong 30 ng├áy.
4. P4: lß║ºn ─æß║╗ thß╗® hai cß╗ºa c├╣ng b├▓ mß║╣ trong 30 ng├áy bß╗ï chß║Àn 409 MSG-FE12-12.
5. P5: li├¬n kß║┐t sai b├▓ / sai loß║íi / ─æ├ú hß╗ºy giß╗» MSG-COM-05; chß╗ë thß╗Øi ─æiß╗âm sß╗øm hãín
   sß╗▒ kiß╗çn li├¬n kß║┐t ÔåÆ MSG-FE11-10 `{event, time, field}`.
6. P6: 1ÔÇô4 b├¬ mß╗ùi lß║ºn ─æß║╗ (R-12-08, BR-D19).
7. P7: kh├ím C├ô THAI kh├┤ng c├│ phß╗æi li├¬n kß║┐t v├á kh├┤ng c├│ sß╗æ th├íng ÔåÆ thai OPEN kh├┤ng
   c├│ ng├áy dß╗▒ kiß║┐n, trß║ú `episode.notice = MSG-FE12-11`.
8. Thiß║┐u tham sß╗æ trß║íi th├¼ kh├┤ng d├╣ng gi├í trß╗ï mß║Àc ─æß╗ïnh: kh├┤ng c├│ thß╗Øi gian mang
   thai ÔåÆ kh├┤ng t├¡nh ng├áy (`parameterMissing`, MSG-FE11-08); kh├ím C├ô THAI khi ─æ├ú
   c├│ thai OPEN ÔåÆ x├íc nhß║¡n thai ─æ├│ (AF2), kh├┤ng b├ío lß╗ùi; diß╗àn biß║┐n thai bß║»t buß╗Öc
   chi tiß║┐t Ôëñ 1.000 k├¢ tß╗▒.

Chi tiß║┐t v├á bß║úng lß╗çch: `docs/agent-context/FE-11-12-progress.md`. Test:
TC-11-xx, TC-12-xx trong `ReproductionResourceTest`.

### D37 ÔÇö FE-18: quyß╗ün xem danh mß╗Ñc v├á tham sß╗æ (15/11/2026)

Technician trong trß║íi ─æã░ß╗úc xem cß║ú n─âm tab SCR-52 ─æß║┐n SCR-56, gß╗ôm mß╗Ñc ─æ├¡ch nu├┤i, tham sß╗æ ─æang hiß╗çu lß╗▒c v├á lß╗ïch sß╗¡ phi├¬n bß║ún. Owner v├á Manager mß╗øi ─æã░ß╗úc thß╗▒c hiß╗çn thao t├íc quß║ún trß╗ï danh mß╗Ñc hoß║Àc lã░u phi├¬n bß║ún tham sß╗æ, theo quyß╗ün cß╗ºa trß║íi. Viß╗çc ─æß╗òi mß╗Ñc ─æ├¡ch cß╗ºa mß╗Öt con b├▓ vß║½n thuß╗Öc quyß╗ün Owner trong FE-05.

Q1 ─æã░ß╗úc chß╗æt theo ph├ón quyß╗ün thß╗▒c tß║┐ cß╗ºa API v├á giao diß╗çn. ─Éß╗æi chiß║┐u TC-18-01 v├á `CatalogueFe18Test.q1TechnicianViewsEveryTabButCannotWrite`.

### D38 ÔÇö FE-19: Owner hß╗ºy y├¬u cß║ºu thanh to├ín (16/11/2026)

SRS 28/10 kh├┤ng cho hß╗ºy: y├¬u cß║ºu thanh to├ín bß║Ñt biß║┐n 24 giß╗Ø (GBR-70), chß╗ë JOB-03 kß║┐t
th├║c y├¬u cß║ºu chã░a trß║ú, n├¬n tß║ío nhß║ºm kß╗│ hß║ín th├¼ phß║úi chß╗Ø hß║┐t hß║ín. Ngã░ß╗Øi d├╣ng (DucNV, chß╗º
FE-19) chß╗ìn l├ám chß╗®c n─âng hß╗ºy thß║¡t sau khi ─æß╗ìc GBR-70, GBR-72, thß╗▒c thß╗â Payment Request,
UC-FE19-02, SCR-59 / SCR-60 (Part III 19.1.3ÔÇô19.1.4), ma trß║¡n quyß╗ün v├á ─æß╗æi chiß║┐u code.
Chß╗æt FE-19 Q11, cß║ú bß╗æn ─æiß╗âm theo ─æß╗ü xuß║Ñt:

1. Chß╗ë Owner cß╗ºa trß║íi hß╗ºy ─æã░ß╗úc (c├╣ng quyß╗ün tß║ío y├¬u cß║ºu, ß╗ƒ mß╗ìi trß║íng th├íi dß╗ïch vß╗Ñ); l├¢ do
   t├╣y chß╗ìn, trim, Ôëñ 1.000 k├¢ tß╗▒, rß╗ùng = kh├┤ng ghi.
2. Chß╗ë hß╗ºy y├¬u cß║ºu `PENDING` chã░a hß║┐t hß║ín v├á **chã░a nhß║¡n giao dß╗ïch**: c├╣ng ─æiß╗üu kiß╗çn vß╗øi
   bã░ß╗øc "─É├ú nhß║¡n giao dß╗ïch" cß╗ºa SCR-59 (D15: chß╗®ng tß╗½ ─æ├ú x├íc thß╗▒c, chiß╗üu v├áo, ─æ├║ng m├┤i
   trã░ß╗Øng / namespace / TK / m├ú, kß╗â cß║ú sai sß╗æ tiß╗ün) hoß║Àc ─æ├ú c├│ chß╗®ng tß╗½ ph├ón bß╗ò. ─É├ú nhß║¡n ÔåÆ
   m├ú mß╗øi **MSG-FE19-19**; kh├┤ng c├▓n PENDING chã░a hß║┐t hß║ín ÔåÆ MSG-COM-05.
3. Tiß╗ün vß╗ü sau khi hß╗ºy: cß╗¡a sß╗ò nhß║¡n tiß╗ün cß╗ºa y├¬u cß║ºu ─æ├ú hß╗ºy l├á `[tß║ío, l├║c hß╗ºy)`. Giß╗Ø ng├ón
   h├áng trã░ß╗øc l├║c hß╗ºy vß║½n ─æã░ß╗úc x├íc nhß║¡n nhã░ thã░ß╗Øng (`CANCELLED` ÔåÆ `PAID`, cß║Ñp kß╗│, giß╗» giß╗Ø
   hß╗ºy); ─æ├║ng hoß║Àc sau l├║c hß╗ºy th├¼ kh├┤ng tß╗▒ cß║Ñp kß╗│, chß╗®ng tß╗½ chß╗Ø PM (PM chß║Ñp nhß║¡n c┼®ng bß╗ï
   chß║Àn `OUTSIDE_WINDOW`) v├á ho├án trß║ú theo UC-FE19-06.
4. `CANCELLED` l├á trß║íng th├íi cuß╗æi, kh├┤ng c├▓n chß║Àn tß║ío y├¬u cß║ºu mß╗øi (BR-D23 chß╗ë t├¡nh PENDING
   chã░a hß║┐t hß║ín).

SRS sß╗¡a tß║íi chß╗ù: ─æß╗ïnh ngh─®a Payment request, thß╗▒c thß╗â Payment Request (thuß╗Öc t├¡nh, v├▓ng
─æß╗Øi), GBR-70, GBR-72, UC-FE19-02 (POST-3, AF3, AF6, E7, E8, th├¬m GBR-72 v├áo quy tß║»c),
SCR-59 (trß║íng th├íi, QR, n├║t Hß╗ºy y├¬u cß║ºu), SCR-60 (lß╗ìc, trß║íng th├íi, chi tiß║┐t), ma trß║¡n quyß╗ün
("View / request / cancel payment"); bß║úng th├┤ng b├ío th├¬m MSG-FE19-17 ÔåÆ 19 ngay sau
MSG-FE19-16, c├íc d├▓ng sau ─æ├ính sß╗æ lß║íi (205 ÔåÆ 259 th├ánh 208 ÔåÆ 262).

─Éi k├¿m, kh├┤ng cß║ºn quyß║┐t ri├¬ng: route A18 `POST /api/farms/{farmId}/subscription/payments/{paymentId}/cancel`
vß╗øi `Idempotency-Key` bß║»t buß╗Öc, kh├┤ng c├│ `expectedVersion` (trß║íng th├íi l├á ─æiß╗üu kiß╗çn duy nhß║Ñt
c├│ thß╗â ─æß╗òi, ─æã░ß╗úc kiß╗âm sau khi kh├│a); kh├│a d├▓ng trß║íi rß╗ôi y├¬u cß║ºu nhã░ thao t├íc x├íc nhß║¡n; audit
`PAYMENT_REQUEST_CANCELLED` trong trß║íi (ngo├ái danh mß╗Ñc FE-17, nhã░ `PAYMENT_REQUEST`); kh├┤ng
gß╗¡i th├┤ng b├ío / email; migration th├¬m `cancelled_at`, `cancelled_by_id`, `cancel_reason` cho
`payment`; `PaymentDTO` th├¬m `cancelledAt`, `cancelReason`; lß╗ìc trß║íng th├íi A3 / A12 nhß║¡n
`CANCELLED`. PM: y├¬u cß║ºu ─æ├ú hß╗ºy chß╗ë l├á ß╗®ng vi├¬n (A8) cho giao dß╗ïch c├│ giß╗Ø NH trã░ß╗øc l├║c hß╗ºy; chß╗®ng tß╗½
vß╗ü sau l├║c hß╗ºy c├│ kß║┐t quß║ú khß╗øp mß╗øi `REQUEST_CANCELLED` (SCR-62 #6). Spec FE-19 ┬º3.3, ┬º5, ┬º6, ┬º7, ┬º8, ┬º9 (TC-19-97 ÔåÆ 109), ┬º10 (Q11), ┬º11.

### D39 ÔÇö M├║i giß╗Ø nghiß╗çp vß╗Ñ cß╗æ ─æß╗ïnh UTC+07:00 (17/11/2026)

1. To├án bß╗Ö BeefCare d├╣ng UTC+07:00 cho ng├áy nghiß╗çp vß╗Ñ, kiß╗âm ng├áy tã░ãíng lai, hiß╗ân thß╗ï giß╗Ø, nhß║¡p giß╗Ø, nhß║»c viß╗çc v├á c├íc job theo lß╗ïch. Mß╗æc ─æß╗òi ng├áy l├á 17:00 UTC. Khoß║úng ng├áy lß╗ìc t├¡nh tß╗½ 00:00 ng├áy bß║»t ─æß║ºu ─æß║┐n trã░ß╗øc 00:00 ng├áy sau ng├áy kß║┐t th├║c, c├╣ng ─æß╗Ö lß╗çch +07:00.
2. SCR-11 hiß╗çn m├║i giß╗Ø ß╗ƒ chß║┐ ─æß╗Ö chß╗ë ─æß╗ìc. API giß╗» trã░ß╗Øng `timeZone` vß╗øi gi├í trß╗ï chuß║®n `Asia/Ho_Chi_Minh`; c├íc m├ú UTC+7 c┼® ─æã░ß╗úc chuß║®n h├│a khi lã░u. Migration chuß║®n h├│a trã░ß╗Øng cß╗ºa c├íc trß║íi hiß╗çn c├│.
3. Thß╗Øi ─æiß╗âm lã░u l├á instant vß╗øi hß╗úp ─æß╗ông API giß╗» nguy├¬n. Dß╗» liß╗çu chß╗ë c├│ ng├áy nhã░ ng├áy sinh, ng├áy chuyß╗ân chuß╗ông v├á hß║ín sß╗¡ dß╗Ñng giß╗» nguy├¬n gi├í trß╗ï lß╗ïch. Giß╗Ø nhß║¡p tß╗½ ├┤ ng├áy-giß╗Ø ─æã░ß╗úc diß╗àn giß║úi ß╗ƒ UTC+07:00.

### D40 ÔÇö FE-20: danh mß╗Ñc quyß║┐t ─æß╗ïnh phß║ím vi cß╗ºa y├¬u cß║ºu hß╗ù trß╗ú (17/11/2026)

FE-20 liß╗çt k├¬ danh mß╗Ñc v├á phß║ím vi nhã░ng chã░a quy ─æß╗ïnh quan hß╗ç giß╗»a hai trã░ß╗Øng, khiß║┐n y├¬u cß║ºu Thanh to├ín hoß║Àc Dß╗ïch vß╗Ñ trang trß║íi c├│ thß╗â ─æã░ß╗úc gß╗¡i ß╗ƒ phß║ím vi t├ái khoß║ún v├á kh├┤ng gß║»n trß║íi.

Quyß║┐t ─æß╗ïnh (LamKD):

1. `ACCOUNT_ACCESS` chß╗ë d├╣ng phß║ím vi `ACCOUNT`; giao diß╗çn tß╗▒ chß╗ìn "Kh├┤ng gß║»n trß║íi", kh├│a lß╗▒a chß╗ìn "Trang trß║íi" v├á gß╗¡i `farmId = null`.
2. `PAYMENT` v├á `FARM_SERVICE` chß╗ë d├╣ng phß║ím vi `FARM`; giao diß╗çn tß╗▒ chß╗ìn "Trang trß║íi", kh├│a lß╗▒a chß╗ìn "Kh├┤ng gß║»n trß║íi", hiß╗çn "Danh mß╗Ñc n├áy bß║»t buß╗Öc gß║»n vß╗øi trang trß║íi." v├á bß║»t buß╗Öc chß╗ìn mß╗Öt trß║íi thuß╗Öc Owner.
3. `SYSTEM_USAGE` v├á `OTHER` cho ph├®p ngã░ß╗Øi d├╣ng chß╗ìn `ACCOUNT` hoß║Àc `FARM`; nß║┐u chß╗ìn `FARM` th├¼ bß║»t buß╗Öc chß╗ìn trß║íi, nß║┐u chß╗ìn `ACCOUNT` th├¼ `farmId = null`.
4. Frontend kiß╗âm tra ─æß╗â phß║ún hß╗ôi ngay tr├¬n m├án h├¼nh; backend kiß╗âm tra lß║íi ma trß║¡n danh mß╗Ñc/phß║ím vi trã░ß╗øc khi tß║ío ticket ─æß╗â kh├┤ng thß╗â bß╗Å qua bß║▒ng c├ích gß╗ìi API trß╗▒c tiß║┐p. Hß╗úp ─æß╗ông JSON kh├┤ng th├¬m trã░ß╗Øng mß╗øi.

### D41 ÔÇö Owner c├│ to├án bß╗Ö quyß╗ün cß╗ºa Manager v├á Technician trong trß║íi (18/11/2026)

SRS 28/10 cho Owner chß╗ë xem t─âng trã░ß╗ƒng, ti├¬m ph├▓ng, sß╗®c khß╗Åe, sinh sß║ún v├á sß╗ò cho ─ân
(Table III-2, GBR-08, GBR-102, GBR-103) v├á kh├┤ng ─æã░a nhß║»c REM-11 cho Owner (Table III-3,
GBR-104). Trß║íi nhß╗Å kh├┤ng c├│ Manager th├¼ Owner kh├┤ng ghi ─æã░ß╗úc dß╗» liß╗çu ch─âm s├│c. Ngã░ß╗Øi d├╣ng
(DucNV) chß╗ìn gß╗Öp quyß╗ün sau khi ─æß╗æi chiß║┐u Table III-2, `FarmAction` v├á c├íc m├án h├¼nh. Chß╗æt
theo ─æß╗ü xuß║Ñt:

1. Owner ghi, sß╗¡a, loß║íi trß╗½ / hß╗ºy nhã░ Manager ß╗ƒ FE-08 (c├ón, BCS), FE-09 (lß╗ïch ti├¬m, ghi
   ti├¬m, ho├ún m┼®i), FE-10 (mß╗ƒ ca, theo d├Ái, ─æiß╗üu trß╗ï, ─æß╗òi trß║íng th├íi, ─æ├│ng ca), FE-11 /
   FE-12 (─æß╗Öng dß╗Ñc, phß╗æi, kh├ím thai, diß╗àn biß║┐n thai, ─æß║╗) v├á FE-23 (bß║ún ghi cho ─ân), kß╗â cß║ú
   Sß╗¡a / Hß╗ºy tr├¬n d├▓ng thß╗Øi gian (FE-16 Q2). Quy tß║»c lã░u giß╗» nguy├¬n: l├¢ do, version,
   Idempotency-Key, kiß╗âm phß╗Ñ thuß╗Öc. Owner sß╗¡a / hß╗ºy ─æã░ß╗úc bß║ún ghi do Manager tß║ío v├á ngã░ß╗úc
   lß║íi, ─æ├║ng quy tß║»c hiß╗çn c├│ cß╗ºa Manager; ngã░ß╗Øi ghi l├á t├ái khoß║ún thß╗▒c hiß╗çn.
2. Quyß╗ün cß╗ºa Technician ─æß╗üu l├á quyß╗ün xem v├á ─æ├ú nß║▒m trong quyß╗ün Owner, trß╗½ nhß║»c REM-11
   (bß╗»a ─ân chã░a ghi). Owner nay nhß║¡n REM-11, tß╗®c thß║Ñy mß╗ìi nhß║»c viß╗çc cß╗ºa trß║íi.
3. Chß╗ë gß╗Öp quyß╗ün, kh├┤ng th├¬m m├án h├¼nh: Owner d├╣ng c├íc m├án h├¼nh sß║Án c├│ (menu Ch─âm s├│c v├á
   route ─æ├ú mß╗ƒ cho Owner), kh├┤ng v├áo giao diß╗çn ─æiß╗çn thoß║íi cß╗ºa Technician (`/kt`, SCR-74,
   SCR-86). Owner giß╗» c├íc quyß╗ün ri├¬ng (phiß║┐u xuß║Ñt, thu tiß╗ün, ngã░ß╗Øi mua, th├ánh vi├¬n, g├│i
   dß╗ïch vß╗Ñ, th├┤ng tin trß║íi, ─æß╗òi mß╗Ñc ─æ├¡ch b├▓). Quyß╗ün cß╗ºa Manager v├á Technician kh├┤ng ─æß╗òi.
4. D├▓ng "Danh mß╗Ñc v├á tham sß╗æ" cß╗ºa Table III-2 sß╗¡a th├ánh "Quß║ún l├¢ tß║Ñt cß║ú" cho Owner, khß╗øp
   D37 v├á code (`MANAGE_CATALOGUES`, `MANAGE_CARE_CATALOGUES` ─æ├ú gß╗ôm Owner); bß║úng c┼® lß╗çch
   vß╗øi code tß╗½ trã░ß╗øc.

SRS sß╗¡a tß║íi chß╗ù: Table III-2 (bß║úy d├▓ng), ch├║ th├¡ch ┬╣Ôü░ vß╗ü nhß║»c viß╗çc cß╗ºa Owner, bß║úng menu
theo vai tr├▓ (n├║t ghi chuyß╗ân sang d├▓ng Farm Owner), GBR-08, GBR-102, GBR-103, GBR-104,
Table III-3 (REM-11), tab Thß╗®c ─ân cß╗ºa SCR-44, m├┤ tß║ú t├│m tß║»t v├á Primary Actor / PRE-1 cß╗ºa
20 UC ghi (UC-FE08-01, 03; UC-FE09-02 ÔåÆ 06, 08; UC-FE10-02 ÔåÆ 05; UC-FE11-02 ÔåÆ 04;
UC-FE12-02 ÔåÆ 06; UC-FE23-08, 09), danh s├ích m├án h├¼nh SCR-30 ÔåÆ 34, 37, 39, 40, 83, ─æoß║ín mß╗ƒ
─æß║ºu c├íc tab / popup ghi, c├íc n├║t "(Manager)", c├óu chß╗ë ─æß╗ìc cß╗ºa Owner ß╗ƒ SCR-39 v├á SCR-83,
trã░ß╗Øng "Fed by". Bã░ß╗øc luß╗ông UC c├▓n ghi "Manager selectsÔÇª" ─æß╗ìc l├á Owner hoß║Àc Manager (GBR-08,
GBR-102 ghi r├Á). Business flow v├á NFR-U02 m├┤ tß║ú ngã░ß╗Øi ghi ─æiß╗ân h├¼nh, kh├┤ng phß║úi quy tß║»c
quyß╗ün, giß╗» nguy├¬n.

─Éi k├¿m, kh├┤ng cß║ºn quyß║┐t ri├¬ng: backend th├¬m OWNER v├áo `MANAGE_GROWTH`, `MANAGE_HEALTH`,
`MANAGE_REPRODUCTION`, `MANAGE_FEEDING`; REM-11 trong `FarmReminderQueryService` v├á
`FeedManagementService` gß╗ôm Owner; bß║úng quyß╗ün SCR-08 (`AccountResource`) theo Table III-2
mß╗øi. Frontend hiß╗çn n├║t ghi / sß╗¡a cho Owner (─æang kiß╗âm `role === 'MANAGER'`) v├á bß║úng quyß╗ün
SCR-08 / SCR-13 / popup Mß╗Øi. Kh├┤ng migration, kh├┤ng ─æß╗òi h├¼nh dß║íng API; m├┤ tß║ú 403 trong
OpenAPI cß║¡p nhß║¡t. Test case: TC-08-19, TC-09-28, TC-10-24, TC-11-20, TC-12-26 c├▓n Technician
(403); TC-23-02 ─æß╗òi th├ánh Owner ghi th├ánh c├┤ng; TC-14-16, TC-23-27 th├¬m Owner nhß║¡n REM-11;
th├¬m TC-08-22, TC-09-31, TC-10-29, TC-11-25, TC-12-27, TC-14-27, TC-16-17. Spec FE-03 ┬º3.4,
FE-08 ÔåÆ FE-12 ┬º1, ┬º2, quy tß║»c quyß╗ün, bß║úng n├║t; FE-14 ┬º2, Table III-3, SCR-44; FE-16 ┬º2,
R-16-07, Q2; FE-23 ┬º1, ┬º2, R-23-11, R-23-13, SCR-83, popup Ghi bß╗»a ─ân. FE-08 ÔåÆ FE-12 thuß╗Öc
TuanPQ, FE-23 thuß╗Öc TaiDX, FE-14 / FE-16 thuß╗Öc AnNT: cß║ºn b├ío c├íc chß╗º feature.

### D42 ÔÇö FE-18: v├▓ng ─æß╗Øi danh mß╗Ñc, ngã░ng / d├╣ng lß║íi v├á quyß╗ün x├│a (22/11/2026)

AnNT ─æß╗ông ├¢ phã░ãíng ├ín trong phi├¬n: "─Éã░ß╗úc, sß╗¡a theo ─æß╗ü xuß║Ñt cß╗ºa bß║ín ─æi, sß╗¡a spec trã░ß╗øc rß╗ôi hß║Áng code". Chß╗æt FE-18 Q4 theo phß║ím vi SRS 28/10, GBR-67 / 68, BR-D12 / 32 v├á SCR-52 ÔåÆ 56:

1. Giß╗æng, thuß╗æc v├á mß╗Ñc ─æ├¡ch kh├┤ng ─æã░ß╗úc x├│a, kß╗â cß║ú chã░a d├╣ng; chß╗ë sß╗¡a theo ─æiß╗üu kiß╗çn hoß║Àc ngã░ng / d├╣ng lß║íi c├╣ng ID. Vß║»c-xin chã░a tß╗½ng tham chiß║┐u ─æã░ß╗úc x├│a sau x├íc nhß║¡n; ─æ├ú tham chiß║┐u th├¼ chß╗ë ngã░ng. Bß╗Å ba DELETE giß╗æng / thuß╗æc / mß╗Ñc ─æ├¡ch ─æang mß╗ƒ ngo├ái SRS, cß║ú UI lß║½n API; gß╗ìi ─æã░ß╗Øng c┼® trß║ú 405, kh├┤ng c├│ t├íc dß╗Ñng dß╗» liß╗çu / audit x├│a.
2. Tham chiß║┐u t├¡nh cß║ú li├¬n kß║┐t c├▓n lã░u trong nh├íp, lß╗ïch, bß║ún ghi ─æ├ú hß╗ºy, b├▓ ─æ├ú xuß║Ñt v├á ti├¬u ch├¡ chuß╗ông lß╗ïch sß╗¡; sß╗æ b├▓ ACTIVE bß║▒ng 0 kh├┤ng chß╗®ng minh chã░a d├╣ng. M├ú ─æ├ú tham chiß║┐u bß╗ï kh├│a; loß║íi mß╗Ñc ─æ├¡ch ─æ├ú ─æã░ß╗úc b├▓ hoß║Àc ti├¬u ch├¡ chuß╗ông d├╣ng bß╗ï kh├│a.
3. Ngã░ng chß╗ë chß║Àn chß╗ìn mß╗øi, kh├┤ng ─æß╗òi hß╗ô sãí b├▓ / dß╗» liß╗çu c┼® hoß║Àc tß╗▒ hß╗ºy lß╗ïch. Phiß║┐u nh├íp kiß╗âm lß║íi danh mß╗Ñc l├║c ghi sß╗ò. Sß╗¡a danh mß╗Ñc giß╗» snapshot ─æ├ú chß╗æt, gß╗ôm t├¬n v├á th├┤ng tin ngã░ng thß╗ït. M├án quß║ún trß╗ï mß║Àc ─æß╗ïnh ACTIVE; lß╗ìc INACTIVE / Tß║Ñt cß║ú ─æß╗â D├╣ng lß║íi, API vß║½n ─æß╗ìc ─æã░ß╗úc dß╗» liß╗çu c┼®.
4. Giß╗» quyß╗ün D37 / D41: Owner v├á Manager quß║ún l├¢, Technician xem cß║ú n─âm tab / lß╗ïch sß╗¡. Giß╗» phi├¬n bß║ún tham sß╗æ bß║Ñt biß║┐n, ghi ch├║ nguß╗ôn, ng├áy hiß╗çu lß╗▒c UTC+07:00 (D39), ph├ón biß╗çt CURRENT / SCHEDULED; kh├┤ng viß║┐t lß║íi sß╗▒ kiß╗çn c┼®.
5. Mß╗ùi phi├¬n sß╗¡a gß╗¡i version ─æ├ú ─æß╗ìc ban ─æß║ºu. Backend kiß╗âm lß║íi quyß╗ün, version v├á tham chiß║┐u trong giao dß╗ïch; phß╗æi hß╗úp kh├│a giß╗»a x├│a vß║»c-xin v├á tß║ío tham chiß║┐u, kh├┤ng ─æß╗â tham chiß║┐u mß╗ô c├┤i.

Thß╗® tß╗▒ thß╗▒c hiß╗çn: cß║¡p nhß║¡t spec / c├óu hß╗Åi / quyß║┐t ─æß╗ïnh trã░ß╗øc, sau ─æ├│ sß╗¡a code v├á kiß╗âm chß╗®ng. Quyß║┐t ─æß╗ïnh n├áy chã░a tß╗▒ chß╗®ng nhß║¡n API hoß║Àc UI; bß║▒ng chß╗®ng nß║▒m ß╗ƒ kiß╗âm thß╗¡ cß╗ºa g├│i triß╗ân khai.

### D43 ÔÇö FE-08: t├ích Sß╗¡a / X├│a bß║ún ghi c├ón, ghi ch├║ kh├┤ng bß║»t buß╗Öc (22/11/2026)

TuanPQ (chß╗º FE-08) chß╗æt trong phi├¬n: "X├│a d├╣ng c├ích ─æß╗ü xuß║Ñt", v├á "vß║½n bß╗Å r├áng buß╗Öc l├¢ do, ghi quyß║┐t ─æß╗ïnh v├áo REQUIREMENT_DECISIONS". L├ám kh├íc R-08-07 v├á popup "Sß╗¡a / Loß║íi trß╗½ bß║ún ghi c├ón" cß╗ºa spec FE-08 (SRS 28/10, UC-FE08-03):

1. Bß║úng lß╗ïch sß╗¡ ─æo (SCR-30) c├│ hai n├║t ri├¬ng: **Sß╗¡a** v├á **X├│a**, thay cho n├║t "Sß╗¡a ┬À Loß║íi trß╗½" v├á ├┤ chß╗ìn h├ánh ─æß╗Öng trong popup.
2. Popup **Sß╗¡a bß║ún ghi c├ón** chß╗ë ─æß╗â sß╗¡a gi├í trß╗ï. ├ö "L├¢ do *" ─æß╗òi th├ánh **Ghi ch├║**, kh├┤ng bß║»t buß╗Öc, tß╗æi ─æa 500 k├¢ tß╗▒; khi mß╗ƒ, ─æiß╗ün sß║Án ghi ch├║ cß╗ºa lß║ºn sß╗¡a gß║ºn nhß║Ñt.
3. **X├│a** hiß╗çn popup x├íc nhß║¡n, kh├┤ng cß║ºn ghi ch├║. Ph├¡a m├íy chß╗º vß║½n l├á loß║íi trß╗½ mß╗üm (`action: EXCLUDE`, trß║íng th├íi `EXCLUDED`), kh├┤ng x├│a vß║¡t l├¢: lß║ºn ─æo kh├┤ng v├áo t├¡nh to├ín (R-08-06), kh├┤ng vß║¢, kh├┤ng hiß╗çn trong lß╗ïch sß╗¡ ─æo v├á kh├┤ng ─æß║┐m v├áo "Sß╗æ lß║ºn ─æo"; mß╗ƒ ─æ├║ng bß║ún ghi tß╗½ d├▓ng thß╗Øi gian vß║½n thß║Ñy nh├ún "─É├ú x├│a".
4. BR-D15 giß╗» nguy├¬n phß║ºn c├▓n lß║íi: mß╗ùi lß║ºn sß╗¡a / x├│a vß║½n lã░u Record Revision vß╗øi gi├í trß╗ï trã░ß╗øc / sau, ngã░ß╗Øi v├á thß╗Øi ─æiß╗âm trong c├╣ng transaction, kiß╗âm version (MSG-COM-05). Chß╗ë ghi ch├║ (`reason`) c├│ thß╗â `null`.

─Éi k├¿m: `GrowthDtos.Correction.reason` bß╗Å `@NotBlank` (giß╗» `@Size(max = 500)`); `RecordRevisionService` th├¬m `recordWithOptionalNote` cho FE-08, h├ám `record` cß╗ºa c├íc feature kh├íc vß║½n bß║»t buß╗Öc l├¢ do. Kh├┤ng migration (cß╗Öt `reason`, `correction_reason` ─æ├ú cho ph├®p null), kh├┤ng ─æß╗òi route hay h├¼nh dß║íng response; OpenAPI vß╗æn kh├┤ng ─æ├ính dß║Ñu `reason` bß║»t buß╗Öc.

C├╣ng ─æß╗út (─æ├ú merge ß╗ƒ PR #64), TuanPQ y├¬u cß║ºu gß╗ìn giao diß╗çn FE-08: popup ghi ─æß╗òi t├¬n "Ghi nhß║¡n c├ón", bß╗Å lß╗▒a chß╗ìn "ã»ß╗øc lã░ß╗úng kh├íc" khi ghi mß╗øi (bß║ún ghi c┼® vß║½n hiß╗ân thß╗ï / sß╗¡a ─æã░ß╗úc, backend vß║½n nhß║¡n `OTHER`), bß╗Å ├┤ "Cãí sß╗ƒ sß╗æ liß╗çu" v├á c├íc d├▓ng ch├║ th├¡ch; chß╗ë sß╗æ ADG ghi sß╗æ ng├áy v├á sß╗æ lß║ºn c├ón thß╗▒c tß║┐ thay cho nh├ún cß╗æ ─æß╗ïnh "ADG 60 / 90 ng├áy" (c├┤ng thß╗®c GBR-39 / GBR-107 kh├┤ng ─æß╗òi).

Spec FE-08 ─æ├ú cß║¡p nhß║¡t theo quyß║┐t ─æß╗ïnh n├áy: UC-FE08-03, R-08-06, R-08-07, SCR-30 (mß╗Ñc 3, 4, 6, 9, 13, 14), popup Ghi nhß║¡n c├ón, popup Sß╗¡a bß║ún ghi c├ón, popup X├│a lß║ºn ─æo mß╗øi, hß╗úp ─æß╗ông A4, MSG-FE08-05 v├á MSG-FE08-06 mß╗øi, TC-08-12 ÔåÆ TC-08-14.

### D44 ÔÇö FE-09: bß╗Å sß╗æ l├┤ vß║»c-xin khß╗Åi ghi ti├¬m (22/11/2026)

TuanPQ (chß╗º FE-09) chß╗æt trong phi├¬n: "x├│a trã░ß╗Øng n├áy, ko ├¢ ngh─®a v├¼ t├┤i ko quß║ún l├¡ sß╗æ lã░ß╗úng", chß╗ìn phã░ãíng ├ín ß║®n hß║│n sß╗æ l├┤ c┼®. Trang trß║íi kh├┤ng quß║ún l├¢ tß╗ôn kho vß║»c-xin theo l├┤, n├¬n sß╗æ l├┤ g├Á tay kh├┤ng d├╣ng ─æã░ß╗úc ─æß╗â truy vß║┐t. L├ám kh├íc R-09-08 v├á SCR-33 cß╗ºa spec FE-09 (SRS 28/10, GBR-42):

1. M├án Ghi nhß║¡n ti├¬m, popup Sß╗¡a / Hß╗ºy bß║ún ghi ti├¬m v├á popup sß╗¡a tr├¬n d├▓ng thß╗Øi gian hß╗ô sãí b├▓ kh├┤ng c├▓n ├┤ Sß╗æ l├┤; ti├¬m tß║íi trß║íi kh├┤ng c├▓n bß║»t buß╗Öc sß╗æ l├┤ (gß╗í MSG-FE09-05).
2. Kh├┤ng nãíi n├áo tr├¬n giao diß╗çn hiß╗ân thß╗ï sß╗æ l├┤, kß╗â cß║ú bß║ún ghi c┼®: cß╗Öt "L├┤ ┬À liß╗üu" ─æß╗òi th├ánh "Liß╗üu" ß╗ƒ hß╗ô sãí ti├¬m cß╗ºa b├▓ v├á trang Lß╗ïch sß╗¡ ti├¬m; m├án kß╗╣ thuß║¡t vi├¬n v├á d├▓ng thß╗Øi gian bß╗Å phß║ºn "l├┤ ÔÇª".
3. Dß╗» liß╗çu c┼® kh├┤ng x├│a: cß╗Öt `batch_no` giß╗» nguy├¬n (kh├┤ng migration). API `POST /vaccinations` v├á `/vaccinations/{id}/correction` vß║½n nhß║¡n `batchNo` t├╣y chß╗ìn (Ôëñ 50 k├¢ tß╗▒) ─æß╗â tã░ãíng th├¡ch; frontend kh├┤ng gß╗¡i nß╗»a, n├¬n sß╗¡a bß║ún ghi giß╗» nguy├¬n sß╗æ l├┤ c┼® trong DB.

─Éi k├¿m: `VaccinationCommandService` bß╗Å kiß╗âm "bß║»t buß╗Öc sß╗æ l├┤ khi ON_FARM", giß╗» giß╗øi hß║ín 50 k├¢ tß╗▒ khi c├│ gß╗¡i. Kh├┤ng ─æß╗òi route hay h├¼nh dß║íng response. Spec FE-09 ─æ├ú cß║¡p nhß║¡t: bß║úng dß╗» liß╗çu, R-09-08, UC ghi ti├¬m / sß╗¡a, popup ghi ti├¬m (mß╗Ñc 3), bß║úng hß╗ô sãí v├á Lß╗ïch sß╗¡ ti├¬m, popup sß╗¡a, hß╗úp ─æß╗ông A6, MSG-FE09-05, TC-09-13. "Sß╗æ l├┤" cß╗ºa nhß║¡p kho thß╗®c ─ân (FE-23) kh├┤ng thuß╗Öc quyß║┐t ─æß╗ïnh n├áy.

### D45 ÔÇö FE-09: kiß╗âm liß╗üu, ─æã░ß╗Øng ti├¬m "Kh├íc" v├á sß╗æ ng├áy ngã░ng thß╗ït (23/11/2026)

TuanPQ (chß╗º FE-09) chß╗æt trong phi├¬n: liß╗üu chß╗ë nhß║¡n sß╗æ dã░ãíng; chß╗ìn ─æã░ß╗Øng ti├¬m "Kh├íc" th├¼ phß║úi cho nhß║¡p v├á bß║»t buß╗Öc kh├┤ng ─æß╗â trß╗æng; ngã░ng thß╗ït chß╗ë l├á sß╗æ nguy├¬n, "nß║┐u ngã░ß╗Øi d├╣ng kh├┤ng chß╗ìn th├¼ tß╗▒ ─æß╗â l├á 0". Bß╗ò sung cho popup Ghi ti├¬m v├á popup Sß╗¡a bß║ún ghi ti├¬m cß╗ºa spec FE-09 (SCR-33, mß╗Ñc 5 ÔÇô 7):

1. **Liß╗üu** (kh├┤ng bß║»t buß╗Öc): nß║┐u nhß║¡p phß║úi l├á sß╗æ dã░ãíng, c├│ thß╗â k├¿m ─æãín vß╗ï bß║»t ─æß║ºu bß║▒ng chß╗» c├íi ("2", "2,5 ml", "1 liß╗üu"); tß╗½ chß╗æi 0, sß╗æ ├óm, chß╗», khoß║úng "1-2 ml". Frontend b├ío "Liß╗üu kh├┤ng hß╗úp lß╗ç."; backend kiß╗âm lß║íi liß╗üu do ngã░ß╗Øi d├╣ng gß╗¡i (liß╗üu tham chiß║┐u lß║Ñy tß╗½ danh mß╗Ñc kh├┤ng kiß╗âm lß║íi).
2. **─Éã░ß╗Øng ti├¬m "Kh├íc"**: hiß╗çn ├┤ "─Éã░ß╗Øng ti├¬m kh├íc", bß║»t buß╗Öc, tß╗æi ─æa 255 k├¢ tß╗▒. M├┤ tß║ú lã░u thß║│ng v├áo cß╗Öt `route` (thay cho m├ú `OTHER`) v├á hiß╗ân thß╗ï lß║íi ─æ├║ng chß╗» ─æ├ú nhß║¡p; gß╗¡i `OTHER` trãín bß╗ï tß╗½ chß╗æi vß╗øi `field = routeOther`. Kh├┤ng migration (cß╗Öt `route` varchar(255)).
3. **Ngã░ng thß╗ït**: sß╗æ nguy├¬n 0 ÔÇô 365, giß╗» cho ph├®p 0 v├¼ c├│ vß║»c-xin kh├┤ng cß║ºn ngã░ng thß╗ït. ├ö ─æß╗â trß╗æng ─æã░ß╗úc ghi l├á 0 ng├áy. Backend kh├┤ng c├▓n l├ám tr├▓n ngß║ºm sß╗æ thß║¡p ph├ón (trã░ß╗øc ─æ├óy `1.5` th├ánh `1`): trã░ß╗Øng `withdrawalDays` cß╗ºa ghi ti├¬m v├á sß╗¡a bß║ún ghi ─æß╗ìc bß║▒ng `WholeNumberDeserializer`, gß╗¡i sß╗æ thß║¡p ph├ón trß║ú HTTP 400.

─Éi k├¿m: `VaccinationCommandService` th├¬m `requireValidDose`, `requireRouteDescription`, `requireWithdrawalDays` (Javadoc tiß║┐ng Viß╗çt, hß║▒ng sß╗æ ─æß║Àt ─æß║ºu class); `CareDtos.RecordVaccinations` / `CorrectVaccination` gß║»n deserializer cho `withdrawalDays`. Kh├┤ng ─æß╗òi route API hay h├¼nh dß║íng response; client API kh├┤ng gß╗¡i `withdrawalDays` vß║½n lß║Ñy theo danh mß╗Ñc vß║»c-xin nhã░ c┼®.

### D46 ÔÇö FE-09: bß╗Å ho├ún m┼®i ti├¬m, kh├│a lß╗ïch ─æ├ú ho├án th├ánh v├á ─æiß╗üu kiß╗çn sß╗¡a lß╗ïch (23/11/2026)

TuanPQ (chß╗º FE-09) chß╗æt trong phi├¬n: lß╗ïch ti├¬m xong hß║┐t "phß║úi kh├│a lß╗ïch ─æß║Ñy chß╗® sao lß║íi c├▓n cho chß╗ënh sß╗¡a ─æß╗â d├╣ng lß║íi"; "ho├ún kh├┤ng c├│ ├¢ ngh─®a" ÔÇô con n├áo chã░a ti├¬m ─æã░ß╗úc th├¼ sß╗¡a lß╗ïch bß╗Å con ─æ├│ ra; bß╗Å tab Sß║»p tß╗øi; sß╗æ ng├áy "─Éß║┐n hß║ín" theo tham sß╗æ trß║íi; ─æß╗ông ├¢ bß║úng quy tß║»c sß╗¡a lß╗ïch v├á c├ích chuyß╗ân dß╗» liß╗çu ho├ún c┼®. L├ám kh├íc UC-FE09-06, R-09-05, R-09-12, GBR-43 (tab) v├á SCR-31 / SCR-32 / SCR-33 cß╗ºa spec FE-09 (SRS 28/10):

1. **Bß╗Å ho├ún m┼®i**: kh├┤ng c├▓n API `POST /scheduled-doses/{doseId}/defer` (trß║ú 404), popup Ho├ún, lß╗▒a chß╗ìn "Ho├ún" tß╗½ng con khi ghi theo l├┤, trß║íng th├íi `DEFERRED`, tab "─É├ú ho├ún", MSG-FE09-06 / 11. Hß╗ºy bß║ún ghi ti├¬m th├¼ m┼®i quay vß╗ü PLANNED (lß╗ïch ─æ├ú dß╗½ng th├¼ CANCELLED).
2. **Lß╗ïch ─æ├ú ho├án th├ánh**: lß╗ïch ACTIVE kh├┤ng c├▓n m┼®i PLANNED (─æ├ú ti├¬m hoß║Àc ─æ├ú hß╗ºy hß║┐t) ─æã░ß╗úc suy ra l├á "─æ├ú ho├án th├ánh" (`completed` trong A2), hiß╗çn nh├ún tr├¬n thß║╗ lß╗ïch v├á bß╗ï kh├│a: kh├┤ng sß╗¡a, kh├┤ng th├¬m b├▓ (backend trß║ú MSG-COM-05 `schedule_completed`); m├án Quß║ún l├¢ lß╗ïch ß║®n n├║t Lã░u v├á Dß╗½ng. Lß╗ïch c├│ nhß║»c lß║íi sinh m┼®i nhß║»c mß╗øi sau mß╗ùi lß║ºn ti├¬m m┼®i cuß╗æi n├¬n chß╗ë kß║┐t th├║c khi dß╗½ng. Hß╗ºy mß╗Öt bß║ún ghi l├ám m┼®i quay vß╗ü PLANNED th├¼ lß╗ïch tß╗▒ mß╗ƒ lß║íi.
3. **─Éiß╗üu kiß╗çn sß╗¡a lß╗ïch ─æang chß║íy**: chã░a ai ti├¬m th├¼ sß╗¡a tß╗▒ do; ─æ├ú c├│ m┼®i DONE th├¼ kh├│a vß║»c-xin (nhã░ Q3), ng├áy bß║»t ─æß║ºu v├á khoß║úng c├ích giß╗»a m┼®i; sß╗æ m┼®i kh├┤ng giß║úm dã░ß╗øi m┼®i ─æ├ú ti├¬m, kh├┤ng ─æß╗òi khi ─æ├ú bß║»t ─æß║ºu loß║ít nhß║»c lß║íi; vß║½n ─æß╗òi ─æã░ß╗úc t├¬n, nhß║»c lß║íi, th├¬m / bß╗Å b├▓. B├▓ th├¬m v├áo lß╗ïch c├│ ng├áy bß║»t ─æß║ºu ─æ├ú qua th├¼ m┼®i 1 hß║ín h├┤m nay (trã░ß╗øc ─æ├óy bß╗ï qu├í hß║ín ngay khi th├¬m).
4. **Tab danh s├ích m┼®i**: Tß║Ñt cß║ú ┬À Qu├í hß║ín ┬À ─Éß║┐n hß║ín trong N ng├áy ┬À ─É├ú ti├¬m. N = `VACCINATION_LEAD_DAYS` cß╗ºa phi├¬n bß║ún tham sß╗æ trß║íi ─æang hiß╗çu lß╗▒c (mß║Àc ─æß╗ïnh 7). M┼®i c├▓n xa hß║ín chß╗ë hiß╗çn ß╗ƒ "Tß║Ñt cß║ú".
5. **Dß╗» liß╗çu c┼®**: changeset mß╗øi `20261123000100_vaccination_remove_deferral` chuyß╗ân m┼®i DEFERRED vß╗ü PLANNED, hß║ín = ng├áy hß║╣n mß╗øi nß║┐u c├│, t─âng version; cß╗Öt `deferral_reason`, `new_expected_date`, `deferral_note` giß╗» nguy├¬n (kh├┤ng c├▓n d├╣ng). Kh├┤ng sß╗¡a migration c┼®.

─Éi k├¿m: `VaccinationCommandService` viß║┐t lß║íi phß║ºn sß╗¡a lß╗ïch th├ánh c├íc h├ám nhß╗Å (`applyName`, `applyVaccine`, `applyDates`, `applyBooster`, `applyDoseCount`, `applyTarget`, `planMissingDoses`, `isCompleted`) theo Java Code Convention, Javadoc tiß║┐ng Viß╗çt; `CareDtos` bß╗Å `DeferDose`, `DoseResult`, trã░ß╗Øng ho├ún cß╗ºa `VaccinationAnimal` / `ScheduledDoseView` v├á `deferredCount` cß╗ºa `VaccinationBatchResult`; `VaccinationCommandResource` viß║┐t lß║íi. OpenAPI v├á API catalog ─æ├ú sinh lß║íi. Phß║ºn chß╗ë ─æß╗ìc trß║íng th├íi ho├ún cß╗ºa FE-04 (xuß║Ñt ─æ├án), FE-14 (nhß║»c viß╗çc REM-06) v├á FE-15 (dashboard, b├ío c├ío) **kh├┤ng sß╗¡a**: sau migration kh├┤ng c├▓n m┼®i DEFERRED n├¬n c├íc nh├ính ─æ├│ kh├┤ng c├▓n chß║íy; trang Tß╗òng quan vß║½n tß╗▒ giß╗» "─Éß║┐n hß║ín 7 ng├áy" cß╗ºa FE-15 ÔÇô cß║ºn b├ío chß╗º c├íc feature nß║┐u muß╗æn thß╗æng nhß║Ñt.

### D47 ÔÇö FE-09: lß╗ìc v├á "Chß╗ìn tß║Ñt cß║ú" ß╗ƒ danh s├ích m┼®i ti├¬m (23/11/2026)

TuanPQ (chß╗º FE-09) y├¬u cß║ºu trong phi├¬n: trang Ti├¬m ph├▓ng kh├┤ng c├│ c├ích chß╗ìn nhanh m├á phß║úi ß║Ñn tß╗½ng m┼®i; lß╗ìc "nhã░ l├║c chß╗ìn b├▓ cho v├áo phiß║┐u". Bß╗ò sung cho SCR-31 (SRS chß╗ë c├│ ├┤ chß╗ìn tß╗½ng d├▓ng):

1. **Bß╗Ö lß╗ìc** nhã░ m├án chß╗ìn b├▓ v├áo phiß║┐u xuß║Ñt: T├¼m kiß║┐m (m├ú / t├¬n b├▓), Chuß╗ông, Nh├│m ─æ├án ÔÇô kß║┐t hß╗úp V├Ç, ├íp cho bß║úng v├á sß╗æ ─æß║┐m tr├¬n tab; bß╗Å lß╗ìc bß║▒ng lß╗▒a chß╗ìn "Tß║Ñt cß║ú" cß╗ºa tß╗½ng ├┤ (kh├┤ng c├│ n├║t X├│a lß╗ìc ri├¬ng). Hß╗ç thß╗æng kh├┤ng c├│ kh├íi niß╗çm "khu" (chuß╗ông chß╗ë c├│ m├ú, t├¬n, sß╗®c chß╗®a) n├¬n gom theo chuß╗ông.
2. **Chß╗ìn tß║Ñt cß║ú**: ├┤ ─æß║ºu cß╗Öt chß╗ìn mß╗ìi m┼®i chã░a ti├¬m khß╗øp lß╗ïch ─æang xem + tab + bß╗Ö lß╗ìc, kß╗â cß║ú c├íc trang chã░a mß╗ƒ; bß║Ñm lß║íi ─æß╗â bß╗Å; th├¬m n├║t "Bß╗Å chß╗ìn".
3. **Mß╗Öt lß║ºn ghi mß╗Öt vß║»c-xin**: m├án ghi ti├¬m theo l├┤ d├╣ng mß╗Öt vß║»c-xin cho cß║ú l├┤ v├á backend tß╗½ chß╗æi m┼®i cß╗ºa lß╗ïch kh├íc vß║»c-xin, n├¬n "Chß╗ìn tß║Ñt cß║ú" chß╗ë bß║¡t khi c├íc m┼®i khß╗øp bß╗Ö lß╗ìc c├╣ng vß║»c-xin (─æang xem tß║Ñt cß║ú c├íc lß╗ïch th├¼ tß║»t, gß╗úi ├¢ chß╗ìn mß╗Öt lß╗ïch); chß╗ìn tay lß║½n vß║»c-xin th├¼ b├ío v├á kh├│a n├║t "Ghi nhß║¡n".

Chß╗ë ─æß╗òi frontend (lß╗ìc tr├¬n dß╗» liß╗çu A2 ─æ├ú ─æß╗ìc); kh├┤ng ─æß╗òi backend, route hay DTO. Spec FE-09 SCR-31 ─æ├ú cß║¡p nhß║¡t (mß╗Ñc 6a, 7).

### D48 ÔÇö FE-09: lß╗ïch ─æ├ú ho├án th├ánh kh├┤ng chiß║┐m trang Ti├¬m ph├▓ng (23/11/2026)

TuanPQ (chß╗º FE-09) n├¬u trong phi├¬n: ─æß╗â thß║╗ lß╗ïch ─æ├ú ho├án th├ánh ß╗ƒ trang Ti├¬m ph├▓ng th├¼ sß║¢ "cß╗Öng dß╗ôn v├┤ hß║ín"; ─æß╗ông ├¢ phã░ãíng ├ín chß╗ë ─æß╗òi giao diß╗çn:

1. H├áng thß║╗ SCR-31 chß╗ë hiß╗çn lß╗ïch ─æang chß║íy (c├▓n m┼®i chß╗Ø ti├¬m); d├▓ng phß╗Ñ ─æß║┐m ─æ├║ng sß╗æ lß╗ïch ─æang chß║íy.
2. Lß╗ïch ─æ├ú ho├án th├ánh (D46) gom v├áo mß╗Ñc "Lß╗ïch ─æ├ú ho├án th├ánh (n)", mß║Àc ─æß╗ïnh ─æ├│ng; mß╗ƒ ra v├á chß╗ìn thß║╗ ─æß╗â xem lß║íi c├íc m┼®i ─æ├ú ti├¬m cß╗ºa lß╗ïch ─æ├│.
3. Chã░a chß╗ìn lß╗ïch n├áo th├¼ danh s├ích m┼®i chß╗ë gß╗ôm lß╗ïch ─æang chß║íy; lß╗ïch sß╗¡ ti├¬m ─æß║ºy ─æß╗º vß║½n ß╗ƒ SCR-35.
4. SCR-32 theo ß║únh mß║½u TuanPQ duyß╗çt: dropdown "Lß╗ïch ti├¬m" chia nh├│m "─Éang chß║íy" / "─É├ú ho├án th├ánh" (chß╗ë hiß╗çn nh├│m c├│ lß╗ïch; chã░a chß╗ìn hiß╗çn "Chß╗ìn lß╗ïch ti├¬m"), mß║Àc ─æß╗ïnh mß╗ƒ lß╗ïch ─æang chß║íy ─æß║ºu ti├¬n; n├║t "Ôèò Tß║ío lß╗ïch mß╗øi" (c├╣ng cß╗í ├┤ chß╗ìn) ngay b├¬n phß║úi mß╗ƒ form trß╗æng ti├¬u ─æß╗ü "Tß║ío lß╗ïch ti├¬m" (bß╗Å mß╗Ñc "+ Lß╗ïch mß╗øi" trong dropdown); n├║t lã░u "Lã░u lß╗ïch" khi tß║ío, "Lã░u thay ─æß╗òi" khi sß╗¡a, ß║®n khi lß╗ïch ─æ├ú ho├án th├ánh; thß║╗ "Th├┤ng tin lß╗ïch" c├│ nh├ún "─É├ú ho├án th├ánh".

Kh├┤ng lã░u trß║íng th├íi COMPLETED v├áo DB (vß║½n suy ra nhã░ D46): kh├┤ng migration, kh├┤ng ─æß╗òi API. Spec FE-09 SCR-31 mß╗Ñc 4 ─æ├ú cß║¡p nhß║¡t.

### D49 ÔÇö Lß╗ùi ─æiß╗üu kiß╗çn nghiß╗çp vß╗Ñ hiß╗çn popup, lß╗ùi nhß║¡p liß╗çu hiß╗çn dã░ß╗øi ├┤ (23/11/2026)

TuanPQ chß╗æt trong phi├¬n: "tß║Ñt cß║ú c├íc lß╗ùi li├¬n quan ─æß║┐n ─æiß╗üu kiß╗çn bß║»t buß╗Öc phß║úi hiß╗çn popup b├ío, chß╗ë c├íc lß╗ùi vß╗ü validate dß╗» liß╗çu hiß╗çn ─æß╗Å dã░ß╗øi trã░ß╗Øng dß╗» liß╗çu". Ph├ít hiß╗çn khi tß║ío lß╗ïch ti├¬m cho chuß╗ông c├│ b├▓ ─æang chß╗Ø x├íc nhß║¡n chß║┐t: m├án h├¼nh chß╗ë hiß╗çn "Kh├┤ng thß╗â lã░u dß╗» liß╗çuÔÇª" dß║íng d├▓ng ─æß╗Å, kh├┤ng n├│i l├¢ do.

1. **Lß╗ùi ─æiß╗üu kiß╗çn** (b├▓ ─æang chß╗Ø x├íc nhß║¡n chß║┐t / mß║Ñt MSG-COM-17, b├▓ ─æ├ú rß╗Øi ─æ├án MSG-COM-13, lß╗ïch ─æ├ú kh├│a, dß╗» liß╗çu vß╗½a bß╗ï thay ─æß╗òi MSG-COM-05, chã░a chß╗ìn m┼®i, chß╗ìn lß║½n vß║»c-xinÔÇª) hiß╗çn bß║▒ng popup `NoticeDialog` (component d├╣ng chung mß╗øi trong `shared/ui`, n├║t "─É├ú hiß╗âu"), nß╗Öi dung n├│i r├Á ─æß╗æi tã░ß╗úng v├á c├ích xß╗¡ l├¢.
2. **Lß╗ùi nhß║¡p liß╗çu** (bß║»t buß╗Öc, ─æß╗ïnh dß║íng, giß╗øi hß║ín) giß╗» chß╗» ─æß╗Å dã░ß╗øi ─æ├║ng ├┤.
3. ─É├ú ├íp cho FE-09: Quß║ún l├¢ lß╗ïch, Ghi nhß║¡n ti├¬m, popup Sß╗¡a / Hß╗ºy bß║ún ghi ti├¬m, trang Ti├¬m ph├▓ng; MSG-COM-17 / COM-13 c├│ c├óu tiß║┐ng Viß╗çt k├¿m m├ú b├▓ v├á ng├áy.

Phß║ím vi c├íc feature kh├íc (FE-08, FE-10 ÔåÆ FE-12 v├á cß╗ºa th├ánh vi├¬n kh├íc) chã░a ├íp ÔÇô cß║ºn thß╗æng nhß║Ñt vß╗øi nh├│m trã░ß╗øc khi ─æß╗òi ─æß╗ông loß║ít.

### D50 ÔÇö FE-09: "Ng├áy ti├¬m" v├á ─æß╗ìc nghi├¬m ├┤ sß╗æ (23/11/2026)

TuanPQ y├¬u cß║ºu trong phi├¬n: ─æß╗òi "Ng├áy bß║»t ─æß║ºu" th├ánh "Ng├áy ti├¬m" ß╗ƒ SCR-32; "tuyß╗çt ─æß╗æi kh├┤ng tß╗▒ ├¢ lã░u null khi kh├┤ng ─æß╗ìc ─æã░ß╗úc chß╗», phß║úi b├ío lß╗ùi validate dã░ß╗øi c├íc trã░ß╗Øng nhß║¡p".

1. SCR-32 "Ng├áy bß║»t ─æß║ºu" ÔåÆ **"Ng├áy ti├¬m"** (ng├áy dß╗▒ kiß║┐n m┼®i 1); c├íc c├óu b├ío lß╗ùi / kh├│a D46 ─æß╗òi theo. Trã░ß╗Øng API vß║½n l├á `firstDueDate`.
2. Lß╗ùi ph├ít hiß╗çn: ├┤ Sß╗æ m┼®i, C├ích giß╗»a m┼®i, Nhß║»c lß║íi sau (SCR-32) v├á Ngã░ng thß╗ït (SCR-33, popup Sß╗¡a) l├á ├┤ sß╗æ cß╗ºa tr├¼nh duyß╗çt ÔÇô g├Á chß╗» th├¼ tr├¼nh duyß╗çt trß║ú chuß╗ùi rß╗ùng, n├¬n "Nhß║»c lß║íi sau" bß╗ï lã░u null v├á "Ngã░ng thß╗ït" th├ánh 0 ng├áy m├á kh├┤ng b├ío. ─Éß╗òi sang ├┤ chß╗» b├án ph├¡m sß╗æ v├á ─æß╗ìc nghi├¬m (`parseIntField`): ─æß╗â trß╗æng mß╗øi l├á kh├┤ng nhß║¡p; g├Á chß╗», sß╗æ thß║¡p ph├ón, sß╗æ ├óm ÔåÆ chß╗» ─æß╗Å dã░ß╗øi ├┤ ("ÔÇª phß║úi l├á sß╗æ nguy├¬n tß╗½ ÔÇª ─æß║┐n ÔÇª"), kh├┤ng gß╗¡i l├¬n m├íy chß╗º.
3. Backend vß║½n kiß╗âm lß║íi: trã░ß╗Øng sß╗æ nguy├¬n nhß║¡n chß╗» hoß║Àc sß╗æ thß║¡p ph├ón trß║ú 400 (D45), kh├┤ng ─æß╗òi th├ánh null.

### D51 ÔÇö R├á phß║ºn nhß║¡p liß╗çu ch─âm s├│c theo D49 / D50 (FE-08, FE-10, FE-11/12) (23/11/2026)

TuanPQ y├¬u cß║ºu trong phi├¬n: ├íp quy tß║»c D49 (lß╗ùi ─æiß╗üu kiß╗çn ÔåÆ popup, lß╗ùi nhß║¡p liß╗çu ÔåÆ chß╗» ─æß╗Å dã░ß╗øi ├┤) v├á D50 (kh├┤ng ├óm thß║ºm lã░u null / 0 khi g├Á sai) cho c├ón nß║Àng ÔÇô thß╗â trß║íng, sß╗®c khß╗Åe ÔÇô ─æiß╗üu trß╗ï, sinh sß║ún.

1. **FE-08 c├ón nß║Àng ÔÇô thß╗â trß║íng:** ├┤ C├ón nß║Àng, V├▓ng ngß╗▒c, D├ái th├ón ch├®o ─æß╗òi sang ├┤ chß╗» b├án ph├¡m sß╗æ, ─æß╗ìc nghi├¬m (nhß║¡n "325", "325,5", "325.5"); g├Á sai ÔåÆ chß╗» ─æß╗Å dã░ß╗øi ├┤ ("C├ón nß║Àng phß║úi l├á sß╗æ, v├¡ dß╗Ñ 325 hoß║Àc 325,5."), kh├┤ng tß╗▒ t├¡nh c├ón thã░ß╗øc d├óy tß╗½ sß╗æ ─æß╗ìc sai. Lß╗ùi chung cß╗ºa popup Ghi nhß║¡n / Sß╗¡a / X├│a lß║ºn ─æo hiß╗çn bß║▒ng `NoticeDialog`.
2. **FE-10 sß╗®c khß╗Åe ÔÇô ─æiß╗üu trß╗ï:** ├┤ sß╗æ vß╗æn ─æ├ú ─æß╗ìc nghi├¬m; lß╗ùi chung (kh├┤ng gß║»n ├┤) cß╗ºa 5 popup (mß╗ƒ ca, theo d├Ái, ─æiß╗üu trß╗ï, cß║¡p nhß║¡t trß║íng th├íi, sß╗¡a bß║ún ghi) chuyß╗ân sang `NoticeDialog`.
3. **FE-11/12 sinh sß║ún:** kiß╗âm tra sß╗▒ kiß╗çn trß║ú lß╗ùi theo ├┤ (`reproductionIssues`, kh├│a tr├╣ng t├¬n tham sß╗æ backend); lß╗ùi c├│ ├┤ hiß╗çn dã░ß╗øi ├┤ trong popup ghi ─æß╗Öng dß╗Ñc / phß╗æi / kh├ím thai / diß╗àn biß║┐n, lß╗ùi ─æiß╗üu kiß╗çn (b├▓ kh├┤ng c├▓n nu├┤i, kh├┤ng phß║úi b├▓ c├íi, kh├┤ng c├│ thai kß╗│ mß╗ƒÔÇª) hiß╗çn popup. ├ö Sß╗æ th├íng chß╗¡a, C├ón sãí sinh (m├án ghi ─æß║╗) v├á C├ón sãí sinh trong popup Sß╗¡a kß║┐t quß║ú b├¬ ─æß╗òi sang ├┤ chß╗» ─æß╗ìc nghi├¬m ÔÇö sß╗¡a lß╗ùi g├Á chß╗» v├áo c├ón b├¬ khi sß╗¡a bß╗ï gß╗¡i ─æi th├ánh `null` (x├│a c├ón) m├á kh├┤ng b├ío. M├án ghi ─æß║╗ bß╗Å d├▓ng t├│m tß║»t ─æß╗Å: lß╗ùi c├│ ├┤ ─æ├ú ─æß╗Å dã░ß╗øi ├┤, lß╗ùi kh├┤ng gß║»n ├┤ hiß╗çn popup.
4. **Backend:** c├íc trã░ß╗Øng sß╗æ nguy├¬n ngã░ß╗Øi d├╣ng nhß║¡p ÔÇö `estimatedMonths` (kh├ím thai, sß╗¡a sß╗▒ kiß╗çn), `courseDays` / `withdrawalDays` (ghi v├á sß╗¡a ─æiß╗üu trß╗ï), `doseCount` / `intervalDays` / `boosterIntervalMonths` (tß║ío v├á sß╗¡a lß╗ïch ti├¬m) ÔÇö d├╣ng `WholeNumberDeserializer`: gß╗¡i `2.7` hoß║Àc `"3"` trß║ú 400 thay v├¼ bß╗ï cß║»t ngß║ºm th├ánh 2. Kh├┤ng ─æß╗òi route, kh├┤ng migration.

Feature cß╗ºa th├ánh vi├¬n kh├íc chã░a ├íp (chß╗Ø nh├│m thß╗æng nhß║Ñt nhã░ ghi ch├║ ß╗ƒ D49).

### D52 ÔÇö R├║t gß╗ìn ch├║ th├¡ch trong c├íc tab ch─âm s├│c; chß╗æt hai c├óu hß╗Åi c├▓n mß╗ƒ (23/11/2026)

TuanPQ chß╗æt trong phi├¬n:

1. Quß║ún l├¢ lß╗ïch ti├¬m **kh├┤ng** tß╗▒ bß╗Å qua b├▓ ─æang chß╗Ø x├íc nhß║¡n chß║┐t / mß║Ñt khi chß╗ìn theo chuß╗ông: vß║½n b├ío popup (D49) ─æß╗â ngã░ß╗Øi d├╣ng tß╗▒ bß╗Å con ─æ├│ ra.
2. Quy tß║»c popup / lß╗ùi dã░ß╗øi ├┤ (D49, D51) **kh├┤ng** tß╗▒ ├íp cho feature cß╗ºa th├ánh vi├¬n kh├íc.
3. Hß║ín chß║┐ chß╗» thß╗½a: giß╗» gß╗úi ├¢ gi├║p nhß║¡p ─æ├║ng (khoß║úng gi├í trß╗ï, ─æãín vß╗ï, khi n├áo bß║»t buß╗Öc); bß╗Å hoß║Àc r├║t ngß║»n c├óu giß║úi th├¡ch lß║Àp lß║íi ti├¬u ─æß╗ü hay n├│i c├ích hß╗ç thß╗æng hoß║ít ─æß╗Öng. ├üp cho FE-08 ÔåÆ FE-12, v├¡ dß╗Ñ:
   - SCR-32: bß╗Å "C├íc ─æiß╗üu kiß╗çn kß║┐t hß╗úp vß╗øi nhau (V├Ç)"; d├▓ng dã░ß╗øi ti├¬u ─æß╗ü tß╗½ "Lß╗ïch ti├¬m Th├íng 11 ┬À ─æang chß║íy tß╗½ 23/11/2026" th├ánh "─Éang chß║íy" / "─É├ú ho├án th├ánh" (t├¬n lß╗ïch ─æ├ú ß╗ƒ ├┤ chß╗ìn lß╗ïch); ghi ch├║ kh├│a / sß╗¡a lß╗ïch r├║t c├▓n mß╗Öt c├óu.
   - FE-08: bß╗Å "Chß╗ë vß║¢ bß║ún ghi hß╗úp lß╗ç", "thang trß║íi v1", c├┤ng thß╗®c c├ón thã░ß╗øc d├óy trong gß╗úi ├¢ ├┤.
   - FE-10: gß╗úi ├¢ sß╗æ ng├áy ─æiß╗üu trß╗ï c├▓n "1 ÔÇô 30 ng├áy"; bß╗Å "Lß║Ñy tß╗½ danh mß╗Ñc, c├│ thß╗â sß╗¡a", "─Éã░ß╗úc lã░u th├ánh 1 lß║ºn theo d├Ái".
   - FE-11/12: bß╗Å ch├║ th├¡ch c├ích ─æß╗ìc d├▓ng thß╗Øi gian, c├ích t├¡nh cß╗¡a sß╗ò phß╗æi, cãí sß╗ƒ ng├áy dß╗▒ kiß║┐n; chß║┐ ─æß╗Ö chß╗ë xem ghi "Chß║┐ ─æß╗Ö chß╗ë xem."
   - Trß║íng th├íi trß╗æng bß╗Å c├óu phß╗Ñ khi ti├¬u ─æß╗ü ─æ├ú ─æß╗º ngh─®a.

Chß╗ë ─æß╗òi chß╗» hiß╗ân thß╗ï, kh├┤ng ─æß╗òi dß╗» liß╗çu, API hay quy tß║»c.

### D53 ÔÇö FE-09: Sß╗¡a / X├│a bß║ún ghi ti├¬m t├ích nhã░ FE-08; bß║ún ghi ─æ├ú x├│a kh├┤ng hiß╗çn (23/11/2026)

TuanPQ chß╗æt trong phi├¬n: "bß║ún ghi ─æ├ú hß╗ºy thß║¡t ra c┼®ng l├á x├│a v├¼ chß║│ng c├│ ├¢ ngh─®a theo d├Ái g├¼"; "popup sß╗¡a v├á x├│a c┼®ng thß╗â hiß╗çn tã░ãíng tß╗▒ nhã░ b├¬n c├ón nß║Àng, x├│a th├¼ chß╗ë hiß╗çn popup x├íc nhß║¡n t├ích hß║│n kh├┤ng d├╣ng chung vß╗øi sß╗¡a". L├ám theo D43 (FE-08), kh├íc R-09-14 / UC-FE09-08 c┼®:

1. Tab Ti├¬m ph├▓ng (SCR-34) c├│ hai n├║t ri├¬ng **Sß╗¡a** v├á **X├│a** thay cho "Sß╗¡a ┬À Hß╗ºy" v├á ├┤ chß╗ìn h├ánh ─æß╗Öng trong popup.
2. Popup **Sß╗¡a bß║ún ghi ti├¬m** chß╗ë ─æß╗â sß╗¡a gi├í trß╗ï; "L├¢ do *" ─æß╗òi th├ánh **Ghi ch├║** kh├┤ng bß║»t buß╗Öc (Ôëñ 500), ─æiß╗ün sß║Án ghi ch├║ lß║ºn sß╗¡a gß║ºn nhß║Ñt.
3. **X├│a** l├á popup x├íc nhß║¡n "X├│a m┼®i ti├¬m?", kh├┤ng c├│ ├┤ l├¢ do. Ph├¡a m├íy chß╗º vß║½n l├á x├│a mß╗üm (`POST ÔÇª/void`, trß║íng th├íi `VOIDED`): m┼®i theo lß╗ïch quay lß║íi chã░a ti├¬m (R-09-14), ng├áy hß║┐t ngã░ng thß╗ït t├¡nh lß║íi, Record Revision vß║½n lã░u trã░ß╗øc / sau, ngã░ß╗Øi v├á thß╗Øi ─æiß╗âm (BR-D15).
4. Bß║ún ghi `VOIDED` **kh├┤ng c├▓n** trong lß╗ïch sß╗¡ ti├¬m cß╗ºa b├▓ (SCR-34) v├á lß╗ïch sß╗¡ to├án ─æ├án (SCR-35): `CareReadService.vaccinationHistory` lß╗ìc bß╗Å; kh├┤ng c├▓n d├▓ng mß╗Ø "(─æ├ú hß╗ºy)".

Backend: `VaccinationCommandService` sß╗¡a / x├│a d├╣ng `RecordRevisionService.recordWithOptionalNote`; `reason` trß╗æng lã░u `null`, > 500 vß║½n trß║ú MSG-COM-10. Kh├┤ng migration (`status_reason`, `record_revision.reason` ─æ├ú cho ph├®p null), kh├┤ng ─æß╗òi route; `reason` trong OpenAPI vß╗æn kh├┤ng ─æ├ính dß║Ñu bß║»t buß╗Öc. Dß╗½ng lß╗ïch (A5) vß║½n bß║»t buß╗Öc l├¢ do.

### D54 ÔÇö FE-19: v├áo thß║│ng Tß╗òng quan sau khi thanh to├ín (23/11/2026)

DucNV (chß╗º FE-19) chß╗æt trong phi├¬n: khi BeefCare nhß║¡n trß║íng th├íi PAID, chß╗º trß║íi ─æã░ß╗úc ─æã░a thß║│ng v├áo Tß╗òng quan cß╗ºa ─æ├║ng trß║íi; popup "Thanh to├ín th├ánh c├┤ng" hiß╗çn mß╗Öt lß║ºn tß║íi ─æ├│, k├¿m m├ú thanh to├ín v├á kß╗│ dß╗ïch vß╗Ñ; bß║Ñm Tiß║┐p tß╗Ñc ─æß╗â ─æ├│ng popup v├á ß╗ƒ lß║íi Tß╗òng quan; ├íp dß╗Ñng cho cß║ú mua lß║ºn ─æß║ºu v├á gia hß║ín. Nß║┐u trß║íi ─æang tß║ím ngã░ng hoß║Àc chã░a thß╗â truy cß║¡p, popup vß║½n x├íc nhß║¡n ─æ├ú thanh to├ín, n├¬u l├¢ do v├á cho thß╗¡ v├áo lß║íi. L├ám kh├íc SRS 28/10 (UC-FE19-02 AF4, SCR-59 "Enter farm / Back to subscription": gia hß║ín vß╗ü SCR-57; MSG-FE19-06 kiß╗âu Toast):

1. SCR-59 bß╗Å n├║t "V├áo trß║íi" / "Vß╗ü g├│i dß╗ïch vß╗Ñ". Mß╗ùi lß║ºn ─æß╗ìc ─æã░ß╗úc `PAID` (tß╗▒ tß║úi, Kiß╗âm tra lß║íi, tß║úi lß║íi sau hß╗ºy bß╗ï tß╗½ chß╗æi, mß╗ƒ lß║íi hã░ß╗øng dß║½n cß╗ºa y├¬u cß║ºu ─æ├ú PAID), m├án hiß╗çn "─Éang v├áo trß║íiÔÇª" v├á kiß╗âm trß║íi mß╗Öt lß║ºn qua bã░ß╗øc cß╗ºa SCR-09 (FE-02 A5). Trß║íi `ACTIVE` ÔåÆ lã░u trß║íi cho tab v├á nß║íp lß║íi v├áo SCR-48, thay SCR-59 trong lß╗ïch sß╗¡ tab.
2. MSG-FE19-06 ─æß╗òi tß╗½ toast sang hß╗Öp thoß║íi tr├¬n SCR-48 cß╗ºa ─æ├║ng trß║íi, chß╗ë cho Owner, mß╗Öt lß║ºn (giß╗» trong sessionStorage cß╗ºa tab, ─æß╗ìc xong th├¼ x├│a). Mß╗ƒ SCR-48 trß╗▒c tiß║┐p kh├┤ng hiß╗çn. Kh├┤ng lã░u ─æã░ß╗úc x├íc nhß║¡n th├¼ vß║½n v├áo trß║íi, chß╗ë thiß║┐u hß╗Öp thoß║íi.
3. Kh├┤ng v├áo ─æã░ß╗úc ÔåÆ hß╗Öp thoß║íi MSG-FE19-06 tr├¬n SCR-59 k├¿m nguy├¬n nh├ón, [Thß╗¡ v├áo trß║íi lß║íi] v├á [─É├│ng x├íc nhß║¡n] (vß╗ü m├án nguß╗ôn). Trß║íi kh├┤ng `ACTIVE` (vd. ─æ├ú thanh to├ín nhã░ng vß║½n SUSPENDED theo R-19-11) ÔåÆ Owner ─æß╗ìc MSG-FE02-03; tß╗½ nay mß╗ìi chß╗ù d├╣ng bã░ß╗øc v├áo trß║íi cß╗ºa SCR-09 vß╗øi Owner (cß║ú qu├®t QR) ─æß╗üu hiß╗çn MSG-FE02-03 thay v├¼ MSG-FE02-04 "Vui l├▓ng li├¬n hß╗ç Chß╗º trß║íi".

─Éi k├¿m: chß╗ë frontend; kh├┤ng ─æß╗òi API, DTO, OpenAPI hay DB, kh├┤ng c├│ lß╗çnh ghi mß╗øi. Spec FE-19 (UC-FE19-02, SCR-59 #3 / #7 / #8 / #10, MSG-FE19-06, TC-19-108, TC-19-110 ÔåÆ 112) v├á FE-15 (SCR-48 #10) ─æ├ú cß║¡p nhß║¡t; SRS chã░a sß╗¡a.

### D55 ÔÇö FE-06 / FE-12: b├¬ sinh tß║íi trß║íi ÔÇô bß╗æ mß║╣ chß╗ë ─æß╗ìc v├á b├¬ kh├┤ng sß╗æng (23/11/2026)

AnNT (chß╗º FE-06) chß╗æt trong phi├¬n ng├áy 22ÔÇô23/11/2026: theo SRS (UC-FE06-01 bã░ß╗øc 4, AF1, GBR-31, GBR-93) v├á R-06-18, dß╗» liß╗çu sinh cß╗ºa b├¬ sinh tß║íi trß║íi lß║Ñy tß╗½ lß║ºn ─æß║╗ v├á **chß╗ë ─æß╗ìc** ß╗ƒ phiß║┐u nhß║¡p.

1. **Bß╗æ mß║╣ chß╗ë ─æß╗ìc.**
   - Mß║╣ = b├▓ mß║╣ cß╗ºa lß║ºn ─æß║╗.
   - Bß╗æ = ─æß╗▒c giß╗æng / nguß╗ôn tinh cß╗ºa lß║ºn phß╗æi li├¬n kß║┐t thai. Kh├┤ng c├│ th├¼ "Kh├┤ng r├Á" (R-12-12).
   - Gß╗í lß╗çnh `POST /pending-calves/{calfId}/parentage`: route trß║ú 405 cho client c┼® v├á kh├┤ng c├▓n trong OpenAPI. M├án SCR-25 kh├┤ng c├▓n ├┤ chß╗ìn b├▓ mß║╣, b├▓ bß╗æ, nguß╗ôn tinh.
   - Phiß║┐u chß╗ë chß╗ìn kß║┐t quß║ú b├¬ nguß╗ôn, kh├┤ng tß║ío d├▓ng b├¬ trß╗▒c tiß║┐p thiß║┐u lß║ºn ─æß║╗. Payload phiß║┐u kh├┤ng ─æã░ß╗úc ghi ─æ├¿ bß╗æ mß║╣ hoß║Àc dß╗» liß╗çu sinh tß╗½ nguß╗ôn.
   - Ghi sai bß╗æ mß║╣ th├¼ sß╗¡a bß║ún ghi nguß╗ôn: lß║ºn phß╗æi hoß║Àc lß║ºn ─æß║╗ theo FE-11 / FE-12 (R-12-15, c├│ l├¢ do, version). Kh├┤ng sß╗¡a ß╗ƒ phiß║┐u nhß║¡p.
2. **Dß╗» liß╗çu c┼® kh├┤ng x├│a.**
   - Cß╗Öt `assigned_dam_id`, `assigned_sire_id`, `assigned_sire_source`, `assigned_external_sire_code` cß╗ºa `calf_outcome` giß╗» nguy├¬n, kh├┤ng migration.
   - Backend th├┤i ─æß╗ìc c├íc cß╗Öt n├áy khi hiß╗çn b├¬ chß╗Ø v├á khi ghi sß╗ò.
   - B├▓ ─æ├ú ─æ─âng k├¢ trã░ß╗øc ─æ├óy giß╗» nguy├¬n cha mß║╣ ─æ├ú lã░u tr├¬n hß╗ô sãí b├▓.
3. **B├¬ sinh ra nhã░ng kh├┤ng sß╗æng** c├│ ba trã░ß╗Øng hß╗úp, kh├┤ng th├¬m trß║íng th├íi mß╗øi:
   - **Chß║┐t khi sinh**: ghi ß╗ƒ lß║ºn ─æß║╗, kß║┐t quß║ú b├¬ `STILLBORN` (FE-12 ┬º3.5). Giß╗øi t├¡nh ─æã░ß╗úc "Kh├┤ng r├Á", kh├┤ng c├ón bß║»t buß╗Öc. Kh├┤ng bao giß╗Ø ─æ─âng k├¢, kh├┤ng tß║ío hß╗ô sãí b├▓, kh├┤ng v├áo danh s├ích b├¬ chß╗Ø (R-06-19, MSG-FE06-04). Lß║ºn ─æß║╗ vß║½n ─æ├│ng thai CALVED.
   - **Sß╗æng l├║c sinh, chß║┐t trã░ß╗øc khi ─æ─âng k├¢**: ß╗ƒ danh s├ích b├¬ chß╗Ø (SCR-25), "─É├ính dß║Ñu chß║┐t trã░ß╗øc ─æ─âng k├¢", bß║»t buß╗Öc l├¢ do (A12, R-06-20, R-12-13). Kß║┐t quß║ú b├¬ **giß╗» LIVE**, trß║íng th├íi ─æ─âng k├¢ `DIED_BEFORE_REGISTRATION`, REM-09 ─æã░ß╗úc giß║úi quyß║┐t. Kh├┤ng tß║ío hß╗ô sãí b├▓, kh├┤ng lß║¡p phiß║┐u xuß║Ñt. Kh├┤ng ho├án t├íc ─æã░ß╗úc n├¬n phß║úi qua hß╗Öp thoß║íi x├íc nhß║¡n.
   - **─É├ú ─æ─âng k├¢ rß╗ôi chß║┐t**: l├á b├▓ trong ─æ├án, ghi bß║▒ng phiß║┐u xuß║Ñt loß║íi chß║┐t (FE-13) nhã░ mß╗ìi con b├▓ kh├íc.
   - Sß╗¡a nhß║ºm "chß║┐t khi sinh" Ôåö "sß╗æng" chß╗ë l├ám ─æã░ß╗úc ß╗ƒ lß║ºn ─æß║╗ khi b├¬ chã░a ─æ─âng k├¢ v├á chã░a ─æ├ính dß║Ñu chß║┐t trã░ß╗øc ─æ─âng k├¢ (R-12-13, R-12-15).

### D56 ÔÇö C├ái ─æß║Àt t├ái khoß║ún d├╣ng chung v├á chuyß╗ân trß║íi nhanh (23/11/2026)

Chß╗º dß╗▒ ├ín x├íc nhß║¡n cß║¡p nhß║¡t t├ái liß╗çu theo h├ánh vi giao diß╗çn ─æ├ú chß╗æt, giß╗» nguy├¬n hß╗ç thß╗æng m├ú cß╗ºa SRS 28/10:

1. Kh├┤ng tß║ío `UC-FE01-04A` hoß║Àc `SCR-08A`. `SCR-08` vß║½n l├á m├án h├¼nh logic **C├ái ─æß║Àt**, nhã░ng ─æã░ß╗úc mß╗ƒ bß║▒ng popup d├╣ng chung tß╗½ menu t├ái khoß║ún sau khi ngã░ß╗Øi d├╣ng ─æ─âng nhß║¡p; kh├┤ng c├▓n trang hß╗ô sãí ─æß╗Öc lß║¡p c├│ thanh ─æiß╗üu hã░ß╗øng ri├¬ng. Popup c├│ header **C├ái ─æß║Àt**, sidebar hai mß╗Ñc **Hß╗ô sãí** v├á **Quyß╗ün theo vai tr├▓**, v├╣ng nß╗Öi dung cuß╗Ön ─æß╗Öc lß║¡p v├á c├íc khß╗æi Bento s├íng. C├íc route hß╗ô sãí c┼® chuyß╗ân vß╗ü trang ph├╣ hß╗úp vß╗øi phi├¬n. Ri├¬ng `/tai-khoan` l├á route callback tã░ãíng th├¡ch v├á giß╗» query mß╗ƒ popup khi c├│.
2. Mß╗Ñc Hß╗ô sãí chß╗ë sß╗¡a hß╗ì t├¬n v├á sß╗æ ─æiß╗çn thoß║íi li├¬n hß╗ç; email v├á phã░ãíng thß╗®c ─æ─âng nhß║¡p chß╗ë ─æß╗ìc. N├║t **Lã░u thay ─æß╗òi** nß║▒m trong khß╗æi Th├┤ng tin c├í nh├ón v├á kh├┤ng y├¬u cß║ºu x├íc thß╗▒c lß║íi mß║¡t khß║®u. ─Éß╗òi hoß║Àc th├¬m mß║¡t khß║®u vß║½n theo UC-FE01-06 / D07. N├║t **X├íc minh bß║▒ng Google** bß║»t ─æß║ºu OAuth; x├íc minh c├│ hiß╗çu lß╗▒c 5 ph├║t trong session. Callback ─æi qua `/tai-khoan?m=doi-mat-khau&googleReauthenticated=true`; route tã░ãíng th├¡ch giß╗» query, chuyß╗ân vß╗ü trang ph├╣ hß╗úp vß╗øi phi├¬n v├á mß╗ƒ lß║íi SCR-08 c├╣ng popup con. Sau x├íc minh chß╗ë hß╗Åi mß║¡t khß║®u mß╗øi v├á x├íc nhß║¡n, kh├┤ng hß╗Åi mß║¡t khß║®u hiß╗çn tß║íi.
3. Mß╗Ñc Quyß╗ün theo vai tr├▓ l├á bß║úng tham khß║úo cß╗æ ─æß╗ïnh Table III-2 cho Owner, Manager v├á Technician, kh├┤ng phß╗Ñ thuß╗Öc membership hoß║Àc trß║íi hiß╗çn tß║íi, kh├┤ng cß║Ñp quyß╗ün v├á kh├┤ng gß╗ìi API quyß╗ün membership. C├íc d├▓ng `NO` ─æã░ß╗úc ß║®n; API quyß╗ün membership giß╗» lß║íi ─æß╗â tã░ãíng th├¡ch.
4. Mß╗ìi khung giao diß╗çn ─æ├ú ─æ─âng nhß║¡p d├╣ng c├╣ng menu avatar + hß╗ì t├¬n vß╗øi ─æ├║ng hai mß╗Ñc **Hß╗ô sãí cß╗ºa t├┤i** v├á **─É─âng xuß║Ñt**. **Hß╗ô sãí cß╗ºa t├┤i** mß╗ƒ popup SCR-08 tß║íi trang hiß╗çn tß║íi; **─É─âng xuß║Ñt** kß║┐t th├║c phi├¬n v├á x├│a trß║íi ─æang chß╗ìn.
5. Trong kh├┤ng gian trß║íi, t├¬n trß║íi tr├¬n thanh tr├¬n c├╣ng mß╗ƒ bß╗Ö chuyß╗ân nhanh. Chß╗ìn trß║íi `ACTIVE` kiß╗âm lß║íi quyß╗ün / trß║íng th├íi, x├│a dß╗» liß╗çu v├á bß╗Ö lß╗ìc trß║íi trã░ß╗øc rß╗ôi mß╗ƒ trang chß╗º ─æ├║ng vai tr├▓; chß╗ìn trß║íi kh├┤ng `ACTIVE` hoß║Àc **Quß║ún l├¢ trang trß║íi** mß╗ƒ SCR-09.

ß║ónh hã░ß╗ƒng: cß║¡p nhß║¡t SRS UC-FE01-04, UC-FE02-02, SCR-08, SCR-09, quy ã░ß╗øc thanh tr├¬n c├╣ng v├á ch├║ th├¡ch Table III-2; cß║¡p nhß║¡t spec FE-01 / FE-02 v├á test case tã░ãíng ß╗®ng. ─É├óy l├á thay ─æß╗òi ─æiß╗üu hã░ß╗øng v├á tr├¼nh b├áy quyß╗ün, kh├┤ng ─æß╗òi schema dß╗» liß╗çu hay h├¼nh dß║íng API hß╗ô sãí / danh s├ích trß║íi.

### D57 ÔÇö T├ái khoß║ún Google phß║úi chß║Ñp thuß║¡n ─æiß╗üu khoß║ún BeefCare (23/11/2026)

Chß╗º dß╗▒ ├ín chß╗æt bß╗ò sung bã░ß╗øc chß║Ñp thuß║¡n sau Google OAuth: Google chß╗ë x├íc minh danh t├¡nh/email, kh├┤ng thay ngã░ß╗Øi d├╣ng ─æß╗ông ├¢ ─Éiß╗üu khoß║ún sß╗¡ dß╗Ñng v├á Ch├¡nh s├ích dß╗» liß╗çu cß╗ºa BeefCare.

1. T├ái khoß║ún c├│ phã░ãíng thß╗®c Google v├á `termsAccepted = false` phß║úi thß║Ñy popup **─Éiß╗üu khoß║ún v├á ch├¡nh s├ích** trã░ß╗øc mß╗ìi chß╗®c n─âng ─æ├ú ─æ─âng nhß║¡p. Ngã░ß╗Øi d├╣ng email ─æ├ú chß║Ñp thuß║¡n trong popup l├║c ─æ─âng k├¢ v├á t├ái khoß║ún Google ─æ├ú chß║Ñp thuß║¡n kh├┤ng bß╗ï hß╗Åi lß║íi.
2. D├╣ng mß╗Öt popup v─ân bß║ún chung c├│ hai tab ─Éiß╗üu khoß║ún sß╗¡ dß╗Ñng v├á Ch├¡nh s├ích dß╗» liß╗çu, checkbox v├á n├║t **─Éß╗ông ├¢ v├á x├íc nhß║¡n**. ─É─âng k├¢ email chß╗ë gß╗ìi API sau khi form hß╗úp lß╗ç v├á ngã░ß╗Øi d├╣ng x├íc nhß║¡n trong popup; lß╗ùi tß║ím thß╗Øi giß╗» popup c├╣ng dß║Ñu tick ─æß╗â thß╗¡ lß║íi, c├▓n ─æ├│ng hoß║Àc tß║úi lß║íi sß║¢ y├¬u cß║ºu tick lß║íi. ─É├│ng popup ß╗ƒ luß╗ông Google sß║¢ ─æ─âng xuß║Ñt. Kh├┤ng bß║»t buß╗Öc cuß╗Ön hß║┐t nß╗Öi dung.
3. `POST /api/account/terms-acceptance` chß╗ë ─æß║Àt `termsAccepted = true` v├á `termsAcceptedAt` ß╗ƒ lß║ºn ─æß║ºu; gß╗ìi lß║íi giß╗» nguy├¬n thß╗Øi ─æiß╗âm. Kh├┤ng ho├án tß║Ñt ─æ─âng k├¢ Owner, kh├┤ng tß║ío trß║íi/membership, kh├┤ng cß║Ñp vai tr├▓ hoß║Àc g├│i.
4. Khi chã░a chß║Ñp thuß║¡n, backend vß║½n cho ─æß╗ìc hß╗ô sãí, lß║Ñy CSRF, chß║Ñp thuß║¡n v├á ─æ─âng xuß║Ñt; API nghiß╗çp vß╗Ñ kh├íc trß║ú `403` + `MSG-FE01-14` nhã░ng kh├┤ng hß╗ºy phi├¬n. OAuth redirect ã░u ti├¬n `/chap-nhan-dieu-khoan` trã░ß╗øc luß╗ông Owner/chß╗ìn trß║íi; frontend kiß╗âm lß║íi profile ─æß╗â kh├┤ng phß╗Ñ thuß╗Öc ri├¬ng redirect.
5. D├╣ng hai cß╗Öt hiß╗çn c├│ `terms_accepted`, `terms_accepted_at`; chã░a th├¬m phi├¬n bß║ún ─æiß╗üu khoß║ún hoß║Àc migration. Khi c├│ quy tr├¼nh ban h├ánh nhiß╗üu phi├¬n bß║ún sß║¢ quyß║┐t ─æß╗ïnh migration v├á luß╗ông chß║Ñp thuß║¡n lß║íi ri├¬ng.

### D58 ÔÇö FE-10: gß╗Öp "Ghi theo d├Ái" v├á "Cß║¡p nhß║¡t / ─É├│ng ca" th├ánh "Cß║¡p nhß║¡t ca bß╗çnh"; Mß╗ƒ ca kh├┤ng c├▓n nß╗æi v├áo ca ─æang c├│ (23/11/2026)

TuanPQ duyß╗çt ─æß╗út 1 cß╗ºa bß║ún ─æ├ính gi├í FE-10. Hai popup c┼® dß║½m ch├ón nhau (ngã░ß╗Øi d├╣ng kh├┤ng biß║┐t l├║c n├áo bß║Ñm "Ghi theo d├Ái", l├║c n├áo bß║Ñm "Cß║¡p nhß║¡t trß║íng th├íi"), v├á "Th├¬m v├áo ca ─æang c├│" ß╗ƒ popup Mß╗ƒ ca tr├╣ng viß╗çc vß╗øi ch├║ng. L├ám kh├íc UC-FE10-03 (hai popup) v├á UC-FE10-02 bã░ß╗øc chß╗ìn ca cß╗ºa SRS 28/10:

1. Thß║╗ ca chß╗ë c├▓n hai n├║t: **Ghi ─æiß╗üu trß╗ï** v├á **Cß║¡p nhß║¡t ca bß╗çnh**.
2. Popup **Cß║¡p nhß║¡t ca bß╗çnh**: thß╗Øi ─æiß╗âm, th├ón nhiß╗çt, diß╗àn biß║┐n, m├┤ tß║ú, chß║®n ─æo├ín / cß╗Ø truyß╗ün nhiß╗àm, trß║íng th├íi ca (Giß╗» / Chuyß╗ân mß║ín t├¡nh hoß║Àc Mß╗ƒ lß║íi / ─É├│ng ca ÔåÆ kß║┐t quß║ú, ngã░ß╗Øi x├íc nhß║¡n). Mß╗Öt thß╗Øi ─æiß╗âm d├╣ng cho lß║ºn theo d├Ái, ng├áy mß║ín t├¡nh v├á l├║c ─æ├│ng ca. Giß╗» trß║íng th├íi ÔåÆ phß║ºn theo d├Ái bß║»t buß╗Öc; ─æß╗òi trß║íng th├íi ÔåÆ t├╣y chß╗ìn, c├│ nhß║¡p ├┤ n├áo th├¼ cß║ºn ─æß╗º diß╗àn biß║┐n v├á m├┤ tß║ú (giß╗» D35, kh├┤ng tß╗▒ ─æiß╗ün diß╗àn biß║┐n). Lß╗ùi nhß║¡p liß╗çu dã░ß╗øi ├┤, lß╗ùi ─æiß╗üu kiß╗çn popup (D49).
3. Phß║ºn theo d├Ái v├á trß║íng th├íi lã░u **trong mß╗Öt giao dß╗ïch** qua A5 (`POST ÔÇª/health-cases/{id}/status` th├¬m `observedAt`, `temperatureC`); kh├┤ng gß╗ìi hai API li├¬n tiß║┐p tß╗½ giao diß╗çn.
4. Popup **Mß╗ƒ ca** lu├┤n mß╗ƒ ca mß╗øi (mß╗Öt b├▓ c├│ thß╗â c├│ nhiß╗üu ca ÔÇô GBR-45). B├▓ ─æang c├│ ca th├¼ popup nhß║»c m├ú ca v├á c├│ n├║t "Cß║¡p nhß║¡t ca ÔÇª" chuyß╗ân sang ─æ├║ng ca.
5. Backend vß║½n nhß║¡n `existingCaseId` ß╗ƒ A3 v├á giß╗» A4 (`/observations`) ─æß╗â kh├┤ng ─æß╗òi hß╗úp ─æß╗ông; giao diß╗çn kh├┤ng d├╣ng nß╗»a. Kh├┤ng migration.

Spec FE-10 ─æ├ú cß║¡p nhß║¡t: UC-FE10-02/03, R-10-01, SCR-37 d├▓ng 7, popup Mß╗ƒ ca d├▓ng 8, popup Cß║¡p nhß║¡t ca bß╗çnh (thay popup Ghi theo d├Ái v├á Cß║¡p nhß║¡t / ─É├│ng ca), A3ÔÇôA5, TC-10-04/05/07/27/29.

### D59 ÔÇö FE-10: ghi ─æiß╗üu trß╗ï cho ca theo d├Ái d├ái hß║ín c├│ thß╗â giß╗» trß║íng th├íi (23/11/2026)

TuanPQ duyß╗çt ─æß╗út 2 cß╗ºa bß║ún ─æ├ính gi├í FE-10. GBR-45 cho ca CHRONIC tß╗▒ vß╗ü OPEN mß╗ùi khi ghi ─æiß╗üu trß╗ï, khiß║┐n ─æiß╗üu trß╗ï duy tr├¼ (vitamin, thuß╗æc bß╗ò, kh├íng vi├¬m ─æß╗ïnh kß╗│) ─æß║®y ca vß╗ü ─Éang mß╗ƒ v├á ngã░ß╗Øi d├╣ng phß║úi chuyß╗ân lß║íi.

1. Popup Ghi ─æiß╗üu trß╗ï cß╗ºa ca CHRONIC c├│ ├┤ **"Chuyß╗ân ca vß╗ü ─Éang mß╗ƒ (bß╗Å chß╗ìn nß║┐u chß╗ë ─æiß╗üu trß╗ï duy tr├¼)"**, mß║Àc ─æß╗ïnh chß╗ìn (giß╗» h├ánh vi SRS).
2. Bß╗Å chß╗ìn ÔåÆ ca giß╗» CHRONIC; sß╗®c khß╗Åe cß╗ºa b├▓ l├á "Theo d├Ái" (kh├┤ng phß║úi "─Éang ─æiß╗üu trß╗ï"); ng├áy ngã░ng thß╗ït vß║½n t├¡nh tß╗½ ─æiß╗üu trß╗ï (GBR-46 kh├┤ng phß╗Ñ thuß╗Öc trß║íng th├íi ca).
3. A6 th├¬m `returnToOpen?` (thiß║┐u = `true`); kh├┤ng migration, phß║ún hß╗ôi `returnedToOpen` giß╗» nguy├¬n. Thay MSG-FE10-10 bß║▒ng ├┤ chß╗ìn n├áy.

### D60 ÔÇö FE-10: trß║íng th├íi ca hiß╗ân thß╗ï bß║▒ng tiß║┐ng Viß╗çt, "Theo d├Ái d├ái hß║ín" thay "mß║ín t├¡nh" (23/11/2026)

TuanPQ y├¬u cß║ºu thuß║¡t ngß╗» s├ít ngh─®a tiß║┐ng Viß╗çt v├á giao diß╗çn ho├án to├án tiß║┐ng Viß╗çt. SRS ─æß╗ïnh ngh─®a CHRONIC l├á *long-term monitoring* ÔÇô trß║íng th├íi quß║ún l├¢ ca, kh├┤ng phß║úi chß║®n ─æo├ín "bß╗çnh mß║ín t├¡nh".

1. Nh├ún: `OPEN` ÔåÆ **─Éang mß╗ƒ**, `CHRONIC` ÔåÆ **Theo d├Ái d├ái hß║ín**, `CLOSED` ÔåÆ **─É├ú ─æ├│ng** (huy hiß╗çu: "─Éang mß╗ƒ ┬À ng├áy n", "Theo d├Ái d├ái hß║ín ┬À tß╗½ dd/mm/yyyy", "─É├ú ─æ├│ng ┬À Khß╗Åi"); tab danh s├ích "Theo d├Ái d├ái hß║ín (n)".
2. H├ánh ─æß╗Öng: "Chuyß╗ân theo d├Ái d├ái hß║ín", "Chuyß╗ân vß╗ü ─æang mß╗ƒ" (kh├┤ng d├╣ng "Mß╗ƒ lß║íi" ─æß╗â d├ánh cho viß╗çc mß╗ƒ lß║íi ca ─æ├ú ─æ├│ng ß╗ƒ ─æß╗út 4).
3. M├ú trong DB / API / code giß╗» nguy├¬n `OPEN`, `CHRONIC`, `CLOSED`; chß╗ë ─æß╗òi chß╗» hiß╗ân thß╗ï (mß╗Öt nguß╗ôn `CASE_STATUS_LABEL`). Spec FE-10 ─æß╗òi theo, gß╗ôm c├íc chß╗ù viß║┐t "m├ún t├¡nh".

### D61 ÔÇö FE-10: th├ón nhiß╗çt ngo├ái 35ÔÇô43 ┬░C hß╗Åi x├íc nhß║¡n thay v├¼ chß║Àn (23/11/2026)

TuanPQ duyß╗çt: 35ÔÇô43 ┬░C l├á ngã░ß╗íng cß║ºn kiß╗âm tra lß║íi, kh├┤ng phß║úi giß╗øi hß║ín sinh l├¢; b├▓ hß║í th├ón nhiß╗çt hoß║Àc sß╗æt cao vß║½n phß║úi ghi ─æã░ß╗úc.

1. Ngo├ái **30,0ÔÇô45,0 ┬░C** ÔåÆ chß║Àn, lß╗ùi dã░ß╗øi ├┤ MSG-FE10-06 (sß╗æ g├Á nhß║ºm, v├¡ dß╗Ñ `395`, `3,9`). Frontend v├á backend c├╣ng kiß╗âm.
2. Trong 30,0ÔÇô45,0 nhã░ng ngo├ái **35,0ÔÇô43,0 ┬░C** ÔåÆ popup "Kiß╗âm tra lß║íi th├ón nhiß╗çt" (MSG-FE10-06a) vß╗øi n├║t "Kiß╗âm tra lß║íi" / "X├íc nhß║¡n lã░u". ─É├óy l├á bã░ß╗øc tr├¬n giao diß╗çn; API kh├┤ng th├¬m trã░ß╗Øng.
3. ─Éß╗â trß╗æng ÔåÆ vß║½n lã░u. Sß╗¡a ├┤ th├ón nhiß╗çt th├¼ lß╗ùi c┼® cß╗ºa ├┤ biß║┐n mß║Ñt (trã░ß╗øc ─æ├óy lß╗ùi ─æß╗Å c├▓n sau khi x├│a trß╗æng ├┤).
4. ├üp dß╗Ñng ß╗ƒ Mß╗ƒ ca sß╗®c khß╗Åe, Cß║¡p nhß║¡t ca bß╗çnh, Sß╗¡a bß║ún ghi theo d├Ái. Kh├┤ng l├ám khoß║úng tham chiß║┐u theo nh├│m b├▓.

### D62 ÔÇö FE-10 / FE-13: mß╗ƒ lß║íi ca sß╗®c khß╗Åe ─æ├ú ─æ├│ng; b├íc phiß║┐u chß║┐t / mß║Ñt th├¼ mß╗ƒ lß║íi ca (23/11/2026)

TuanPQ duyß╗çt ─æß╗út 4 cß╗ºa bß║ún ─æ├ính gi├í FE-10; chß╗º FE-13 ─æß╗ông ├¢. Trã░ß╗øc ─æ├óy ca ─æ├ú ─æ├│ng kh├┤ng mß╗ƒ lß║íi ─æã░ß╗úc (─æ├│ng nhß║ºm phß║úi mß╗ƒ ca mß╗øi, lß╗ïch sß╗¡ bß╗ï t├ích), v├á b├íc phiß║┐u chß║┐t / mß║Ñt ─æß╗â b├▓ ACTIVE nhã░ng ca vß║½n ghi "Chß║┐t".

1. **Mở lại ca** (FE-10, nút ở bảng "Các ca trước", popup lý do bắt buộc ≤ 500): ca về Đang mở, xóa kết quả / ngày đóng / người xác nhận / "theo dõi dài hạn từ"; lưu Record Revision hành động `REOPEN` và nhật ký `HEALTH_CASE_REOPEN`.
2. Điều kiện: **Khỏi** → bò còn nhận sự kiện; **Chết / Mất tích** → bò còn trong đàn, phiếu PENDING của ca bị bác (lý do = lý do mở lại, REM-12 giải quyết) trong cùng transaction; phiếu đã xác nhận → bò EXITED → MSG-COM-13; **CLOSED_BY_EXIT** → không bao giờ (MSG-COM-05). Ca Khỏi: Owner và Manager (MANAGE_HEALTH); ca Chết / Mất tích: **chỉ Owner** vì phải bác phiếu xuất (MANAGE_EXIT_VOUCHERS, GBR-34) – TuanPQ chốt.
3. **Bác phiếu chết / mất PENDING** (FE-13) → ca nguồn mở lại cùng lý do, thông báo MSG-FE13-10. Thay "ca giữ kết quả" của GBR-95 / R-13-09.
4. API `POST …/health-cases/{caseId}/reopen` (`reason`, `expectedVersion`); A2 trả thêm `version` cho ca đã đóng. Không migration. Một lớp dùng chung `HealthCaseReopener` cho cả hai đường.

### D63 ÔÇö Dß╗ìn form nhß║¡p b├▓ mua ngo├ái SCR-24 (23/11/2026)

An chß╗æt theo brief PR-K, ├íp dß╗Ñng cho popup th├¬m / sß╗¡a con cß╗ºa phiß║┐u mua ngo├ái:

1. Chß╗ë nhß║¡p **Th├íng sinh (ã░ß╗øc t├¡nh)**; c├│ th├íng gß╗¡i ng├áy 01 v├á ESTIMATED, trß╗æng gß╗¡i UNKNOWN. Nh├íp / Excel c├│ EXACT giß╗» nguy├¬n ng├áy ─æß║ºy ─æß╗º v├á ─æß╗Ö ch├¡nh x├íc khi kh├┤ng sß╗¡a th├íng.
2. Chß╗ë mß╗Öt ├┤ **C├ón nhß║¡p (kg)**, kh├┤ng chß╗ìn cãí sß╗ƒ c├ón. C├│ c├ón nhß║¡p tay gß╗¡i MEASURED, kh├┤ng c├ón gß╗¡i null. D├▓ng ESTIMATED tß╗½ Excel / nh├íp c┼® giß╗» nguy├¬n nß║┐u kh├┤ng ─æß╗òi sß╗æ c├ón; ─æß╗òi sß╗æ c├ón chuyß╗ân MEASURED. ─É├óy l├á ─æiß╗üu chß╗ënh y├¬u cß║ºu chß╗ìn Weight basis cß╗ºa popup trong SRS; Excel vß║½n giß╗» cß╗Öt cãí sß╗ƒ c├ón v├á bß║úng vß║½n hiß╗çn UT.
3. Theo con chß╗ë mß╗Öt ├┤ **Gi├í con (─æ)** lã░u v├áo unitPrice; theo kg nhß║¡p ─æãín gi├í v├á hiß╗çn th├ánh tiß╗ün chß╗ë ─æß╗ìc. Kh├┤ng g├ín trã░ß╗øc gi├í hoß║Àc th├íng sinh cho con mß╗øi. Gi├í lu├┤n nhß║¡p ─æã░ß╗úc.
4. Cß║únh b├ío cß╗ºa t├│m tß║»t SCR-24 v├á ti├¬u ch├¡ chuß╗ông trong popup hiß╗çn ─æß╗Å nhã░ng vß║½n kh├┤ng chß║Àn lã░u; lß╗ùi dß╗» liß╗çu / sß╗®c chß╗®a vß║½n kiß╗âm nhã░ trã░ß╗øc.
5. Con mß╗øi chß╗ë v├áo phiß║┐u sau khi lã░u popup; hß╗ºy kh├┤ng ─æß╗â d├▓ng rß╗ùng. Con ─æ├ú c├│ trong nh├íp lu├┤n ─æã░ß╗úc x├│a sau x├íc nhß║¡n, kß╗â cß║ú chã░a c├│ m├ú b├▓. Thß║╗ tai t├╣y chß╗ìn (tß╗æi ─æa 30), nhß║»c bß╗ò sung ─æß║Àc ─æiß╗âm khi chã░a c├│ thß║╗.
6. Mß╗Ñc ─æ├¡ch nu├┤i lß║Ñy danh mß╗Ñc ACTIVE theo ID v├á purposeType, giß╗øi hß║ín SIRE cho ─æß╗▒c v├á BREEDING cho c├íi. C├ích ly nhß║¡p ─æ├án l├á ng├áy theo d├Ái ri├¬ng sau mua, kh├íc c├ích ly thß╗ït; kh├┤ng trã░ß╗øc ng├áy nhß║¡p, c├│ +14/+21 ng├áy, phß║úi giß╗» qua mß╗ƒ lß║íi nh├íp v├á hiß╗çn tr├¬n hß╗ô sãí khi c├▓n hiß╗çu lß╗▒c.

Kh├┤ng ─æß╗òi backend, OpenAPI, migration, nhß║¡p Excel, sß╗¡a hß╗ô sãí FE-05 hay nghiß╗çp vß╗Ñ b├¬ sinh tß║íi trß║íi. C├íc ─æiß╗üu kiß╗çn backend v├á giß╗øi hß║ín field hiß╗çn h├ánh tiß║┐p tß╗Ñc ├íp dß╗Ñng.

### D64 — FE-10: mã ca sức khỏe đếm theo trại (24/11/2026)

SRS §3.2 và spec FE-10: mã ca `HC-nnnn`, duy nhất trong trại. Code cũ lấy ID toàn hệ thống (`HC-` + 6 chữ số), nên trại mới có vài ca đã thấy HC-008001 và số nhảy cóc theo các trại khác.

1. Mã ca lấy từ bộ đếm theo trại như các mã nghiệp vụ khác (`CodeSequenceService`, loại `HEALTH_CASE`, BR-D34): `HC-0001`, `HC-0002`…; không đặt lại theo năm; quá 9999 thì dài thêm.
2. Ca tạo trước giữ nguyên mã (đã hiện ở phiếu xuất, nhắc việc, lịch sử). Số mới trùng một mã cũ trong trại thì lấy số kế tiếp.
3. Không migration: `code_sequence.code_type` là chuỗi, không có ràng buộc danh sách.

### D65 — FE-10 / FE-18: liều thuốc số + đơn vị; số ngày dùng; "Ghi chú" thay "Lời khuyên thú y" (24/11/2026)

TuanPQ duyệt, chủ FE-18 đồng ý. Liều là chữ tự do ("30ml", "30 cc", "3 ống"), liều tham chiếu của thuốc dài tới 100 ký tự trong khi ô Liều khi ghi điều trị chỉ 50, thuốc chưa có đường dùng bị tự điền "Khác", ghi chú chung của thuốc hiện như "Tham chiếu" liều, và Tiêm phòng đã nhập số + đơn vị.

1. **Liều = số + đơn vị** (ml, lít, mg, g, viên, gói, liều) cho ghi / sửa điều trị và liều tham chiếu của thuốc; vẫn lưu một chuỗi ("30 ml", tối đa 50) nên không đổi API / DB. Không làm liều theo thể trọng trong ô liều (TuanPQ chốt): ghi ở Ghi chú của thuốc; liều điều trị là lượng thực tế mỗi lần. Liều cũ không theo chuẩn hiện nguyên văn và giữ nguyên nếu người dùng không nhập lại.
2. Liều tham chiếu chỉ điền sẵn khi đường dùng trùng đường của thuốc; đổi đường khác thì bỏ liều điền sẵn và báo "Liều tham chiếu chỉ áp cho …". Thuốc chưa có đường dùng thì để trống.
3. "Liệu trình (ngày)" → **"Số ngày dùng (mỗi ngày 1 lần)"** kèm "Tổng: liều × số ngày"; "Mũi cuối" → **"Ngày dùng cuối"** (đúng GBR-46: một đợt cùng thuốc, liều, đường mỗi ngày một lần).
4. "Lời khuyên thú y" → **"Ghi chú"** (gợi ý: lời dặn của thú y, phản ứng sau dùng thuốc); API giữ `veterinaryAdvice`. Ghi chú của thuốc hiện "Ghi chú thuốc: …" dưới ô Thuốc.
5. Danh mục thuốc gợi ý: thuốc nhiều dạng (tiêm / uống) tạo mỗi dạng một mục, vì liều và ngày ngưng thịt khác nhau.

### D66 — FE-10 / FE-09: màn danh sách Sức khỏe & Điều trị và bảng mũi Tiêm phòng theo Bento (24/11/2026)

TuanPQ: màn danh sách rối, các khối giống nhau, màu không mang thông tin, bo góc không thống nhất, rời rạc. Màn Sức khỏe để **xem ca nào cần chú ý và đi tới hồ sơ bò**; không ghi nhận trực tiếp.

1. **SCR-36** một hàng 3 khối (5 + 4 + 3): **Ca chưa đóng** (khối nổi bật, số đang mở / đang điều trị, thanh tỷ lệ theo mức độ Nặng · Trung bình · Nhẹ); **khối cảnh báo** xanh nhạt "Không có ca cần xử lý gấp" hoặc đỏ nhạt "Cần chú ý ngay" khi có ca nặng / nghi truyền nhiễm, ba dòng ca nặng (nút Xem lọc ngay) · nghi truyền nhiễm · đang điều trị; **Theo dõi dài hạn**. Không có ô "Đã đóng trong kỳ" (không giúp việc trước mắt).
2. Tab gạch chân, bộ lọc (tìm, mức độ, chuồng – cùng kiểu ô) và bảng gom trong **một khối**. Kỳ chỉ hiện ở tab Đã đóng / Tất cả. Bảng gộp cột Chuồng vào dòng phụ của Bò, vạch màu đầu dòng theo mức độ, nền đỏ nhạt khi nghi truyền nhiễm, cả dòng bấm được (chuột, Enter / Space) mở tab Sức khỏe của bò. Mọi khối bo 16, ô điều khiển bo 12.
3. **Sửa lỗi:** tab Theo dõi dài hạn trước đây bị lọc theo kỳ – nay luôn hiện đủ như Đang mở.
4. A1 `counts` (Map) thêm `treating`, `severe`, `moderate`, `mild`, `contagious` cho ca chưa đóng; không đổi schema OpenAPI, không migration.
5. **Tiêm phòng (SCR-31):** giữ phần trên (thẻ lịch, nút); khối danh sách mũi làm cùng kiểu – tab gạch chân, bộ lọc, thanh "Ghi nhận n mũi đã chọn" và bảng trong một khối; cột Chuồng gộp vào dòng phụ của Bò; vạch màu đầu dòng theo hạn tiêm (quá hạn đỏ, đến hạn vàng, đã tiêm xanh); trạng thái trống nằm trong khối.

### D67 — FE-11 / FE-12: xác nhận có thai bằng quan sát, tiêu chí sau đẻ, gọn khung phối (24/11/2026)

TuanPQ duyệt sau khi đánh giá bản nhận xét luồng Sinh sản. Trại nhỏ không có siêu âm nên bò phối xong kẹt ở "Đã phối", không có ngày đẻ dự kiến và không vào nhóm sắp đẻ.

1. **Khám thai bằng quan sát:** thêm phương pháp `OBSERVATION` "Quan sát – không lên giống lại". Thẻ "Lần phối gần nhất" (bò Đã phối) có nút **"Xác nhận có thai (quan sát)"** từ ngày thứ 21 sau phối, mở popup Ghi khám thai điền sẵn Có thai + Quan sát + lần phối liên kết. Vẫn là một lần khám CÓ THAI nên đúng GBR-51 / R-11-06; không tự suy ra mang thai, không migration.
2. **Điều kiện phối (GBR-55, chỉ cảnh báo):** bò đã từng đẻ thêm tiêu chí "Sau đẻ ≥ N ngày" (`POSTPARTUM_INTERVAL`, N = tham số Sau sinh, mặc định 45). Bò chỉ thiếu lần cân thì huy hiệu tổng "Cần cân lại" (vàng); quy tắc cân giữ như chốt 15/11/2026.
3. **Lên giống giả khi mang thai:** R-11-04 giữ chặn; MSG-FE11-05 chỉ đường ghi ở Diễn biến thai (loại Theo dõi).
4. **Khung phối:** giữ khung giờ theo tham số trại (REM-02), bỏ thanh 24 giờ, chỉ hiện một dòng chữ.
5. Không làm: rút còn 3 trạng thái, nới quy tắc không làm mồ côi (sửa trường không gây mâu thuẫn vẫn làm được), gộp hai spec – thay bằng bảng tham chiếu chéo ở đầu FE-11 và FE-12.

### D68 — FE-11 / FE-12: tab Sinh sản (SCR-39) theo Bento, tránh loạn thông tin (24/11/2026)

TuanPQ: khối trạng thái là bảng số dày đặc, nhiều ô "—" và "0", thông tin lặp (ngày sau đẻ, cân gần nhất), không rõ việc tiếp theo.

1. **Khối trạng thái (nổi bật, 7/12):** chỉ tên trạng thái (lớn), "từ ngày", một ô **việc tiếp theo** theo trạng thái – Chờ phối: theo dõi lên giống; Động dục: cửa sổ phối gợi ý; Đã phối: số ngày đã phối và ngày khám được; Mang thai: ngày dự kiến đẻ, còn n ngày (thanh tiến độ); Sau sinh: ngày n / 45 và ngày phối lại được (thanh tiến độ) – rồi các nút ghi.
2. **Khối ngữ cảnh (5/12)** đổi theo trạng thái: Điều kiện xét phối (Chờ phối / Động dục / Sau sinh) dạng danh sách gọn, xanh nhạt khi đạt hết, vàng nhạt khi chỉ còn điều kiện "chờ được" (chưa cân lại, chưa đủ ngày sau đẻ), đỏ nhạt khi chưa đạt tuổi / cân / có ca bệnh; Lần phối gần nhất (Đã phối); Thai kỳ hiện tại (Mang thai).
3. **Chỉ số sinh sản** thành khối trắng riêng, chỉ hiện chỉ số đã có giá trị (không "—"); đặt cạnh Lịch sử sinh bê khi bò đã đẻ. Bỏ khỏi khối trạng thái các ô lặp (ngày sau đẻ, cân gần nhất – cân nằm trong điều kiện phối). Khối Cửa sổ phối riêng gộp vào khối trạng thái.

### D69 — FE-11 / FE-12: Sửa / Xóa bản ghi sinh sản tách riêng như Cân nặng và Tiêm phòng (24/11/2026)

TuanPQ: dòng thời gian Sinh sản làm giống các phần khác (D43 FE-08, D53 FE-09).

1. Dòng thời gian có hai nút riêng **Sửa** và **Xóa** (thay "Sửa · Hủy"); popup không còn ô chọn hành động.
2. Popup **Sửa**: bảng giá trị hiện tại / mới; "Lý do *" → **Ghi chú** không bắt buộc (≤ 500).
3. **Xóa**: popup xác nhận "Xóa … ?" kèm câu ảnh hưởng, không có ô lý do; vẫn hỏi lại khi bản ghi đang được liên kết (động dục có phối liên kết, khám đang xác nhận thai) và vẫn chặn khi làm mồ côi bản ghi sau (MSG-FE11-07). Phía máy chủ vẫn là xóa mềm (`VOIDED`) có Record Revision.
4. Bản ghi `VOIDED` không hiện ở dòng thời gian sinh sản.
5. Backend `ReproductionCommandService`: ghi chú trống lưu `null`, > 500 → MSG-COM-10; dùng `RecordRevisionService.recordWithOptionalNote`. Không migration (`status_reason` cho phép null), không đổi route.

### D70 — FE-11 / FE-12: bỏ "Nguồn dữ liệu" khỏi giao diện Sinh sản (24/11/2026)

TuanPQ: ghi trực tiếp hay ghi bù từ sổ tay thì ý nghĩa vẫn là lưu một sự kiện; phân biệt thêm chỉ tốn thời gian đọc và gây rối. Đã kiểm: `dataSource` không tham gia quy tắc, nhắc việc hay chỉ số nào (chỉ được lưu).

1. Bỏ ô "Nguồn dữ liệu" ở popup Ghi phối, Ghi khám thai, Ghi diễn biến thai, màn Ghi đẻ và các popup Sửa; bỏ cột "Nguồn dữ liệu" ở dòng thời gian sinh sản.
2. Mọi bản ghi mới lưu `DIRECT_OBSERVATION` (mặc định sẵn có của backend khi không gửi). Bản ghi cũ giữ giá trị đã lưu.
3. Không đổi API / DB: `dataSource` vẫn là trường tùy chọn của A1–A8, không migration. Lệch SRS (Data source của các popup sinh sản) – ghi nhận tại đây.

### D71 — FE-11 / FE-12: màn danh sách Sinh sản theo Bento; popup Xóa báo thẳng; gọn popup ghi (24/11/2026)

1. **Danh sách Sinh sản (SCR-38)** cùng khung với Sức khỏe (D66): một hàng 3 khối – **Việc cần làm** (nổi bật: động dục cần phối, đến hạn khám thai, sắp đẻ 30 ngày, mỗi dòng có "Xem" mở tab tương ứng), **Cần chú ý** (đỏ nhạt khi có bò chưa đủ điều kiện phối / quá hạn thụ thai, xanh nhạt khi không), **Đang mang thai**. Tab gạch chân, bộ lọc và bảng gom trong một khối; tab mặc định là tab đầu tiên có bò theo thứ tự việc gấp; cột Giống / Chuồng gộp vào dòng phụ của Bò; vạch vàng đầu dòng khi có việc tới hạn; trạng thái trống không lồng khung.
2. **Popup Xóa** (D69): bản ghi đang có bản ghi phụ thuộc (động dục có phối liên kết, phối có khám thai, khám đã xác nhận thai có diễn biến / lần đẻ, lần đẻ có bê đã đăng ký) → báo thẳng "Không xóa được: …" và chỉ có nút Đóng, thay cho hỏi "Vẫn xóa?" rồi bị máy chủ từ chối.
3. **Popup ghi sinh sản:** bỏ ô "Bò cái" chỉ đọc (lặp dòng phụ; dòng phụ thêm số tai); "Mô tả (không bắt buộc)" → "Mô tả". Không hiện khung phối trong popup vì giao diện không có tham số giờ phối của trại; khung phối chính xác hiện ở khối trạng thái sau khi lưu.
