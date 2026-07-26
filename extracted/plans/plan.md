# Pelan Penambahbaikan Jarvis (Jarvis Improvement Plan)

Dokumen ini merangkumi pelan strategik dan teknikal untuk menaik taraf Jarvis (AI Assistant) dalam Local Pocket Reader agar menjadi lebih responsif, pintar, dan berautonomi.

## Visi
Meningkatkan Jarvis daripada sebuah bot sembang (chatbot) yang bersifat pasif kepada pembantu web proaktif yang mempunyai memori jangka panjang, pemahaman semantik yang mendalam, dan kebolehan mengendalikan penyemak imbas (browser-use capabilities).

---

## 1. Carian Semantik (Semantic Search) untuk RAG
**Matlamat:** Menggantikan pemadanan kata kunci tradisional dengan carian berasaskan vektor untuk meningkatkan ketepatan konteks.

### TODO:
- [ ] Kaji selidik perpustakaan embedding tempatan yang ringan (cth: `@xenova/transformers.js`) atau sediakan integrasi API luar (cth: OpenAI Embeddings / Gemini Embeddings).
- [ ] Cipta utiliti `vectorStorageCore.js` untuk memproses dan menyimpan (index) vektor apabila artikel disimpan.
- [ ] Ubah suai fungsi `extractRagKeywords` di dalam `jarvisSidebar.js` untuk menanyakan pangkalan data vektor dan bukannya carian `[a-z0-9]+` asas.
- [ ] Lakukan ujian ketepatan respons Jarvis ke atas koleksi 50+ artikel.

---

## 2. Sokongan Berbilang Model (Multi-Provider Support)
**Matlamat:** Membenarkan pengguna memilih model otak Jarvis (Claude, ChatGPT, Ollama) dan tidak lagi dikunci pada Gemini.

### TODO:
- [ ] Buang halangan `PROVIDER = "gemini"` dari dalam `jarvisSidebar.js`.
- [ ] Kemas kini antara muka komunikasi background (`background.js`) supaya Jarvis boleh menghantar payload khusus untuk format API pembekal yang dipilih.
- [ ] Tambah pilihan "Jarvis AI Brain" pada muka tetapan (`options.html` / `settings.js`).
- [ ] Sediakan panduan prompt (system prompt) yang selari untuk semua pembekal agar tingkah laku Jarvis konsisten.

---

## 3. Interaksi Pelbagai Modaliti (Suara & Penglihatan)
**Matlamat:** Membolehkan arahan suara dan pemahaman berasaskan imej/tangkapan skrin.

### TODO:
- [ ] **Voice I/O:** DIBUANG — *Web Speech API* (`SpeechRecognition`) tidak disokong di Firefox. (Berfungsi di Chrome/Edge sahaja; pengguna guna Firefox.)
- [x] **TTS:** Provider "Read Aloud" (suara neural) dicuba dulu bila dalam pandangan AI; dalam pandangan sembang (iframe tersembunyi, autoplay disekat) terus guna *SpeechSynthesis* OS sebagai sumber bunyi boleh dipercayai. Edge TTS dibuang.
- [x] **Vision:** Guna API `chrome.tabs.captureVisibleTab` di dalam `background.js` untuk mengambil tangkapan skrin elemen jika pengguna meminta Jarvis menganalisis jadual atau imej.
- [x] Masukkan sokongan muat naik base64 ke dalam penjana prompt Jarvis.

---

## 4. Tindakan Autonomi Lanjutan (Agentic DOM Actions)
**Matlamat:** Jarvis boleh melakukan navigasi laman, mengisi borang, atau melakukan tindakan *browser-use* secara bebas.

### TODO:
- [ ] Perkasakan skrip suntikan DOM (`jarvisOverlay.js` / jambatan aktif) supaya ia dapat mengenali struktur form dan butang secara semantik.
- [ ] Bina "Planning Engine" (enjin perancangan langkah demi langkah) yang lebih kukuh di mana Jarvis menyenaraikan `[TINDAKAN 1] -> [TINDAKAN 2]` sebelum melaksanakannya.
- [ ] Tingkatkan dialog "Pra-Tonton Pelan" (`jarvisPreviewPlan`) supaya pengguna boleh menyemak senarai tindakan UI yang Jarvis ingin jalankan, dan membenarkannya (Approve/Reject).

---

## 5. Memori Jangka Panjang & Persona (Long-Term Memory)
**Matlamat:** Jarvis mengingati tabiat dan arahan dari interaksi lalu, mengubah suai responsnya dari semasa ke semasa.

### TODO:
- [x] Naik taraf `LocalPocketMemoryLayers` (`core/memoryLayers.js`) untuk menyimpan profil tabiat secara berstruktur (JSON Graf Pengetahuan).
- [x] Cipta modul `memoryExtractor.js` yang akan menilai sejarah sembang (chat history) setiap hujung minggu/sesi dan mengekstrak fakta penting (cth: "Pengguna suka kod Python").
- [x] Suntik ringkasan "Fakta Pengguna" secara automatik ke dalam System Prompt Jarvis.

---

## 6. Sintesis Rentas Tab (Cross-Tab Synthesis)
**Matlamat:** Bekerja di pelbagai tab aktif secara berterusan (pengurusan tab lanjutan).

### TODO:
- [ ] Tambah kebolehan membaca (scrape) 3-4 tab aktif serentak dan membuat perbandingan secara selari.
- [ ] Tambah arahan tindakan berkaitan tab dalam API Jarvis (contoh: `closeTabs(array)`, `groupTabs(name, array)`).
- [ ] Pastikan respons tidak melebihi saiz Token Limit dengan melakukan chunking apabila melibatkan banyak tab yang panjang.
