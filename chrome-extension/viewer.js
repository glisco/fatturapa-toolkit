// src/lib/seo/fatturapaViewer.ts
var e = {
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
	TD29: "Comunicazione omessa o irregolare fatturazione"
}, t = {
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
	RF20: "Regime transfrontaliero di franchigia IVA"
}, n = {
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
	MP23: "PagoPA"
}, r = {
	TP01: "Pagamento a rate",
	TP02: "Pagamento completo",
	TP03: "Anticipo"
}, i = {
	I: "Immediata",
	D: "Differita",
	S: "Scissione dei pagamenti (split payment)"
}, a = new Uint8Array([
	6,
	9,
	42,
	134,
	72,
	134,
	247,
	13,
	1,
	7,
	1
]);
function o(e, t, n) {
	if (t >= n) return null;
	let r = t, i = e[t++], a = !!(i & 32), s = i & 31;
	if (s === 31) for (s = 0; t < n;) {
		let n = e[t++];
		if (s = s << 7 | n & 127, !(n & 128)) break;
	}
	if (t >= n) return null;
	let c = e[t++];
	if (c === 128) {
		if (!a) return null;
		let s = t, c = s;
		for (; c + 1 < n;) {
			if (e[c] === 0 && e[c + 1] === 0) return {
				tag: i,
				constructed: a,
				headerStart: r,
				contentStart: s,
				contentEnd: c,
				nextOffset: c + 2,
				indefinite: !0
			};
			let t = o(e, c, n);
			if (!t || t.nextOffset <= c) return null;
			c = t.nextOffset;
		}
		return null;
	}
	let l = 0;
	if (!(c & 128)) l = c;
	else {
		let r = c & 127;
		if (r === 0 || r > 4 || t + r > n) return null;
		for (let n = 0; n < r; n++) l = l << 8 | e[t++];
	}
	let u = t, d = u + l;
	return d > n ? null : {
		tag: i,
		constructed: a,
		headerStart: r,
		contentStart: u,
		contentEnd: d,
		nextOffset: d,
		indefinite: !1
	};
}
function s(e) {
	if (e.length === 1) return e[0];
	let t = e.reduce((e, t) => e + t.length, 0), n = new Uint8Array(t), r = 0;
	for (let t of e) n.set(t, r), r += t.length;
	return n;
}
function c(e, t) {
	let n = t.tag & 31;
	if (!(t.tag & 192) && n === 4) {
		if (!t.constructed) return e.subarray(t.contentStart, t.contentEnd);
		let n = [], r = t.contentStart;
		for (; r < t.contentEnd;) {
			let i = o(e, r, t.contentEnd);
			if (!i) return null;
			let a = c(e, i);
			if (!a) return null;
			n.push(a), r = i.nextOffset;
		}
		return s(n);
	}
	return null;
}
function l(e, t, n) {
	if (t + n.length > e.length) return !1;
	for (let r = 0; r < n.length; r++) if (e[t + r] !== n[r]) return !1;
	return !0;
}
function u(e) {
	for (let t = 0; t <= e.length - a.length - 4; t++) {
		if (!l(e, t, a)) continue;
		let n = o(e, t + a.length, e.length);
		if (!n || n.tag !== 160) continue;
		let r = o(e, n.contentStart, n.contentEnd);
		if (!r) continue;
		let i = c(e, r);
		if (i && i.length > 0) return i;
	}
	return null;
}
function d(e) {
	let t = 0;
	for (e.length >= 3 && e[0] === 239 && e[1] === 187 && e[2] === 191 && (t = 3); t < e.length && (e[t] === 32 || e[t] === 9 || e[t] === 10 || e[t] === 13);) t++;
	return t > 0 ? e.subarray(t) : e;
}
function f(e) {
	let t = d(e);
	return t.length > 5 && t[0] === 60;
}
function p(e) {
	let t = d(e);
	if (t.length < 32 || t[0] === 48 || t[0] === 60) return null;
	let n = "", r = Math.min(t.length, 512);
	for (let e = 0; e < r; e++) n += String.fromCharCode(t[e]);
	if (!/^(-----BEGIN |[A-Za-z0-9+/=\r\n\s]{32,})/.test(n)) return null;
	let i = new TextDecoder("ascii", { fatal: !1 }).decode(t).replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
	if (i.length < 32 || i.length % 4 != 0 || /[^A-Za-z0-9+/=]/.test(i)) return null;
	try {
		let e = atob(i), t = new Uint8Array(e.length);
		for (let n = 0; n < e.length; n++) t[n] = e.charCodeAt(n);
		return t;
	} catch {
		return null;
	}
}
function m(e) {
	let t = new TextDecoder("latin1").decode(e.subarray(0, Math.min(e.length, 200))).match(/<\?xml[^>]*encoding=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "utf-8";
	return t === "iso-8859-1" || t === "latin1" || t === "windows-1252" ? new TextDecoder("windows-1252").decode(e) : new TextDecoder("utf-8", { fatal: !1 }).decode(e).replace(/^\uFEFF/, "");
}
function h(e) {
	let t = m(e), n = t.match(/<\?xml\b|<([A-Za-z0-9_]+:)?FatturaElettronica\b/);
	if (!n || n.index === void 0) return null;
	let r = t.slice(n.index), i = /<\/([A-Za-z0-9_]+:)?FatturaElettronica\s*>/g, a = -1, o;
	for (; (o = i.exec(r)) !== null;) a = o.index + o[0].length;
	return a === -1 ? null : r.slice(0, a);
}
function g(e) {
	let t = e instanceof Uint8Array ? e : new Uint8Array(e);
	if (t.length === 0) return {
		xml: "",
		wasSigned: !1,
		error: "Il file selezionato è vuoto."
	};
	if (f(t)) return {
		xml: m(t).trim(),
		wasSigned: !1
	};
	let n = !1;
	for (let e = 0; e < 4; e++) {
		let e = p(t);
		if (e && (t = e), f(t)) return {
			xml: m(t).trim(),
			wasSigned: n
		};
		let r = u(t);
		if (!r) break;
		if (n = !0, t = r, f(t)) return {
			xml: m(t).trim(),
			wasSigned: !0
		};
	}
	let r = h(t);
	return r ? {
		xml: r.trim(),
		wasSigned: !0
	} : {
		xml: "",
		wasSigned: n,
		error: "Impossibile estrarre un documento XML FatturaPA valido dal file caricato."
	};
}
function _(e) {
	return e.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (e, t) => {
		if (t === "lt") return "<";
		if (t === "gt") return ">";
		if (t === "amp") return "&";
		if (t === "quot") return "\"";
		if (t === "apos") return "'";
		if (t.startsWith("#x") || t.startsWith("#X")) {
			let n = Number.parseInt(t.slice(2), 16);
			return Number.isFinite(n) ? String.fromCodePoint(n) : e;
		}
		if (t.startsWith("#")) {
			let n = Number.parseInt(t.slice(1), 10);
			return Number.isFinite(n) ? String.fromCodePoint(n) : e;
		}
		return e;
	});
}
function v(e) {
	let t = e.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, ""), n = {
		localName: "#doc",
		children: [],
		textParts: []
	}, r = [n], i = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)(\s[^<>]*?)?(\/?)>|([^<]+)/g, a;
	for (; (a = i.exec(t)) !== null;) {
		if (a[1] !== void 0) {
			r[r.length - 1].textParts.push(a[1]);
			continue;
		}
		if (a[6] !== void 0) {
			r[r.length - 1].textParts.push(_(a[6]));
			continue;
		}
		let e = a[2] === "/", t = a[3], n = a[5] === "/", i = t.includes(":") ? t.split(":")[1] : t;
		if (e) {
			if (r.length <= 1) return {
				root: null,
				error: `Tag di chiusura inatteso </${t}>.`
			};
			let e = r.pop();
			if (e.localName !== i) return {
				root: null,
				error: `Tag non bilanciato: atteso </${e.localName}>, trovato </${i}>.`
			};
		} else {
			let e = {
				localName: i,
				children: [],
				textParts: []
			};
			r[r.length - 1].children.push(e), n || r.push(e);
		}
	}
	return r.length === 1 ? n.children.length === 0 ? {
		root: null,
		error: "Nessun elemento XML trovato."
	} : { root: n.children[0] } : {
		root: null,
		error: `Tag XML non chiuso: <${r[r.length - 1].localName}>.`
	};
}
function y(e) {
	if (!e) return "";
	if (e.children.length === 0) return e.textParts.join("").trim();
	let t = [...e.textParts];
	for (let n of e.children) t.push(y(n));
	return t.join("").trim();
}
function b(e, t) {
	if (!e) return null;
	for (let n of e.children) {
		if (n.localName === t) return n;
		let e = b(n, t);
		if (e) return e;
	}
	return null;
}
function x(e, t, n = []) {
	if (!e) return n;
	for (let r of e.children) r.localName === t && n.push(r), x(r, t, n);
	return n;
}
function S(e, t) {
	return y(b(e, t));
}
function C(e) {
	if (!e) return 0;
	let t = Number.parseFloat(e.replace(",", "."));
	return Number.isFinite(t) ? t : 0;
}
function w(e) {
	return Math.round((e + 2 ** -52) * 100) / 100;
}
function T(e) {
	let n = b(e, "DatiAnagrafici"), r = b(n, "IdFiscaleIVA"), i = b(n, "Anagrafica"), a = S(i, "Denominazione"), o = S(i, "Nome"), s = S(i, "Cognome"), c = b(e, "Sede"), l = [S(c, "Indirizzo"), S(c, "NumeroCivico")].filter(Boolean).join(" "), u = b(e, "Contatti"), d = b(e, "IscrizioneREA"), f = S(d, "Ufficio"), p = S(d, "NumeroREA"), m = S(n, "RegimeFiscale");
	return {
		denominazione: a || [o, s].filter(Boolean).join(" ") || "—",
		idPaese: S(r, "IdPaese"),
		partitaIva: S(r, "IdCodice"),
		codiceFiscale: S(n, "CodiceFiscale"),
		regimeFiscale: m,
		regimeLabel: m ? `${m} — ${t[m] ?? "Regime fiscale"}` : "",
		indirizzo: l,
		cap: S(c, "CAP"),
		comune: S(c, "Comune"),
		provincia: S(c, "Provincia"),
		nazione: S(c, "Nazione"),
		telefono: S(u, "Telefono"),
		email: S(u, "Email"),
		rea: f && p ? `${f}-${p}` : p
	};
}
function E(t) {
	let a = t.trim();
	if (!a) return { invoices: [] };
	let { root: o, error: s } = v(a);
	if (!o) return {
		invoices: [],
		parseError: s ?? "Il file non è un XML ben formato."
	};
	if (!/^FatturaElettronica(Semplificata)?$/.test(o.localName)) return {
		invoices: [],
		parseError: `Elemento radice «${o.localName}» non riconosciuto: carica un file XML o P7M FatturaPA.`
	};
	let c = b(o, "FatturaElettronicaHeader"), l = x(o, "FatturaElettronicaBody");
	if (!c || l.length === 0) return {
		invoices: [],
		parseError: "Struttura FatturaPA incompleta (manca Header o Body)."
	};
	let u = b(c, "DatiTrasmissione"), d = S(u, "FormatoTrasmissione"), f = S(u, "ProgressivoInvio"), p = S(u, "CodiceDestinatario"), m = S(u, "PECDestinatario"), h = T(b(c, "CedentePrestatore")), g = T(b(c, "CessionarioCommittente"));
	return { invoices: l.map((t) => {
		let a = b(t, "DatiGeneraliDocumento"), o = S(a, "TipoDocumento"), s = S(a, "Divisa") || "EUR", c = S(a, "Data"), l = S(a, "Numero"), u = b(a, "DatiBollo"), _ = S(u, "BolloVirtuale").toUpperCase() === "SI", v = C(S(u, "ImportoBollo")), T = x(a, "Causale").map((e) => y(e)).filter(Boolean), E = x(a, "DatiRitenuta").map((e) => ({
			tipo: S(e, "TipoRitenuta"),
			importo: C(S(e, "ImportoRitenuta")),
			aliquota: C(S(e, "AliquotaRitenuta")),
			causalePagamento: S(e, "CausalePagamento")
		})), D = x(a, "DatiCassaPrevidenziale").map((e) => ({
			tipo: S(e, "TipoCassa"),
			alCassa: C(S(e, "AlCassa")),
			importoContributo: C(S(e, "ImportoContributoCassa")),
			aliquotaIVA: C(S(e, "AliquotaIVA")),
			natura: S(e, "Natura")
		})), O = x(t, "DatiFattureCollegate").map((e) => ({
			idDocumento: S(e, "IdDocumento"),
			data: S(e, "Data")
		})), k = x(t, "DatiDDT").map((e) => ({
			numeroDDT: S(e, "NumeroDDT"),
			dataDDT: S(e, "DataDDT")
		})), A = x(t, "DettaglioLinee").map((e) => {
			let t = S(e, "Quantita"), n = x(e, "CodiceArticolo").map((e) => [S(e, "CodiceTipo"), S(e, "CodiceValore")].filter(Boolean).join(": ")).filter(Boolean), r = x(e, "ScontoMaggiorazione").map((e) => {
				let t = S(e, "Tipo") === "MG" ? "+" : "-", n = S(e, "Percentuale"), r = S(e, "Importo");
				return n ? `${t}${C(n)}%` : r ? `${t}${C(r).toFixed(2)}` : "";
			}).filter(Boolean).join(" ");
			return {
				numeroLinea: S(e, "NumeroLinea"),
				codiciArticolo: n,
				descrizione: S(e, "Descrizione"),
				quantita: t ? C(t) : null,
				unitaMisura: S(e, "UnitaMisura"),
				prezzoUnitario: C(S(e, "PrezzoUnitario")),
				sconto: r,
				prezzoTotale: C(S(e, "PrezzoTotale")),
				aliquotaIVA: C(S(e, "AliquotaIVA")),
				natura: S(e, "Natura"),
				ritenuta: S(e, "Ritenuta").toUpperCase() === "SI"
			};
		}), j = x(t, "DatiRiepilogo").map((e) => {
			let t = S(e, "EsigibilitaIVA");
			return {
				aliquotaIVA: C(S(e, "AliquotaIVA")),
				natura: S(e, "Natura"),
				imponibileImporto: C(S(e, "ImponibileImporto")),
				imposta: C(S(e, "Imposta")),
				esigibilitaIVA: t,
				esigibilitaLabel: i[t] ?? t,
				riferimentoNormativo: S(e, "RiferimentoNormativo")
			};
		}), M = w(j.reduce((e, t) => e + t.imponibileImporto, 0)), N = w(j.reduce((e, t) => e + t.imposta, 0)), P = S(a, "ImportoTotaleDocumento"), F = P ? C(P) : w(M + N), I = w(E.reduce((e, t) => e + t.importo, 0)), L = [];
		for (let e of x(t, "DatiPagamento")) {
			let t = S(e, "CondizioniPagamento");
			for (let i of x(e, "DettaglioPagamento")) {
				let e = S(i, "ModalitaPagamento");
				L.push({
					condizioni: t,
					condizioniLabel: r[t] ?? t,
					modalita: e,
					modalitaLabel: e ? `${e} — ${n[e] ?? "Pagamento"}` : "",
					dataScadenza: S(i, "DataScadenzaPagamento"),
					importo: C(S(i, "ImportoPagamento")),
					istitutoFinanziario: S(i, "IstitutoFinanziario"),
					iban: S(i, "IBAN"),
					beneficiario: S(i, "Beneficiario")
				});
			}
		}
		let R = w(L.reduce((e, t) => e + t.importo, 0)), z = R > 0 ? R : w(F - I), B = x(t, "Allegati").map((e) => {
			let t = S(e, "Attachment").replace(/\s+/g, "");
			return {
				nome: S(e, "NomeAttachment") || "allegato",
				formato: S(e, "FormatoAttachment"),
				descrizione: S(e, "DescrizioneAttachment"),
				base64: t,
				approxBytes: Math.floor(t.length * 3 / 4)
			};
		});
		return {
			formatoTrasmissione: d,
			progressivoInvio: f,
			codiceDestinatario: p,
			pecDestinatario: m,
			cedente: h,
			cessionario: g,
			tipoDocumento: o,
			tipoDocumentoLabel: o ? `${o} — ${e[o] ?? "Documento"}` : "Documento",
			divisa: s,
			data: c,
			numero: l,
			importoTotaleDocumento: F,
			imponibileTotale: M,
			impostaTotale: N,
			nettoAPagare: z,
			bolloVirtuale: _,
			importoBollo: v,
			causali: T,
			fattureCollegate: O,
			ddt: k,
			linee: A,
			riepiloghi: j,
			ritenute: E,
			casse: D,
			pagamenti: L,
			allegati: B
		};
	}) };
}
var D = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<p:FatturaElettronica versione=\"FPR12\" xmlns:p=\"http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2\">\n  <FatturaElettronicaHeader>\n    <DatiTrasmissione>\n      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>08365770018</IdCodice></IdTrasmittente>\n      <ProgressivoInvio>00042</ProgressivoInvio>\n      <FormatoTrasmissione>FPR12</FormatoTrasmissione>\n      <CodiceDestinatario>0000000</CodiceDestinatario>\n    </DatiTrasmissione>\n    <CedentePrestatore>\n      <DatiAnagrafici>\n        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567897</IdCodice></IdFiscaleIVA>\n        <CodiceFiscale>01234567897</CodiceFiscale>\n        <Anagrafica><Denominazione>Studio Tecnico Bianchi Ing. Laura</Denominazione></Anagrafica>\n        <RegimeFiscale>RF19</RegimeFiscale>\n      </DatiAnagrafici>\n      <Sede>\n        <Indirizzo>Corso Vittorio Emanuele II</Indirizzo>\n        <NumeroCivico>84</NumeroCivico>\n        <CAP>10121</CAP>\n        <Comune>Torino</Comune>\n        <Provincia>TO</Provincia>\n        <Nazione>IT</Nazione>\n      </Sede>\n      <Contatti>\n        <Email>studio@bianchiesempio.it</Email>\n      </Contatti>\n    </CedentePrestatore>\n    <CessionarioCommittente>\n      <DatiAnagrafici>\n        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01114601006</IdCodice></IdFiscaleIVA>\n        <Anagrafica><Denominazione>Officina Meccanica Verdi S.r.l.</Denominazione></Anagrafica>\n      </DatiAnagrafici>\n      <Sede>\n        <Indirizzo>Via dell'Industria</Indirizzo>\n        <NumeroCivico>12</NumeroCivico>\n        <CAP>10015</CAP>\n        <Comune>Ivrea</Comune>\n        <Provincia>TO</Provincia>\n        <Nazione>IT</Nazione>\n      </Sede>\n    </CessionarioCommittente>\n  </FatturaElettronicaHeader>\n  <FatturaElettronicaBody>\n    <DatiGenerali>\n      <DatiGeneraliDocumento>\n        <TipoDocumento>TD01</TipoDocumento>\n        <Divisa>EUR</Divisa>\n        <Data>2026-11-05</Data>\n        <Numero>42/2026</Numero>\n        <DatiBollo>\n          <BolloVirtuale>SI</BolloVirtuale>\n          <ImportoBollo>2.00</ImportoBollo>\n        </DatiBollo>\n        <DatiCassaPrevidenziale>\n          <TipoCassa>TC04</TipoCassa>\n          <AlCassa>4.00</AlCassa>\n          <ImportoContributoCassa>32.00</ImportoContributoCassa>\n          <ImponibileCassa>800.00</ImponibileCassa>\n          <AliquotaIVA>0.00</AliquotaIVA>\n          <Natura>N2.2</Natura>\n        </DatiCassaPrevidenziale>\n        <ImportoTotaleDocumento>834.00</ImportoTotaleDocumento>\n        <Causale>Operazione effettuata ai sensi dell'art. 1, commi 54-89, della Legge n. 190/2014 — Regime forfettario. Imposta di bollo da 2,00 euro assolta in modo virtuale ai sensi del DM 17/06/2014.</Causale>\n      </DatiGeneraliDocumento>\n    </DatiGenerali>\n    <DatiBeniServizi>\n      <DettaglioLinee>\n        <NumeroLinea>1</NumeroLinea>\n        <Descrizione>Relazione tecnica e pratica energetica capannone industriale</Descrizione>\n        <Quantita>1.00</Quantita>\n        <UnitaMisura> prest. </UnitaMisura>\n        <PrezzoUnitario>800.00</PrezzoUnitario>\n        <PrezzoTotale>800.00</PrezzoTotale>\n        <AliquotaIVA>0.00</AliquotaIVA>\n        <Natura>N2.2</Natura>\n      </DettaglioLinee>\n      <DettaglioLinee>\n        <NumeroLinea>2</NumeroLinea>\n        <Descrizione>Riaddebito imposta di bollo</Descrizione>\n        <Quantita>1.00</Quantita>\n        <PrezzoUnitario>2.00</PrezzoUnitario>\n        <PrezzoTotale>2.00</PrezzoTotale>\n        <AliquotaIVA>0.00</AliquotaIVA>\n        <Natura>N1</Natura>\n      </DettaglioLinee>\n      <DatiRiepilogo>\n        <AliquotaIVA>0.00</AliquotaIVA>\n        <Natura>N2.2</Natura>\n        <ImponibileImporto>832.00</ImponibileImporto>\n        <Imposta>0.00</Imposta>\n        <RiferimentoNormativo>Non soggetta ad IVA ai sensi art. 1 c. 54-89 L. 190/2014</RiferimentoNormativo>\n      </DatiRiepilogo>\n      <DatiRiepilogo>\n        <AliquotaIVA>0.00</AliquotaIVA>\n        <Natura>N1</Natura>\n        <ImponibileImporto>2.00</ImponibileImporto>\n        <Imposta>0.00</Imposta>\n        <RiferimentoNormativo>Escluso ex art. 15 DPR 633/1972</RiferimentoNormativo>\n      </DatiRiepilogo>\n    </DatiBeniServizi>\n    <DatiPagamento>\n      <CondizioniPagamento>TP02</CondizioniPagamento>\n      <DettaglioPagamento>\n        <ModalitaPagamento>MP05</ModalitaPagamento>\n        <DataScadenzaPagamento>2026-12-05</DataScadenzaPagamento>\n        <ImportoPagamento>834.00</ImportoPagamento>\n        <IstitutoFinanziario>Banca d'Esempio</IstitutoFinanziario>\n        <IBAN>IT60X0542811101000000123456</IBAN>\n      </DettaglioPagamento>\n    </DatiPagamento>\n  </FatturaElettronicaBody>\n</p:FatturaElettronica>\n", O = (e) => (e ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"), k = (e) => new Intl.NumberFormat("it-IT", {
	style: "currency",
	currency: "EUR"
}).format(e || 0), A = (e) => new Intl.NumberFormat("it-IT", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
}).format(e || 0), j = (e) => {
	let t = e?.match(/^(\d{4})-(\d{2})-(\d{2})/);
	return t ? `${t[3]}/${t[2]}/${t[1]}` : e || "—";
}, M = "", N = "fattura.xml", P = [], F = document.getElementById("dropzone"), I = document.getElementById("fileInput"), L = document.getElementById("sampleBtn"), R = document.getElementById("errorBox"), z = document.getElementById("toolbar"), B = document.getElementById("fileNameLabel"), V = document.getElementById("signedBadge"), H = document.getElementById("lotSelect"), U = document.getElementById("downloadXmlBtn"), W = document.getElementById("printBtn"), G = document.getElementById("sheetRoot");
function K(e) {
	let t = e.linee.map((e) => `<tr>
      <td>${O(e.numeroLinea)}</td>
      <td>${O(e.descrizione)}</td>
      <td class="num">${e.quantita === null ? "—" : A(e.quantita) + (e.unitaMisura ? " " + O(e.unitaMisura) : "")}</td>
      <td class="num">${A(e.prezzoUnitario)}</td>
      <td class="num">${e.natura ? O(e.natura) : A(e.aliquotaIVA) + "%"}</td>
      <td class="num"><strong>${k(e.prezzoTotale)}</strong></td>
    </tr>`).join(""), n = e.pagamenti.length ? `<div class="box" style="margin-top:16px">
        <h3>Pagamento</h3>
        ${e.pagamenti.map((e) => `<div><strong>${O(e.modalitaLabel)}</strong> — ${k(e.importo)}${e.dataScadenza ? " (scad. " + O(j(e.dataScadenza)) + ")" : ""}${e.iban ? "<br>IBAN: <code>" + O(e.iban) + "</code>" : ""}</div>`).join("")}
      </div>` : "";
	G.innerHTML = `
    <article class="sheet">
      <div class="sheet-head">
        <div>
          <div class="kicker">${O(e.tipoDocumentoLabel)}</div>
          <h2>N. ${O(e.numero || "—")}</h2>
          <div>Data: <strong>${O(j(e.data))}</strong> · Divisa: <strong>${O(e.divisa)}</strong></div>
        </div>
        <div style="text-align:right;font-size:13px;color:#4b5563">
          <div>Formato: <code>${O(e.formatoTrasmissione || "—")}</code></div>
          <div>Cod. destinatario: <code>${O(e.codiceDestinatario || "—")}</code></div>
        </div>
      </div>
      <div class="parties">
        <div class="box">
          <h3>Fornitore (Cedente)</h3>
          <strong>${O(e.cedente.denominazione)}</strong>
          ${e.cedente.partitaIva ? "<div>P.IVA " + O(e.cedente.idPaese + e.cedente.partitaIva) + "</div>" : ""}
          ${e.cedente.codiceFiscale ? "<div>C.F. " + O(e.cedente.codiceFiscale) + "</div>" : ""}
          <div>${O([
		e.cedente.indirizzo,
		e.cedente.cap,
		e.cedente.comune,
		e.cedente.provincia
	].filter(Boolean).join(" "))}</div>
        </div>
        <div class="box">
          <h3>Cliente (Cessionario)</h3>
          <strong>${O(e.cessionario.denominazione)}</strong>
          ${e.cessionario.partitaIva ? "<div>P.IVA " + O(e.cessionario.idPaese + e.cessionario.partitaIva) + "</div>" : ""}
          ${e.cessionario.codiceFiscale ? "<div>C.F. " + O(e.cessionario.codiceFiscale) + "</div>" : ""}
          <div>${O([
		e.cessionario.indirizzo,
		e.cessionario.cap,
		e.cessionario.comune,
		e.cessionario.provincia
	].filter(Boolean).join(" "))}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Descrizione</th><th class="num">Q.tà</th><th class="num">Prezzo</th><th class="num">IVA/Natura</th><th class="num">Totale</th></tr>
        </thead>
        <tbody>${t}</tbody>
      </table>
      <div class="totals">
        <div class="tot-row"><span>Imponibile</span><span>${k(e.imponibileTotale)}</span></div>
        <div class="tot-row"><span>IVA</span><span>${k(e.impostaTotale)}</span></div>
        ${e.bolloVirtuale ? `<div class="tot-row"><span>Bollo virtuale</span><span>${k(e.importoBollo || 2)}</span></div>` : ""}
        <div class="tot-row grand"><span>Totale documento</span><span>${k(e.importoTotaleDocumento)}</span></div>
      </div>
      ${n}
      <div class="print-footer">
        <span>Copia di cortesia senza valore fiscale — l'originale è l'XML transitato dallo SdI.</span>
        <span>fatturaeconomica.it</span>
      </div>
    </article>`;
}
function q(e, t, n) {
	M = e, N = t;
	let r = E(e);
	r.parseError || !r.invoices.length ? (R.hidden = !1, R.textContent = r.parseError || "Nessuna fattura trovata.", z.hidden = !0, G.innerHTML = "") : (R.hidden = !0, P = r.invoices, z.hidden = !1, B.textContent = t, V.hidden = !n, P.length > 1 ? (H.hidden = !1, H.innerHTML = P.map((e, t) => `<option value="${t}">Fattura ${t + 1} (N. ${O(e.numero)})</option>`).join("")) : H.hidden = !0, K(P[0]));
}
async function J(e) {
	let t = g(await e.arrayBuffer());
	t.error ? (R.hidden = !1, R.textContent = t.error, z.hidden = !0, G.innerHTML = "") : q(t.xml, e.name, t.wasSigned);
}
I.addEventListener("change", () => {
	let e = I.files?.[0];
	e && J(e);
}), F.addEventListener("dragover", (e) => {
	e.preventDefault(), F.classList.add("drag");
}), F.addEventListener("dragleave", () => F.classList.remove("drag")), F.addEventListener("drop", (e) => {
	e.preventDefault(), F.classList.remove("drag");
	let t = e.dataTransfer?.files?.[0];
	t && J(t);
}), L.addEventListener("click", () => q(D, "IT01234567897_00042.xml", !1)), H.addEventListener("change", () => {
	let e = Number(H.value);
	P[e] && K(P[e]);
}), U.addEventListener("click", () => {
	let e = N.replace(/\.p7m$/i, ""), t = /\.xml$/i.test(e) ? e : e + ".xml", n = URL.createObjectURL(new Blob([M], { type: "application/xml;charset=utf-8" })), r = document.createElement("a");
	r.href = n, r.download = t, r.click(), setTimeout(() => URL.revokeObjectURL(n), 2e3);
}), W.addEventListener("click", () => window.print());
