# VaseFirma AI Asistent

AI asistent pro zaměstnaneckou aplikaci **Vaše Firma** od Munipolis. Widget se embeduje na web vasefirma.munipolis.cz a odpovídá zaměstnancům na dotazy ohledně firemní aplikace, modulů, funkcí a procesů.

---

## Živé URL

| Co | URL |
|----|-----|
| Produkce | https://vasefirma-ai.vercel.app |
| Demo stránka | https://vasefirma-ai.vercel.app/demo |
| GitHub repo | https://github.com/dpeterek-muni/vasefirma-ai |
| Health check | https://vasefirma-ai.vercel.app/api/health |

---

## Jak to funguje

```
Zaměstnanec napíše dotaz ve widgetu
        ↓
POST /api/query  (Vercel serverless)
        ↓
1. Dotaz → OpenAI Embedding (text-embedding-3-small)
2. Embedding → Pinecone vector search (top 10 dokumentů)
3. Relevantní dokumenty + dotaz → GPT-4o-mini
4. Odpověď ← zpět do widgetu
```

**Technologie:**
- **Frontend:** Embeddable widget (vanilla JS, Shadow DOM, ~33 KB)
- **Backend:** Vercel Serverless Functions (Node.js)
- **Vector DB:** Pinecone (index `vasefirma-docs`, 132 vektorů, 1536 dims)
- **LLM:** OpenAI GPT-4o-mini + text-embedding-3-small
- **Data:** Zpracováno z `Data pro Benchmark.xlsx` (6 sheetů)

---

## Embed kód

Pro přidání widgetu na jakoukoliv stránku stačí vložit jeden řádek:

```html
<script src="https://vasefirma-ai.vercel.app/widget.js" data-company="vasefirma"></script>
```

### Volitelné atributy

```html
<script
  src="https://vasefirma-ai.vercel.app/widget.js"
  data-company="vasefirma"
  data-color="#564fd8"
  data-position="bottom-right"
></script>
```

| Atribut | Výchozí | Popis |
|---------|---------|-------|
| `data-company` | `vasefirma` | Identifikátor firmy |
| `data-color` | `#564fd8` | Hlavní barva widgetu |
| `data-position` | `bottom-right` | Pozice: `bottom-right` nebo `bottom-left` |
| `data-preview` | `false` | `true` = widget se otevře automaticky |

---

## Struktura projektu

```
vasefirma/
├── api/
│   ├── query.js        ← Hlavní RAG endpoint (Pinecone + GPT)
│   ├── config.js       ← Konfigurace widgetu (barvy, texty)
│   ├── feedback.js     ← Thumbs up/down hodnocení
│   └── health.js       ← Health check
├── lib/
│   └── pinecone-rest.js ← Pinecone REST klient (bez npm závislostí)
├── public/
│   ├── widget.js       ← Embeddable chat widget
│   ├── demo.html       ← Demo stránka
│   └── index.html      ← Landing page
├── scripts/
│   └── ingest-excel.js ← Import dat z Excelu do Pinecone
├── package.json
├── vercel.json         ← Vercel deployment config
└── .env                ← API klíče (NIKDY NECOMMITOVAT!)
```

---

## API Endpointy

### POST /api/query
Hlavní endpoint — položí dotaz a vrátí odpověď.

**Request:**
```json
{
  "question": "Jaké moduly aplikace nabízí?",
  "sessionId": "volitelné",
  "chatHistory": [
    { "text": "předchozí dotaz", "isUser": true },
    { "text": "předchozí odpověď", "isUser": false }
  ]
}
```

**Response:**
```json
{
  "answer": "Aplikace nabízí následující moduly: ...",
  "sources": [
    { "source": "Moduly aplikace - Benefity", "score": 0.65 }
  ],
  "documentsFound": 10,
  "topScore": 0.65,
  "tokensUsed": 2500
}
```

### GET /api/config
Vrací konfiguraci widgetu (barvy, quick replies, texty).

### POST /api/feedback
Přijímá hodnocení odpovědí (`rating: "up"` nebo `"down"`).

### GET /api/health
Vrací `{ "status": "ok" }`.

---

## Znalostní báze

Data pochází z `C:\Users\Daniel\Downloads\Data pro Benchmark.xlsx`:

| Sheet | Obsah |
|-------|-------|
| Vzor zadávačka Munipolis | Parametry a přínosy modulů |
| Zadávačka Denso | Specifikace pro 2000+ uživatelů |
| Zadávačka Orkla | Požadavky na 1000+ uživatelů |
| Výkop Munipolis | Detailní popis funkcí a přínosů |
| CORP přehled modulů | 30+ modulů s popisy |
| CORP přehled modulů - final | Finální verze modulů |

**Celkem:** 132 vektorových chunků v Pinecone indexu `vasefirma-docs`.

### Přidání nových dat

```bash
# Přenačtení dat z Excelu
node scripts/ingest-excel.js

# Nebo z jiného souboru
node scripts/ingest-excel.js "cesta/k/souboru.xlsx"
```

---

## Bezpečnost

- **Rate limiting:** 30 dotazů/min/IP
- **CORS:** Omezen na `vasefirma.munipolis.cz` a `vasefirma-ai.vercel.app`
- **Input validace:** Max 2000 znaků, typová kontrola
- **Prompt injection obrana:** Systémový prompt odmítá manipulaci
- **Žádné interní chyby** se nezobrazují uživatelům
- **Shadow DOM:** Widget je izolovaný od hostitelské stránky

---

## Environment Variables (Vercel)

Na Vercelu jsou nastaveny:

| Proměnná | Popis |
|----------|-------|
| `OPENAI_API_KEY` | OpenAI API klíč |
| `PINECONE_API_KEY` | Pinecone API klíč |
| `PINECONE_INDEX_NAME` | `vasefirma-docs` |

---

## Lokální vývoj

```bash
cd vasefirma
npm install
npx vercel dev    # Spustí lokální server na http://localhost:3000
```

## Deploy

```bash
npx vercel --prod   # Deploy na produkci
```

Nebo automaticky přes GitHub — při push na `master` se Vercel automaticky buildne.

---

## Vztah k AIA projektu

Tento projekt je adaptace widgetu z [dpeterek-muni/AIA](https://github.com/dpeterek-muni/AIA) (AI Asistent pro obce). Hlavní rozdíly:

| | AIA (obce) | VaseFirma (firmy) |
|---|---|---|
| Cílová skupina | Občané obce | Zaměstnanci firmy |
| Data | Webové stránky obcí (scraping) | Excel s firemními moduly |
| Pinecone index | `municipalities` | `vasefirma-docs` |
| Barva | Modrá (#0066CC) | Fialová (#564fd8) |
| API endpoint | `/api/chat` | `/api/query` |
| Multi-tenant | Ano (100+ obcí) | Single-tenant (demo) |

---

## Kontakt

- **Repo:** https://github.com/dpeterek-muni/vasefirma-ai
- **Vercel dashboard:** https://vercel.com/daniels-projects-5acf86be/vasefirma-ai
