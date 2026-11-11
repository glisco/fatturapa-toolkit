/**
 * Visualizzatore FatturaPA (.xml e .xml.p7m CAdES-BES) lato client.
 *
 * Estrae il payload XML anche da buste crittografiche PKCS#7 / CMS (.p7m,
 * incluse varianti BER a lunghezza indefinita e OCTET STRING frammentate a
 * blocchi tipiche di InfoCert/Aruba, oltre a file .p7m in Base64/PEM e doppie
 * buste .p7m.p7m) e legge l'albero XML senza dipendere da server né da librerie
 * esterne (funziona identico nel browser, in estensione Chrome e in Node/SSR).
 */

export const TD_LABELS: Record<string, string> = {
  TD01: "Fattura",
  TD02: "Acconto / anticipo su fattura",
  TD03: "Acconto / anticipo su parcella",
  TD04: "Nota di credito",
  TD05: "Nota di debito",
  TD06: "Parcella",
  TD16: "Integrazione fattura reverse charge interno",
  TD17: "Integrazione / autofattura acquisto servizi dall'estero",
  TD18: "Integrazione acquisto beni intracomunitari",
  TD19: "Integrazione / autofattura acquisto beni art. 17 c. 2",
  TD20: "Autofattura per regolarizzazione",
  TD21: "Autofattura per splafonamento",
  TD22: "Estrazione beni da deposito IVA",
  TD23: "Estrazione beni da deposito IVA con versamento",
  TD24: "Fattura differita (art. 21 c. 4 lett. a)",
  TD25: "Fattura differita triangolazione interna",
  TD26: "Cessione beni ammortizzabili / passaggi interni",
  TD27: "Fattura per autoconsumo o cessioni gratuite",
  TD28: "Acquisti da San Marino con IVA cartacea",
  TD29: "Comunicazione omessa o irregolare fatturazione",
};

export const RF_LABELS: Record<string, string> = {
  RF01: "Ordinario",
  RF02: "Contribuenti minimi (art. 1 c. 96-117 L. 244/2007)",
  RF04: "Agricoltura e attività connesse",
  RF05: "Vendita sali e tabacchi",
  RF06: "Commercio fiammiferi",
  RF07: "Editoria",
  RF08: "Gestione servizi telefonia pubblica",
  RF09: "Rivendita documenti di trasporto pubblico e sosta",
  RF10: "Intrattenimenti e giochi",
  RF11: "Agenzie viaggi e turismo",
  RF12: "Agriturismo",
  RF13: "Vendite a domicilio",
  RF14: "Rivendita beni usati, oggetti d'arte o antiquariato",
  RF15: "Agenzie di vendite all'asta",
  RF16: "IVA per cassa P.A.",
  RF17: "IVA per cassa (art. 32-bis D.L. 83/2012)",
  RF18: "Altro",
  RF19: "Regime forfettario (art. 1 c. 54-89 L. 190/2014)",
  RF20: "Regime transfrontaliero di franchigia IVA",
};

export const MP_LABELS: Record<string, string> = {
  MP01: "Contanti",
  MP02: "Assegno",
  MP03: "Assegno circolare",
  MP04: "Contanti presso Tesoreria",
  MP05: "Bonifico",
  MP06: "Vaglia cambiario",
  MP07: "Bollettino bancario",
  MP08: "Carta di pagamento",
  MP09: "RID",
  MP10: "RID utenze",
  MP11: "RID veloce",
  MP12: "RIBA",
  MP13: "MAV",
  MP14: "Quietanza erario",
  MP15: "Giroconto su conti di contabilità speciale",
  MP16: "Domiciliazione bancaria",
  MP17: "Domiciliazione postale",
  MP18: "Bollettino di c/c postale",
  MP19: "SEPA Direct Debit",
  MP20: "SEPA Direct Debit CORE",
  MP21: "SEPA Direct Debit B2B",
  MP22: "Trattenuta su somme già riscosse",
  MP23: "PagoPA",
};

