/**
 * Controllo formale di una fattura elettronica FatturaPA lato client: riproduce i
 * controlli più frequenti dello SdI (codici 003xx/004xx) e alcune verifiche di
 * buon senso (bollo, forfettario). Non sostituisce lo SdI: serve a trovare gli
 * errori prima dell'invio. Nessun dato lascia il browser.
 *
 * Fonti: specifiche tecniche FatturaPA 1.9 e lista controlli SdI (fatturapa.gov.it);
 * codici TD/RF allineati a backend-v2/src/catalogs/fatturapa.py.
 */

export type CheckLevel = "error" | "warning" | "info" | "ok";

export type CheckResult = {
  level: CheckLevel;
  /** Codice SdI quando esiste (es. 00400), altrimenti un id interno (es. BOLLO). */
  code: string;
  message: string;
  /** Link interno di approfondimento. */
  href?: string;
};

export const TD_CODES = new Set([
  "TD01", "TD02", "TD03", "TD04", "TD05", "TD06", "TD16", "TD17", "TD18", "TD19", "TD20", "TD21", "TD22", "TD23",
  "TD24", "TD25", "TD26", "TD27", "TD28", "TD29",
]);

export const RF_CODES = new Set([
  "RF01", "RF02", "RF04", "RF05", "RF06", "RF07", "RF08", "RF09", "RF10", "RF11", "RF12", "RF13", "RF14", "RF15",
  "RF16", "RF17", "RF18", "RF19", "RF20",
]);

export const NATURA_CODES = new Set([
  "N1", "N2.1", "N2.2", "N3.1", "N3.2", "N3.3", "N3.4", "N3.5", "N3.6", "N4", "N5", "N6.1", "N6.2", "N6.3", "N6.4",
  "N6.5", "N6.6", "N6.7", "N6.8", "N6.9", "N7",
]);

/** Nature che comportano il bollo sopra 77,47 € (vedi docs/okf/domain/scadenze-fiscali.md). */
const NATURA_BOLLO = new Set(["N1", "N2.1", "N2.2", "N3.5", "N3.6", "N4"]);
const BOLLO_SOGLIA = 77.47;

function text(el: Element | Document | null | undefined, name: string): string {
  if (!el) return "";
  const found = el.getElementsByTagName(name)[0];
  return found?.textContent?.trim() ?? "";
}

function all(el: Element | Document, name: string): Element[] {
  return Array.from(el.getElementsByTagName(name));
}

