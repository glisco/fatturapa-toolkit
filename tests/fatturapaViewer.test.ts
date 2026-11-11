import { describe, expect, it } from "vitest";
import {
  extractXmlFromBytes,
  parseFatturaXmlView,
  VIEWER_SAMPLE_XML,
} from "../src/fatturapaViewer";

function encodeDerLen(len: number): number[] {
  if (len < 0x80) return [len];
  if (len <= 0xff) return [0x81, len];
  return [0x82, (len >> 8) & 0xff, len & 0xff];
}

function derWrap(tag: number, content: Uint8Array): Uint8Array {
  const lenBytes = encodeDerLen(content.length);
  const out = new Uint8Array(1 + lenBytes.length + content.length);
  out[0] = tag;
  out.set(lenBytes, 1);
  out.set(content, 1 + lenBytes.length);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** Costruisce una busta PKCS#7 / CMS SignedData DER realistica attorno a `payload`. */
function buildDerP7m(payload: Uint8Array): Uint8Array {
  // OID 1.2.840.113549.1.7.2 (signedData)
  const oidSignedData = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);
  // OID 1.2.840.113549.1.7.1 (id-data)
  const oidData = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]);
  const version = new Uint8Array([0x02, 0x01, 0x01]);
  const digestSet = new Uint8Array([0x31, 0x00]);
  const octet = derWrap(0x04, payload);
  const explicit0 = derWrap(0xa0, octet);
  const encapContentInfo = derWrap(0x30, concat(oidData, explicit0));
  const signerInfos = new Uint8Array([0x31, 0x04, 0x04, 0x02, 0xde, 0xad]);
  const signedData = derWrap(0x30, concat(version, digestSet, encapContentInfo, signerInfos));
  return derWrap(0x30, concat(oidSignedData, derWrap(0xa0, signedData)));
}

/**
 * Costruisce una busta BER a lunghezza indefinita (0x80 ... 0x00 0x00) con
 * OCTET STRING costruita (0x24) divisa in chunk da 64 byte, come generata in
 * streaming da BouncyCastle / InfoCert / Aruba.
 */
function buildChunkedBerP7m(payload: Uint8Array): Uint8Array {
  const oidSignedData = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);
  const oidData = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]);
  const eoc = new Uint8Array([0x00, 0x00]);

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < payload.length; i += 64) {
    chunks.push(derWrap(0x04, payload.subarray(i, Math.min(i + 64, payload.length))));
  }
  const constructedOctet = concat(new Uint8Array([0x24, 0x80]), ...chunks, eoc);
  const explicit0 = concat(new Uint8Array([0xa0, 0x80]), constructedOctet, eoc);
  const encap = concat(new Uint8Array([0x30, 0x80]), oidData, explicit0, eoc);
  const signedData = concat(new Uint8Array([0x30, 0x80]), new Uint8Array([0x02, 0x01, 0x01, 0x31, 0x00]), encap, eoc);
  return concat(new Uint8Array([0x30, 0x80]), oidSignedData, new Uint8Array([0xa0, 0x80]), signedData, eoc, eoc);
}

describe("fatturapaViewer", () => {
  it("legge un file .xml standard e popola cedente, cliente, righe, cassa, bollo e IBAN", () => {
    const raw = new TextEncoder().encode(VIEWER_SAMPLE_XML);
    const extracted = extractXmlFromBytes(raw);
    expect(extracted.wasSigned).toBe(false);
    expect(extracted.error).toBeUndefined();

    const { invoices, parseError } = parseFatturaXmlView(extracted.xml);
    expect(parseError).toBeUndefined();
    expect(invoices).toHaveLength(1);
    const inv = invoices[0];
    expect(inv.numero).toBe("42/2026");
    expect(inv.tipoDocumento).toBe("TD01");
    expect(inv.cedente.denominazione).toContain("Studio Tecnico Bianchi");
    expect(inv.cedente.regimeFiscale).toBe("RF19");
    expect(inv.cessionario.denominazione).toContain("Officina Meccanica Verdi");
    expect(inv.bolloVirtuale).toBe(true);
    expect(inv.importoBollo).toBe(2);
    expect(inv.casse).toHaveLength(1);
    expect(inv.casse[0].importoContributo).toBe(32);
    expect(inv.linee).toHaveLength(2);
    expect(inv.importoTotaleDocumento).toBe(834);
    expect(inv.pagamenti[0].iban).toBe("IT60X0542811101000000123456");
  });

  it("estrae l'XML da una busta .xml.p7m DER firmata CAdES", () => {
    const xmlBytes = new TextEncoder().encode(VIEWER_SAMPLE_XML);
    const p7m = buildDerP7m(xmlBytes);
    const extracted = extractXmlFromBytes(p7m);
    expect(extracted.wasSigned).toBe(true);
    expect(extracted.error).toBeUndefined();
    const { invoices, parseError } = parseFatturaXmlView(extracted.xml);
    expect(parseError).toBeUndefined();
    expect(invoices[0].numero).toBe("42/2026");
  });

  it("ricompone senza corruzione un .xml.p7m BER a lunghezza indefinita e OCTET STRING a chunk", () => {
    const xmlBytes = new TextEncoder().encode(VIEWER_SAMPLE_XML);
    const berP7m = buildChunkedBerP7m(xmlBytes);
    const extracted = extractXmlFromBytes(berP7m);
    expect(extracted.wasSigned).toBe(true);
    expect(extracted.error).toBeUndefined();
    expect(extracted.xml).toContain("<Numero>42/2026</Numero>");
    const { invoices, parseError } = parseFatturaXmlView(extracted.xml);
    expect(parseError).toBeUndefined();
    expect(invoices[0].importoTotaleDocumento).toBe(834);
  });

  it("gestisce sia .p7m codificati in Base64/PEM sia doppie buste .p7m.p7m", () => {
    const xmlBytes = new TextEncoder().encode(VIEWER_SAMPLE_XML);
    const doubleSigned = buildDerP7m(buildDerP7m(xmlBytes));
    let bin = "";
    for (let i = 0; i < doubleSigned.length; i++) bin += String.fromCharCode(doubleSigned[i]);
    const pem = `-----BEGIN PKCS7-----\n${btoa(bin).replace(/(.{64})/g, "$1\n")}\n-----END PKCS7-----\n`;
    const extracted = extractXmlFromBytes(new TextEncoder().encode(pem));
    expect(extracted.wasSigned).toBe(true);
    expect(extracted.error).toBeUndefined();
    const { invoices } = parseFatturaXmlView(extracted.xml);
    expect(invoices[0].cedente.partitaIva).toBe("01234567897");
  });
});