export const TP_LABELS: Record<string, string> = {
  TP01: "Pagamento a rate",
  TP02: "Pagamento completo",
  TP03: "Anticipo",
};

export const ESIGIBILITA_LABELS: Record<string, string> = {
  I: "Immediata",
  D: "Differita",
  S: "Scissione dei pagamenti (split payment)",
};

/** OID 1.2.840.113549.1.7.1 (id-data in PKCS#7 / CMS EncapsulatedContentInfo). */
const OID_ID_DATA = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]);

type Asn1Node = {
  tag: number;
  constructed: boolean;
  headerStart: number;
  contentStart: number;
  contentEnd: number;
  nextOffset: number;
  indefinite: boolean;
};

function readAsn1Node(buf: Uint8Array, offset: number, limit: number): Asn1Node | null {
  if (offset >= limit) return null;
  const headerStart = offset;
  const first = buf[offset++];
  const constructed = (first & 0x20) !== 0;
  let tag = first & 0x1f;
  if (tag === 0x1f) {
    tag = 0;
    while (offset < limit) {
      const b = buf[offset++];
      tag = (tag << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
  }
  if (offset >= limit) return null;
  const lenByte = buf[offset++];
  if (lenByte === 0x80) {
    if (!constructed) return null;
    const contentStart = offset;
    let cursor = contentStart;
    while (cursor + 1 < limit) {
      if (buf[cursor] === 0x00 && buf[cursor + 1] === 0x00) {
        return {
          tag: first,
          constructed,
          headerStart,
          contentStart,
          contentEnd: cursor,
          nextOffset: cursor + 2,
          indefinite: true,
        };
      }
      const child = readAsn1Node(buf, cursor, limit);
      if (!child || child.nextOffset <= cursor) return null;
      cursor = child.nextOffset;
    }
    return null;
  }
  let length = 0;
  if ((lenByte & 0x80) === 0) {
    length = lenByte;
  } else {
    const numBytes = lenByte & 0x7f;
    if (numBytes === 0 || numBytes > 4 || offset + numBytes > limit) return null;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | buf[offset++];
    }
  }
  const contentStart = offset;
  const contentEnd = contentStart + length;
  if (contentEnd > limit) return null;
  return {
    tag: first,
    constructed,
    headerStart,
    contentStart,
    contentEnd,
    nextOffset: contentEnd,
    indefinite: false,
  };
}

function concatUint8(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/** Ricompone un OCTET STRING primitivo (0x04) o costruito a blocchi (0x24). */
function collectOctetString(buf: Uint8Array, node: Asn1Node): Uint8Array | null {
  const baseTag = node.tag & 0x1f;
  const tagClass = node.tag & 0xc0;
  if (tagClass === 0x00 && baseTag === 0x04) {
    if (!node.constructed) {
      return buf.subarray(node.contentStart, node.contentEnd);
    }
    const chunks: Uint8Array[] = [];
    let cursor = node.contentStart;
    while (cursor < node.contentEnd) {
      const child = readAsn1Node(buf, cursor, node.contentEnd);
      if (!child) return null;
      const part = collectOctetString(buf, child);
      if (!part) return null;
      chunks.push(part);
      cursor = child.nextOffset;
    }
    return concatUint8(chunks);
  }
  return null;
}

function matchesBytesAt(buf: Uint8Array, pos: number, pattern: Uint8Array): boolean {
  if (pos + pattern.length > buf.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (buf[pos + i] !== pattern[i]) return false;
  }
  return true;
}

/**
 * Cerca EncapsulatedContentInfo { id-data, [0] EXPLICIT OCTET STRING } nella
 * struttura CMS/PKCS#7 e restituisce i byte del contenuto incapsulato.
 */
function extractCmsDataPayload(buf: Uint8Array): Uint8Array | null {
  for (let i = 0; i <= buf.length - OID_ID_DATA.length - 4; i++) {
    if (!matchesBytesAt(buf, i, OID_ID_DATA)) continue;
    const afterOid = i + OID_ID_DATA.length;
    const explicit0 = readAsn1Node(buf, afterOid, buf.length);
    if (!explicit0 || explicit0.tag !== 0xa0) continue;
    const inner = readAsn1Node(buf, explicit0.contentStart, explicit0.contentEnd);
    if (!inner) continue;
    const payload = collectOctetString(buf, inner);
    if (payload && payload.length > 0) return payload;
  }
  return null;
}

function stripBomAndLeadingSpace(bytes: Uint8Array): Uint8Array {
  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    start = 3;
  }
  while (start < bytes.length && (bytes[start] === 0x20 || bytes[start] === 0x09 || bytes[start] === 0x0a || bytes[start] === 0x0d)) {
    start++;
  }
  return start > 0 ? bytes.subarray(start) : bytes;
}

function looksLikeXmlBytes(bytes: Uint8Array): boolean {
  const trimmed = stripBomAndLeadingSpace(bytes);
  return trimmed.length > 5 && trimmed[0] === 0x3c; // '<'
}

function tryDecodeBase64Envelope(bytes: Uint8Array): Uint8Array | null {
  const trimmed = stripBomAndLeadingSpace(bytes);
  if (trimmed.length < 32 || trimmed[0] === 0x30 || trimmed[0] === 0x3c) return null;
  let ascii = "";
  const sampleLen = Math.min(trimmed.length, 512);
  for (let i = 0; i < sampleLen; i++) ascii += String.fromCharCode(trimmed[i]);
  if (!/^(-----BEGIN |[A-Za-z0-9+/=\r\n\s]{32,})/.test(ascii)) return null;

  const fullText = new TextDecoder("ascii", { fatal: false }).decode(trimmed);
  const cleaned = fullText
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (cleaned.length < 32 || cleaned.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(cleaned)) return null;
  try {
    const bin = atob(cleaned);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function decodeXmlBytes(bytes: Uint8Array): string {
  const headAscii = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 200)));
  const encMatch = headAscii.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i);
  const declared = encMatch?.[1]?.toLowerCase() ?? "utf-8";
  if (declared === "iso-8859-1" || declared === "latin1" || declared === "windows-1252") {
    return new TextDecoder("windows-1252").decode(bytes);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
}

