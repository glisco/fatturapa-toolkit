# FatturaPA Toolkit — Lettore `.xml` / `.xml.p7m`, Controllo errori SdI e Calcolatore Bollo

Libreria TypeScript **zero-dependency** (funziona identica nel browser, in Node.js e nelle estensioni Chrome MV3) sviluppata da **[Glisco s.n.c.](https://www.glisco.it)** ed estratta dagli strumenti gratuiti di **[FatturaEconomica](https://fatturaeconomica.it)** — il servizio italiano di fatturazione elettronica gratuito fino a 100 fatture al mese, senza SPID.

## Usalo subito online (100% nel browser, nessun file inviato ai server)

- **[Visualizzatore fattura elettronica XML e P7M](https://fatturaeconomica.it/visualizzatore-fattura-elettronica)** — apri file `.xml` e buste firmate `.xml.p7m` CAdES, scarica gli allegati interni e stampa il PDF di cortesia. Disponibile anche come **[estensione sul Chrome Web Store](https://chromewebstore.google.com/detail/bdbfhebkdeimmfbdmihhfjpkmncabjfl)**.
- **[Controllo formale fattura XML pre-invio SdI](https://fatturaeconomica.it/controllo-fattura-xml)** — intercetta prima dell'invio gli errori di scarto più frequenti ([`00305`](https://fatturaeconomica.it/errori-sdi/00305), `00306`, [`00311`](https://fatturaeconomica.it/errori-sdi/00311), `00400`, `00419`, `00421`, `00422`, bollo mancante sopra 77,47 €, incongruenze del regime forfettario [`RF19`](https://fatturaeconomica.it/codici/rf19-regime-forfettario) / `N2.2`).
- **[Calcolatore bollo trimestrale FatturaPA](https://fatturaeconomica.it/calcolatore-bollo)** — calcola importi, rinvio automatico sotto la soglia cumulativa di 5.000 € (D.L. 73/2022), slittamenti festivi italiani e codici tributo F24 (`2521`–`2524`).

---

## Cosa contiene questo repository

| Modulo | File | Descrizione |
|---|---|---|
| **Estrazione `.p7m` e vista FatturaPA** | [`src/fatturapaViewer.ts`](src/fatturapaViewer.ts) | Estrae il payload XML da buste crittografiche PKCS#7 / CMS CAdES-BES (`.xml.p7m`) sia **DER** sia **BER a lunghezza indefinita (`0x80 … 0x00 0x00`) con `OCTET STRING` costruite a blocchi** (tipiche di InfoCert, Aruba, BouncyCastle), oltre a file `.p7m` codificati Base64/PEM e doppie buste `.p7m.p7m`. Espone un albero tipizzato completo (`FatturaView`: cedente, cliente, righe, cassa, ritenuta, riepiloghi IVA, bollo, pagamenti/IBAN, allegati). |
| **Controlli formali SdI** | [`src/fatturapaCheck.ts`](src/fatturapaCheck.ts) | Riproduce lato client i principali controlli del Sistema di Interscambio (specifiche FatturaPA 1.9): Luhn partita IVA italiana (`00301`, `00305`), formato codice fiscale (`00306`), `CodiceDestinatario` a 6/7 caratteri (`00311`), coerenza aliquota/natura (`00400`, `00401`, `00429`, `00430`, `00445`), quadratura righe-riepiloghi (`00419`, `00421`, `00422`), data futura (`00403`), verifiche su regime forfettario `RF19`, nota di credito `TD04` e differita `TD24`. |
| **Bollo trimestrale** | [`src/bolloTrimestrale.ts`](src/bolloTrimestrale.ts) | Calcolo delle scadenze trimestrali del bollo virtuale da 2 € (D.M. 17/06/2014 art. 6), regola cumulativa dei 5.000 € su Q1 e Q1+Q2, festività nazionali italiane + Lunedì dell'Angelo (algoritmo di Meeus) e codici tributo F24. |
| **Estensione Chrome MV3** | [`chrome-extension/`](chrome-extension/) | Estensione Manifest V3 pronta da caricare in Chrome/Brave/Edge (`chrome://extensions` → *Modalità sviluppatore* → *Carica estensione non pacchettizzata* → seleziona la cartella `chrome-extension/`). Zero permessi richiesti, funziona interamente offline. |

---

## Esempio d'uso in TypeScript / JavaScript

```ts
import {
  extractXmlFromBytes,
  parseFatturaXmlView,
  checkFattura,
  bolloPlan,
} from "./src";

// 1. Apri un file .xml oppure una busta firmata .xml.p7m
const bytes = new Uint8Array(await file.arrayBuffer());
const { xml, wasSigned, error } = extractXmlFromBytes(bytes);

if (!error) {
  const { invoices } = parseFatturaXmlView(xml);
  console.log("Firmata P7M:", wasSigned, "Totale:", invoices[0]?.importoTotaleDocumento);

  // 2. Verifica errori di scarto SdI (nel browser)
  const esiti = checkFattura(xml);
  console.log(esiti);
}

// 3. Piano di versamento bollo trimestrale
const piano = bolloPlan(2026, { 1: 10, 2: 12, 3: 8, 4: 15 });
console.log(piano.total, piano.payments);
```

## Eseguire i test

```bash
npm install
npm test
npm run typecheck
```

---

## Documentazione di riferimento (su fatturaeconomica.it)

- [Tutti i codici di scarto SdI spiegati con causa e soluzione](https://fatturaeconomica.it/errori-sdi):
  - [Errore SdI 00305 — Partita IVA non valida](https://fatturaeconomica.it/errori-sdi/00305)
  - [Errore SdI 00311 — Codice destinatario non valido](https://fatturaeconomica.it/errori-sdi/00311)
- [Tabella completa codici FatturaPA: TD, Natura IVA N1–N7, Regimi RF01–RF20, Pagamenti MP](https://fatturaeconomica.it/codici):
  - [Codice RF19 — Regime forfettario nella fattura elettronica](https://fatturaeconomica.it/codici/rf19-regime-forfettario)
- [Guida pratica alla fattura elettronica nel regime forfettario (RF19, N2.2, bollo)](https://fatturaeconomica.it/guide/fattura-elettronica-forfettario)
- [Scadenze bollo fatture elettroniche e codici tributo F24](https://fatturaeconomica.it/scadenze/bollo-fattura-elettronica-trimestrale)
- [Osservatorio errori SdI](https://fatturaeconomica.it/osservatorio-errori-sdi)

## Licenza

Rilasciato con licenza [MIT](LICENSE) — © Glisco s.n.c. di Paolo e Michele Comitini ([fatturaeconomica.it](https://fatturaeconomica.it)).