function num(s: string): number {
  const n = Number.parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isValidCodiceFiscale(cf: string): boolean {
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i.test(cf) || /^\d{11}$/.test(cf);
}

function isValidPartitaIvaIt(piva: string): boolean {
  if (!/^\d{11}$/.test(piva)) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    let d = Number(piva[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function parseFatturaXml(source: string): { doc: Document | null; parseError?: string } {
  if (typeof DOMParser === "undefined") return { doc: null, parseError: "DOMParser non disponibile" };
  const doc = new DOMParser().parseFromString(source, "application/xml");
  const err = doc.getElementsByTagName("parsererror")[0];
  if (err) return { doc: null, parseError: err.textContent?.trim().split("\n")[0] ?? "XML non valido" };
  return { doc };
}

/** Esegue tutti i controlli e restituisce i risultati ordinati per gravità. */
export function checkFattura(source: string, today = new Date()): CheckResult[] {
  const out: CheckResult[] = [];
  const push = (level: CheckLevel, code: string, message: string, href?: string) => out.push({ level, code, message, href });

  const trimmed = source.trim();
  if (!trimmed) return [{ level: "info", code: "EMPTY", message: "Incolla o carica il file XML della fattura per avviare il controllo." }];

  const { doc, parseError } = parseFatturaXml(trimmed);
  if (!doc) {
    push("error", "XML", `Il file non è un XML ben formato: ${parseError ?? "errore di sintassi"}.`);
    return out;
  }

  const root = doc.documentElement;
  if (!/FatturaElettronica$/.test(root.localName)) {
    push("error", "00200", `L'elemento radice è «${root.localName}», non FatturaElettronica: il file non è una FatturaPA.`);
    return out;
  }

  const header = root.getElementsByTagName("FatturaElettronicaHeader")[0];
  const bodies = all(root, "FatturaElettronicaBody");
  if (!header || !bodies.length) {
    push("error", "00200", "Mancano FatturaElettronicaHeader o FatturaElettronicaBody.");
    return out;
  }

  // --- Trasmissione ---
  const formato = text(header, "FormatoTrasmissione");
  const codDest = text(header, "CodiceDestinatario");
  const pecDest = text(header, "PECDestinatario");
  if (!["FPR12", "FPA12", "FSM10"].includes(formato)) {
    push("error", "00428", `FormatoTrasmissione «${formato || "assente"}» non valido: usa FPR12 (privati) o FPA12 (PA).`);
  }
  if (formato === "FPA12") {
    if (codDest.length !== 6) push("error", "00311", `Verso la PA il CodiceDestinatario è il codice ufficio IPA di 6 caratteri (trovato «${codDest}»).`, "/errori-sdi/00311");
  } else if (codDest.length !== 7) {
    push("error", "00311", `CodiceDestinatario deve avere 7 caratteri (trovato «${codDest || "vuoto"}»). Per un privato o un cliente senza canale usa 0000000.`, "/errori-sdi/00311");
  }
  if (codDest === "0000000" && !pecDest) {
    push("info", "0000000", "Codice destinatario 0000000 senza PEC: la fattura va nell'area riservata del cliente; ricordati la copia di cortesia.", "/guide/codice-destinatario-0000000");
  }
  if (codDest === "XXXXXXX") {
    push("info", "XXXXXXX", "Codice destinatario XXXXXXX: fattura verso un soggetto estero; il CAP deve essere 00000 e l'IdPaese del cliente diverso da IT.", "/guide/fattura-forfettario-cliente-estero");
  }
  const progressivo = text(header, "ProgressivoInvio");
  if (!progressivo) push("warning", "00201", "ProgressivoInvio vuoto: lo SdI lo richiede (massimo 10 caratteri alfanumerici).");

  // --- Cedente ---
  const cedente = header.getElementsByTagName("CedentePrestatore")[0];
  const regime = text(cedente, "RegimeFiscale");
  const cedentePiva = text(cedente?.getElementsByTagName("IdFiscaleIVA")[0], "IdCodice");
  const cedentePaese = text(cedente?.getElementsByTagName("IdFiscaleIVA")[0], "IdPaese");
  if (!RF_CODES.has(regime)) push("error", "00419", `RegimeFiscale «${regime || "assente"}» non è fra i codici ammessi (RF01…RF20).`, "/codici");
  if (cedentePaese === "IT" && !isValidPartitaIvaIt(cedentePiva)) {
    push("error", "00301", `Partita IVA del cedente «${cedentePiva}» non valida (controllo di Luhn fallito o lunghezza errata).`);
  }

  // --- Cessionario ---
  const cessionario = header.getElementsByTagName("CessionarioCommittente")[0];
  const cessIva = cessionario?.getElementsByTagName("IdFiscaleIVA")[0];
  const cessPiva = text(cessIva, "IdCodice");
  const cessPaese = text(cessIva, "IdPaese");
  const cessCf = text(cessionario?.getElementsByTagName("DatiAnagrafici")[0], "CodiceFiscale");
  const cessCap = text(cessionario?.getElementsByTagName("Sede")[0], "CAP");
  if (!cessPiva && !cessCf) {
    push("error", "00417", "Il cliente non ha né IdFiscaleIVA né CodiceFiscale: almeno uno è obbligatorio.", "/guide/fattura-elettronica-privati");
  }
  if (cessPaese === "IT" && cessPiva && !isValidPartitaIvaIt(cessPiva)) {
    push("error", "00305", `Partita IVA del cliente «${cessPiva}» non valida: è il motivo di scarto più frequente.`, "/errori-sdi/00305");
  }
  if (cessCf && !isValidCodiceFiscale(cessCf)) {
    push("error", "00306", `Codice fiscale del cliente «${cessCf}» con formato non valido.`, "/errori-sdi");
  }
  if (codDest === "XXXXXXX" && cessCap !== "00000") {
    push("warning", "00426", `Con cliente estero il CAP deve essere 00000 (trovato «${cessCap || "vuoto"}»).`);
  }
  if (codDest === "0000000" && cessPaese && cessPaese !== "IT") {
    push("warning", "0000000", "Cliente estero con codice destinatario 0000000: per l'estero si usa XXXXXXX.");
  }

  // --- Corpo ---
  for (const [bi, body] of bodies.entries()) {
    const prefix = bodies.length > 1 ? `Fattura ${bi + 1}: ` : "";
    const dg = body.getElementsByTagName("DatiGeneraliDocumento")[0];
    const td = text(dg, "TipoDocumento");
    const dataDoc = text(dg, "Data");
    const numero = text(dg, "Numero");
    const divisa = text(dg, "Divisa");
    const totale = num(text(dg, "ImportoTotaleDocumento"));
    const bolloVirtuale = text(dg?.getElementsByTagName("DatiBollo")[0], "BolloVirtuale");
    const causali = all(dg ?? body, "Causale").map((c) => c.textContent ?? "").join(" ");
    const ritenute = all(dg ?? body, "DatiRitenuta");

    if (!TD_CODES.has(td)) push("error", "00424", `${prefix}TipoDocumento «${td || "assente"}» non valido.`, "/codici");
    if (!numero) push("error", "00425", `${prefix}Numero documento assente: deve contenere almeno una cifra.`);
    else if (!/\d/.test(numero)) push("error", "00425", `${prefix}Numero «${numero}» deve contenere almeno un carattere numerico.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataDoc)) push("error", "00403", `${prefix}Data «${dataDoc || "assente"}» non nel formato AAAA-MM-GG.`);
    else {
      const d = new Date(`${dataDoc}T00:00:00Z`);
      const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      if (d.getTime() > t.getTime()) push("error", "00403", `${prefix}Data ${dataDoc} successiva a oggi: lo SdI scarta le fatture datate nel futuro.`, "/scadenze/entro-quando-emettere-la-fattura");
      else if ((t.getTime() - d.getTime()) / 86400000 > 12 && ["TD01", "TD02", "TD03", "TD06"].includes(td)) {
        push("warning", "TARDIVA", `${prefix}Sono passati più di 12 giorni dalla data ${dataDoc}: se non è ancora stata trasmessa, è una fattura tardiva.`, "/scadenze/fattura-elettronica-in-ritardo-sanzioni");
      }
    }
    if (divisa && divisa !== "EUR") push("info", "DIVISA", `${prefix}Divisa ${divisa}: ammessa, ma gli importi IVA vanno comunque espressi in euro nei dati di riepilogo.`);

    // Righe
    const linee = all(body, "DettaglioLinee");
    if (!linee.length) push("error", "00400", `${prefix}Nessuna riga (DettaglioLinee).`);
    const perAliquota = new Map<string, number>();
    let imponibileSenzaIvaBollo = 0;
    let hasAliquotaPositiva = false;
    for (const l of linee) {
      const n = text(l, "NumeroLinea");
      const aliquota = num(text(l, "AliquotaIVA"));
      const natura = text(l, "Natura");
      const prezzoTot = num(text(l, "PrezzoTotale"));
      if (aliquota === 0 && !natura) push("error", "00400", `${prefix}Riga ${n}: aliquota 0 senza Natura. Indica la natura (es. N2.2 forfettari, N4 esenti).`, "/errori-sdi/00400");
      if (aliquota > 0 && natura) push("error", "00401", `${prefix}Riga ${n}: aliquota ${aliquota}% con Natura «${natura}»: la natura si indica solo a IVA zero.`, "/errori-sdi");
      if (natura && !NATURA_CODES.has(natura)) push("error", "00445", `${prefix}Riga ${n}: Natura «${natura}» non valida (dal 2021 N2, N3 e N6 richiedono il sottocodice, es. N2.2).`, "/codici");
      if (aliquota > 0) hasAliquotaPositiva = true;
      if (natura && NATURA_BOLLO.has(natura)) imponibileSenzaIvaBollo += prezzoTot;
      const key = `${aliquota.toFixed(2)}|${natura}`;
      perAliquota.set(key, (perAliquota.get(key) ?? 0) + prezzoTot);
    }
    // Cassa previdenziale concorre al riepilogo
    for (const c of all(body, "DatiCassaPrevidenziale")) {
      const aliquota = num(text(c, "AliquotaIVA"));
      const natura = text(c, "Natura");
      const key = `${aliquota.toFixed(2)}|${natura}`;
      perAliquota.set(key, (perAliquota.get(key) ?? 0) + num(text(c, "ImportoContributoCassa")));
      if (natura && NATURA_BOLLO.has(natura)) imponibileSenzaIvaBollo += num(text(c, "ImportoContributoCassa"));
    }

    // Riepiloghi
    const riepiloghi = all(body, "DatiRiepilogo");
    if (!riepiloghi.length) push("error", "00419", `${prefix}Manca DatiRiepilogo: serve un blocco per ogni aliquota o natura.`);
    let sommaImponibili = 0;
    let sommaImposte = 0;
    const visti = new Set<string>();
    for (const r of riepiloghi) {
      const aliquota = num(text(r, "AliquotaIVA"));
      const natura = text(r, "Natura");
      const imponibile = num(text(r, "ImponibileImporto"));
      const imposta = num(text(r, "Imposta"));
      const esig = text(r, "EsigibilitaIVA");
      const rifNorm = text(r, "RiferimentoNormativo");
      const key = `${aliquota.toFixed(2)}|${natura}`;
      visti.add(key);
      sommaImponibili += imponibile;
      sommaImposte += imposta;
      const atteso = round2(perAliquota.get(key) ?? 0);
      if (Math.abs(atteso - imponibile) > 0.01) {
        push("error", "00422", `${prefix}Riepilogo ${aliquota}%${natura ? ` ${natura}` : ""}: imponibile ${imponibile.toFixed(2)} ma la somma delle righe è ${atteso.toFixed(2)}.`, "/errori-sdi");
      }
      const impostaAttesa = round2((imponibile * aliquota) / 100);
      if (Math.abs(impostaAttesa - imposta) > 0.01) {
        push("error", "00421", `${prefix}Riepilogo ${aliquota}%: imposta ${imposta.toFixed(2)} ma ${imponibile.toFixed(2)} × ${aliquota}% = ${impostaAttesa.toFixed(2)}.`, "/errori-sdi");
      }
      if (aliquota === 0 && !natura) push("error", "00429", `${prefix}Riepilogo con aliquota 0 senza Natura.`);
      if (aliquota > 0 && natura) push("error", "00430", `${prefix}Riepilogo con aliquota ${aliquota}% e Natura «${natura}» insieme.`);
      if (natura && !rifNorm) push("warning", "RIFNORM", `${prefix}Riepilogo ${natura} senza RiferimentoNormativo: non è bloccante, ma la dicitura di legge va indicata (es. art. 1 c. 54-89 L. 190/2014 per N2.2).`);
      if (esig === "S" && formato !== "FPA12") push("warning", "SPLIT", `${prefix}Esigibilità S (split payment) verso un soggetto non PA: verifica che il cliente rientri nell'art. 17-ter.`);
    }
    for (const key of perAliquota.keys()) {
      if (!visti.has(key) && (perAliquota.get(key) ?? 0) !== 0) {
        const [al, nat] = key.split("|");
        push("error", "00419", `${prefix}Le righe a ${Number(al)}%${nat ? ` ${nat}` : ""} non hanno un blocco DatiRiepilogo corrispondente.`);
      }
    }
    const totaleAtteso = round2(sommaImponibili + sommaImposte);
    if (totale && Math.abs(totale - totaleAtteso) > 0.01 && !ritenute.length && !all(body, "DatiBollo").length) {
      push("warning", "00423", `${prefix}ImportoTotaleDocumento ${totale.toFixed(2)} diverso da imponibili + imposte (${totaleAtteso.toFixed(2)}): ammesso solo se ci sono arrotondamenti, bollo o altri importi.`);
    }

    // Bollo
    if (imponibileSenzaIvaBollo > BOLLO_SOGLIA && bolloVirtuale !== "SI") {
      push("warning", "BOLLO", `${prefix}Operazioni senza IVA per ${imponibileSenzaIvaBollo.toFixed(2)} € (> 77,47 €) senza DatiBollo/BolloVirtuale = SI: il bollo da 2 € è probabilmente dovuto.`, "/calcolatore-bollo");
    }
    if (bolloVirtuale === "SI" && imponibileSenzaIvaBollo <= BOLLO_SOGLIA) {
      push("info", "BOLLO", `${prefix}Bollo indicato ma le operazioni senza IVA non superano 77,47 €: verifica che sia davvero dovuto.`, "/guide/imposta-di-bollo-fattura-elettronica");
    }

    // Forfettario
    if (regime === "RF19") {
      if (hasAliquotaPositiva) push("warning", "RF19", `${prefix}Regime RF19 (forfettario) con righe a IVA positiva: il forfettario non applica l'IVA (salvo cessazione del regime).`, "/guide/forfettario-fattura-elettronica-domande-frequenti");
      if (ritenute.length) push("warning", "RF19", `${prefix}Regime RF19 con DatiRitenuta: il forfettario non subisce ritenuta d'acconto.`, "/guide/forfettario-fattura-elettronica-domande-frequenti");
      if (!/190\/2014|commi 54|comma 54/i.test(causali) && !all(body, "RiferimentoNormativo").some((r) => /190\/2014|54/.test(r.textContent ?? ""))) {
        push("info", "RF19", `${prefix}Nessun riferimento alla L. 190/2014: aggiungi la dicitura del regime forfettario in Causale o nel RiferimentoNormativo.`, "/guide/fattura-elettronica-forfettario");
      }
    }
    if (regime === "RF01" && [...perAliquota.keys()].some((k) => k.endsWith("|N2.2")) && !hasAliquotaPositiva) {
      push("info", "N2.2", `${prefix}Natura N2.2 con regime RF01: N2.2 è tipica dei forfettari; in regime ordinario verifica la natura corretta.`, "/codici/n2-2-non-soggette-altri-casi");
    }

    // Note di credito
    if (td === "TD04" && !all(body, "DatiFattureCollegate").length) {
      push("warning", "TD04", `${prefix}Nota di credito senza DatiFattureCollegate: indica numero e data della fattura stornata.`, "/guide/nota-di-credito-importi-negativi");
    }
    if (td === "TD04" && linee.some((l) => num(text(l, "PrezzoTotale")) < 0)) {
      push("warning", "TD04", `${prefix}Nota di credito con importi negativi: nella TD04 gli importi si indicano positivi.`, "/guide/nota-di-credito-importi-negativi");
    }
    // Differita
    if (td === "TD24" && !all(body, "DatiDDT").length) {
      push("warning", "TD24", `${prefix}Fattura differita senza DatiDDT: riporta gli estremi dei documenti di trasporto.`, "/codici/td24-fattura-differita");
    }
  }

  if (!out.some((r) => r.level === "error")) {
    out.unshift({ level: "ok", code: "OK", message: "Nessun errore bloccante trovato nei controlli formali. Restano da verificare i dati che solo lo SdI conosce (partita IVA cessata, duplicati)." });
  }

  const order: Record<CheckLevel, number> = { error: 0, warning: 1, info: 2, ok: -1 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Esempio di fattura forfettaria con un errore (codice fiscale) e un avviso (bollo mancante), per la demo. */
export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>01234567897</IdCodice></IdTrasmittente>
      <ProgressivoInvio>00001</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567897</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Studio Esempio</Denominazione></Anagrafica>
        <RegimeFiscale>RF19</RegimeFiscale>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via Roma 1</Indirizzo><CAP>10100</CAP><Comune>Torino</Comune><Provincia>TO</Provincia><Nazione>IT</Nazione></Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <CodiceFiscale>RSSMRA80A01L219</CodiceFiscale>
        <Anagrafica><Nome>Mario</Nome><Cognome>Rossi</Cognome></Anagrafica>
      </DatiAnagrafici>
      <Sede><Indirizzo>Via Po 2</Indirizzo><CAP>10100</CAP><Comune>Torino</Comune><Provincia>TO</Provincia><Nazione>IT</Nazione></Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-11-02</Data>
        <Numero>12</Numero>
        <ImportoTotaleDocumento>500.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Consulenza ottobre</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>500.00</PrezzoUnitario>
        <PrezzoTotale>500.00</PrezzoTotale>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
        <ImponibileImporto>500.00</ImponibileImporto>
        <Imposta>0.00</Imposta>
        <RiferimentoNormativo>Art. 1, commi 54-89, L. 190/2014</RiferimentoNormativo>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><ImportoPagamento>500.00</ImportoPagamento></DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
`;