/** Fallback per .p7m non standard con payload XML contiguo non frammentato. */
function fallbackContiguousXml(bytes: Uint8Array): string | null {
  const raw = decodeXmlBytes(bytes);
  const startMatch = raw.match(/<\?xml\b|<([A-Za-z0-9_]+:)?FatturaElettronica\b/);
  if (!startMatch || startMatch.index === undefined) return null;
  const fromStart = raw.slice(startMatch.index);
  const endRegex = /<\/([A-Za-z0-9_]+:)?FatturaElettronica\s*>/g;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = endRegex.exec(fromStart)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd === -1) return null;
  return fromStart.slice(0, lastEnd);
}

/**
 * Estrae l'XML FatturaPA da un `Uint8Array` o `ArrayBuffer` (sia `.xml` puro
 * sia `.xml.p7m` CAdES DER/BER, Base64/PEM o doppia firma `.p7m.p7m`).
 */
export function extractXmlFromBytes(input: Uint8Array | ArrayBuffer): {
  xml: string;
  wasSigned: boolean;
  error?: string;
} {
  let current = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (current.length === 0) {
    return { xml: "", wasSigned: false, error: "Il file selezionato è vuoto." };
  }

  if (looksLikeXmlBytes(current)) {
    return { xml: decodeXmlBytes(current).trim(), wasSigned: false };
  }

  let wasSigned = false;
  for (let depth = 0; depth < 4; depth++) {
    const b64 = tryDecodeBase64Envelope(current);
    if (b64) current = b64;

    if (looksLikeXmlBytes(current)) {
      return { xml: decodeXmlBytes(current).trim(), wasSigned };
    }

    const extracted = extractCmsDataPayload(current);
    if (!extracted) break;
    wasSigned = true;
    current = extracted;
    if (looksLikeXmlBytes(current)) {
      return { xml: decodeXmlBytes(current).trim(), wasSigned: true };
    }
  }

  const fallback = fallbackContiguousXml(current);
  if (fallback) {
    return { xml: fallback.trim(), wasSigned: true };
  }

  return {
    xml: "",
    wasSigned,
    error: "Impossibile estrarre un documento XML FatturaPA valido dal file caricato.",
  };
}

// --- Parser XML leggero cross-runtime (browser + Node/Vitest, zero dipendenze) ---

type XmlNode = {
  localName: string;
  children: XmlNode[];
  textParts: string[];
};

function decodeXmlEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (full, ent: string) => {
    if (ent === "lt") return "<";
    if (ent === "gt") return ">";
    if (ent === "amp") return "&";
    if (ent === "quot") return '"';
    if (ent === "apos") return "'";
    if (ent.startsWith("#x") || ent.startsWith("#X")) {
      const code = Number.parseInt(ent.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (ent.startsWith("#")) {
      const code = Number.parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return full;
  });
}

function parseSimpleXmlTree(source: string): { root: XmlNode | null; error?: string } {
  // Rimuove prologo, processing instruction, commenti e DOCTYPE conservando i CDATA.
  const cleaned = source
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "");

  const rootHolder: XmlNode = { localName: "#doc", children: [], textParts: [] };
  const stack: XmlNode[] = [rootHolder];

  const tokenRe = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)(\s[^<>]*?)?(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(cleaned)) !== null) {
    if (m[1] !== undefined) {
      stack[stack.length - 1].textParts.push(m[1]);
      continue;
    }
    if (m[6] !== undefined) {
      stack[stack.length - 1].textParts.push(decodeXmlEntities(m[6]));
      continue;
    }
    const isClose = m[2] === "/";
    const fullTag = m[3];
    const selfClose = m[5] === "/";
    const localName = fullTag.includes(":") ? fullTag.split(":")[1] : fullTag;

    if (isClose) {
      if (stack.length <= 1) {
        return { root: null, error: `Tag di chiusura inatteso </${fullTag}>.` };
      }
      const popped = stack.pop()!;
      if (popped.localName !== localName) {
        return { root: null, error: `Tag non bilanciato: atteso </${popped.localName}>, trovato </${localName}>.` };
      }
    } else {
      const node: XmlNode = { localName, children: [], textParts: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClose) stack.push(node);
    }
  }

  if (stack.length !== 1) {
    return { root: null, error: `Tag XML non chiuso: <${stack[stack.length - 1].localName}>.` };
  }
  if (rootHolder.children.length === 0) {
    return { root: null, error: "Nessun elemento XML trovato." };
  }
  return { root: rootHolder.children[0] };
}

function nodeText(n: XmlNode | null | undefined): string {
  if (!n) return "";
  if (n.children.length === 0) return n.textParts.join("").trim();
  const parts = [...n.textParts];
  for (const c of n.children) parts.push(nodeText(c));
  return parts.join("").trim();
}

function firstDescendant(parent: XmlNode | null | undefined, localName: string): XmlNode | null {
  if (!parent) return null;
  for (const c of parent.children) {
    if (c.localName === localName) return c;
    const sub = firstDescendant(c, localName);
    if (sub) return sub;
  }
  return null;
}

function allDescendants(parent: XmlNode | null | undefined, localName: string, acc: XmlNode[] = []): XmlNode[] {
  if (!parent) return acc;
  for (const c of parent.children) {
    if (c.localName === localName) acc.push(c);
    allDescendants(c, localName, acc);
  }
  return acc;
}

function text(parent: XmlNode | null | undefined, localName: string): string {
  return nodeText(firstDescendant(parent, localName));
}

function num(raw: string): number {
  if (!raw) return 0;
  const parsed = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type PartyView = {
  denominazione: string;
  idPaese: string;
  partitaIva: string;
  codiceFiscale: string;
  regimeFiscale: string;
  regimeLabel: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
  telefono: string;
  email: string;
  rea: string;
};

export type LineView = {
  numeroLinea: string;
  codiciArticolo: string[];
  descrizione: string;
  quantita: number | null;
  unitaMisura: string;
  prezzoUnitario: number;
  sconto: string;
  prezzoTotale: number;
  aliquotaIVA: number;
  natura: string;
  ritenuta: boolean;
};

export type RiepilogoView = {
  aliquotaIVA: number;
  natura: string;
  imponibileImporto: number;
  imposta: number;
  esigibilitaIVA: string;
  esigibilitaLabel: string;
  riferimentoNormativo: string;
};

export type RitenutaView = {
  tipo: string;
  importo: number;
  aliquota: number;
  causalePagamento: string;
};

export type CassaView = {
  tipo: string;
  alCassa: number;
  importoContributo: number;
  aliquotaIVA: number;
  natura: string;
};

export type PagamentoView = {
  condizioni: string;
  condizioniLabel: string;
  modalita: string;
  modalitaLabel: string;
  dataScadenza: string;
  importo: number;
  istitutoFinanziario: string;
  iban: string;
  beneficiario: string;
};

export type AllegatoView = {
  nome: string;
  formato: string;
  descrizione: string;
  base64: string;
  approxBytes: number;
};

export type FatturaView = {
  formatoTrasmissione: string;
  progressivoInvio: string;
  codiceDestinatario: string;
  pecDestinatario: string;
  cedente: PartyView;
  cessionario: PartyView;
  tipoDocumento: string;
  tipoDocumentoLabel: string;
  divisa: string;
  data: string;
  numero: string;
  importoTotaleDocumento: number;
  imponibileTotale: number;
  impostaTotale: number;
  nettoAPagare: number;
  bolloVirtuale: boolean;
  importoBollo: number;
  causali: string[];
  fattureCollegate: { idDocumento: string; data: string }[];
  ddt: { numeroDDT: string; dataDDT: string }[];
  linee: LineView[];
  riepiloghi: RiepilogoView[];
  ritenute: RitenutaView[];
  casse: CassaView[];
  pagamenti: PagamentoView[];
  allegati: AllegatoView[];
};

function extractParty(node: XmlNode | null): PartyView {
  const anag = firstDescendant(node, "DatiAnagrafici");
  const idIva = firstDescendant(anag, "IdFiscaleIVA");
  const anagrafica = firstDescendant(anag, "Anagrafica");
  const denom = text(anagrafica, "Denominazione");
  const nome = text(anagrafica, "Nome");
  const cognome = text(anagrafica, "Cognome");
  const sede = firstDescendant(node, "Sede");
  const indirizzo = [text(sede, "Indirizzo"), text(sede, "NumeroCivico")].filter(Boolean).join(" ");
  const contatti = firstDescendant(node, "Contatti");
  const reaEl = firstDescendant(node, "IscrizioneREA");
  const reaUff = text(reaEl, "Ufficio");
  const reaNum = text(reaEl, "NumeroREA");
  const regime = text(anag, "RegimeFiscale");

  return {
    denominazione: denom || [nome, cognome].filter(Boolean).join(" ") || "—",
    idPaese: text(idIva, "IdPaese"),
    partitaIva: text(idIva, "IdCodice"),
    codiceFiscale: text(anag, "CodiceFiscale"),
    regimeFiscale: regime,
    regimeLabel: regime ? `${regime} — ${RF_LABELS[regime] ?? "Regime fiscale"}` : "",
    indirizzo,
    cap: text(sede, "CAP"),
    comune: text(sede, "Comune"),
    provincia: text(sede, "Provincia"),
    nazione: text(sede, "Nazione"),
    telefono: text(contatti, "Telefono"),
    email: text(contatti, "Email"),
    rea: reaUff && reaNum ? `${reaUff}-${reaNum}` : reaNum,
  };
}

export function parseFatturaXmlView(source: string): {
  invoices: FatturaView[];
  parseError?: string;
} {
  const trimmed = source.trim();
  if (!trimmed) return { invoices: [] };

  const { root, error } = parseSimpleXmlTree(trimmed);
  if (!root) {
    return { invoices: [], parseError: error ?? "Il file non è un XML ben formato." };
  }

  if (!/^FatturaElettronica(Semplificata)?$/.test(root.localName)) {
    return {
      invoices: [],
      parseError: `Elemento radice «${root.localName}» non riconosciuto: carica un file XML o P7M FatturaPA.`,
    };
  }

  const header = firstDescendant(root, "FatturaElettronicaHeader");
  const bodies = allDescendants(root, "FatturaElettronicaBody");
  if (!header || bodies.length === 0) {
    return { invoices: [], parseError: "Struttura FatturaPA incompleta (manca Header o Body)." };
  }

  const datiTrasm = firstDescendant(header, "DatiTrasmissione");
  const formatoTrasmissione = text(datiTrasm, "FormatoTrasmissione");
  const progressivoInvio = text(datiTrasm, "ProgressivoInvio");
  const codiceDestinatario = text(datiTrasm, "CodiceDestinatario");
  const pecDestinatario = text(datiTrasm, "PECDestinatario");
  const cedente = extractParty(firstDescendant(header, "CedentePrestatore"));
  const cessionario = extractParty(firstDescendant(header, "CessionarioCommittente"));

  const invoices: FatturaView[] = bodies.map((body) => {
    const dg = firstDescendant(body, "DatiGeneraliDocumento");
    const td = text(dg, "TipoDocumento");
    const divisa = text(dg, "Divisa") || "EUR";
    const data = text(dg, "Data");
    const numero = text(dg, "Numero");
    const datiBollo = firstDescendant(dg, "DatiBollo");
    const bolloVirtuale = text(datiBollo, "BolloVirtuale").toUpperCase() === "SI";
    const importoBollo = num(text(datiBollo, "ImportoBollo"));
    const causali = allDescendants(dg, "Causale")
      .map((c) => nodeText(c))
      .filter(Boolean);

    const ritenute: RitenutaView[] = allDescendants(dg, "DatiRitenuta").map((r) => ({
      tipo: text(r, "TipoRitenuta"),
      importo: num(text(r, "ImportoRitenuta")),
      aliquota: num(text(r, "AliquotaRitenuta")),
      causalePagamento: text(r, "CausalePagamento"),
    }));

    const casse: CassaView[] = allDescendants(dg, "DatiCassaPrevidenziale").map((c) => ({
      tipo: text(c, "TipoCassa"),
      alCassa: num(text(c, "AlCassa")),
      importoContributo: num(text(c, "ImportoContributoCassa")),
      aliquotaIVA: num(text(c, "AliquotaIVA")),
      natura: text(c, "Natura"),
    }));

    const fattureCollegate = allDescendants(body, "DatiFattureCollegate").map((f) => ({
      idDocumento: text(f, "IdDocumento"),
      data: text(f, "Data"),
    }));

    const ddt = allDescendants(body, "DatiDDT").map((d) => ({
      numeroDDT: text(d, "NumeroDDT"),
      dataDDT: text(d, "DataDDT"),
    }));

    const linee: LineView[] = allDescendants(body, "DettaglioLinee").map((l) => {
      const qRaw = text(l, "Quantita");
      const codiciArticolo = allDescendants(l, "CodiceArticolo")
        .map((ca) => [text(ca, "CodiceTipo"), text(ca, "CodiceValore")].filter(Boolean).join(": "))
        .filter(Boolean);
      const sconti = allDescendants(l, "ScontoMaggiorazione")
        .map((s) => {
          const tipo = text(s, "Tipo") === "MG" ? "+" : "-";
          const perc = text(s, "Percentuale");
          const imp = text(s, "Importo");
          if (perc) return `${tipo}${num(perc)}%`;
          if (imp) return `${tipo}${num(imp).toFixed(2)}`;
          return "";
        })
        .filter(Boolean)
        .join(" ");

      return {
        numeroLinea: text(l, "NumeroLinea"),
        codiciArticolo,
        descrizione: text(l, "Descrizione"),
        quantita: qRaw ? num(qRaw) : null,
        unitaMisura: text(l, "UnitaMisura"),
        prezzoUnitario: num(text(l, "PrezzoUnitario")),
        sconto: sconti,
        prezzoTotale: num(text(l, "PrezzoTotale")),
        aliquotaIVA: num(text(l, "AliquotaIVA")),
        natura: text(l, "Natura"),
        ritenuta: text(l, "Ritenuta").toUpperCase() === "SI",
      };
    });

    const riepiloghi: RiepilogoView[] = allDescendants(body, "DatiRiepilogo").map((r) => {
      const esig = text(r, "EsigibilitaIVA");
      return {
        aliquotaIVA: num(text(r, "AliquotaIVA")),
        natura: text(r, "Natura"),
        imponibileImporto: num(text(r, "ImponibileImporto")),
        imposta: num(text(r, "Imposta")),
        esigibilitaIVA: esig,
        esigibilitaLabel: ESIGIBILITA_LABELS[esig] ?? esig,
        riferimentoNormativo: text(r, "RiferimentoNormativo"),
      };
    });

    const imponibileTotale = round2(riepiloghi.reduce((s, r) => s + r.imponibileImporto, 0));
    const impostaTotale = round2(riepiloghi.reduce((s, r) => s + r.imposta, 0));
    const rawTotale = text(dg, "ImportoTotaleDocumento");
    const importoTotaleDocumento = rawTotale ? num(rawTotale) : round2(imponibileTotale + impostaTotale);
    const totaleRitenute = round2(ritenute.reduce((s, r) => s + r.importo, 0));

    const pagamenti: PagamentoView[] = [];
    for (const dp of allDescendants(body, "DatiPagamento")) {
      const cond = text(dp, "CondizioniPagamento");
      for (const det of allDescendants(dp, "DettaglioPagamento")) {
        const mod = text(det, "ModalitaPagamento");
        pagamenti.push({
          condizioni: cond,
          condizioniLabel: TP_LABELS[cond] ?? cond,
          modalita: mod,
          modalitaLabel: mod ? `${mod} — ${MP_LABELS[mod] ?? "Pagamento"}` : "",
          dataScadenza: text(det, "DataScadenzaPagamento"),
          importo: num(text(det, "ImportoPagamento")),
          istitutoFinanziario: text(det, "IstitutoFinanziario"),
          iban: text(det, "IBAN"),
          beneficiario: text(det, "Beneficiario"),
        });
      }
    }

    const sommaPagamenti = round2(pagamenti.reduce((s, p) => s + p.importo, 0));
    const nettoAPagare = sommaPagamenti > 0 ? sommaPagamenti : round2(importoTotaleDocumento - totaleRitenute);

    const allegati: AllegatoView[] = allDescendants(body, "Allegati").map((a) => {
      const b64 = text(a, "Attachment").replace(/\s+/g, "");
      return {
        nome: text(a, "NomeAttachment") || "allegato",
        formato: text(a, "FormatoAttachment"),
        descrizione: text(a, "DescrizioneAttachment"),
        base64: b64,
        approxBytes: Math.floor((b64.length * 3) / 4),
      };
    });

    return {
      formatoTrasmissione,
      progressivoInvio,
      codiceDestinatario,
      pecDestinatario,
      cedente,
      cessionario,
      tipoDocumento: td,
      tipoDocumentoLabel: td ? `${td} — ${TD_LABELS[td] ?? "Documento"}` : "Documento",
      divisa,
      data,
      numero,
      importoTotaleDocumento,
      imponibileTotale,
      impostaTotale,
      nettoAPagare,
      bolloVirtuale,
      importoBollo,
      causali,
      fattureCollegate,
      ddt,
      linee,
      riepiloghi,
      ritenute,
      casse,
      pagamenti,
      allegati,
    };
  });

  return { invoices };
}

/** Esempio completo e formalmente valido per la demo immediata del visualizzatore. */
export const VIEWER_SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>08365770018</IdCodice></IdTrasmittente>
      <ProgressivoInvio>00042</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>0000000</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567897</IdCodice></IdFiscaleIVA>
        <CodiceFiscale>01234567897</CodiceFiscale>
        <Anagrafica><Denominazione>Studio Tecnico Bianchi Ing. Laura</Denominazione></Anagrafica>
        <RegimeFiscale>RF19</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Corso Vittorio Emanuele II</Indirizzo>
        <NumeroCivico>84</NumeroCivico>
        <CAP>10121</CAP>
        <Comune>Torino</Comune>
        <Provincia>TO</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
      <Contatti>
        <Email>studio@bianchiesempio.it</Email>
      </Contatti>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01114601006</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Officina Meccanica Verdi S.r.l.</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>Via dell'Industria</Indirizzo>
        <NumeroCivico>12</NumeroCivico>
        <CAP>10015</CAP>
        <Comune>Ivrea</Comune>
        <Provincia>TO</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-11-05</Data>
        <Numero>42/2026</Numero>
        <DatiBollo>
          <BolloVirtuale>SI</BolloVirtuale>
          <ImportoBollo>2.00</ImportoBollo>
        </DatiBollo>
        <DatiCassaPrevidenziale>
          <TipoCassa>TC04</TipoCassa>
          <AlCassa>4.00</AlCassa>
          <ImportoContributoCassa>32.00</ImportoContributoCassa>
          <ImponibileCassa>800.00</ImponibileCassa>
          <AliquotaIVA>0.00</AliquotaIVA>
          <Natura>N2.2</Natura>
        </DatiCassaPrevidenziale>
        <ImportoTotaleDocumento>834.00</ImportoTotaleDocumento>
        <Causale>Operazione effettuata ai sensi dell'art. 1, commi 54-89, della Legge n. 190/2014 — Regime forfettario. Imposta di bollo da 2,00 euro assolta in modo virtuale ai sensi del DM 17/06/2014.</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Relazione tecnica e pratica energetica capannone industriale</Descrizione>
        <Quantita>1.00</Quantita>
        <UnitaMisura> prest. </UnitaMisura>
        <PrezzoUnitario>800.00</PrezzoUnitario>
        <PrezzoTotale>800.00</PrezzoTotale>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
      </DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>2</NumeroLinea>
        <Descrizione>Riaddebito imposta di bollo</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>2.00</PrezzoUnitario>
        <PrezzoTotale>2.00</PrezzoTotale>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N1</Natura>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
        <ImponibileImporto>832.00</ImponibileImporto>
        <Imposta>0.00</Imposta>
        <RiferimentoNormativo>Non soggetta ad IVA ai sensi art. 1 c. 54-89 L. 190/2014</RiferimentoNormativo>
      </DatiRiepilogo>
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N1</Natura>
        <ImponibileImporto>2.00</ImponibileImporto>
        <Imposta>0.00</Imposta>
        <RiferimentoNormativo>Escluso ex art. 15 DPR 633/1972</RiferimentoNormativo>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <DataScadenzaPagamento>2026-12-05</DataScadenzaPagamento>
        <ImportoPagamento>834.00</ImportoPagamento>
        <IstitutoFinanziario>Banca d'Esempio</IstitutoFinanziario>
        <IBAN>IT60X0542811101000000123456</IBAN>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>
`;
