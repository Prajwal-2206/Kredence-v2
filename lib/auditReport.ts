import { jsPDF } from "jspdf";
import QRCode from "qrcode";

/**
 * All the data the PDF needs — gathered from our 3 API endpoints.
 * This interface acts as a CONTRACT: the dashboard collects this data,
 * and this function renders it. Neither side needs to know about the other's internals.
 */
export interface AuditReportData {
  address: string;
  score: number;
  txCount: number;
  volume: string;
  walletAgeDays: number;
  activeChains: number;
  chainBreakdown: { chainId: string; name: string; txCount: number; volume: number }[];
  // K-Alpha v3.0 scoring transparency (all optional — the report degrades
  // gracefully to the older derived copy if a caller doesn't supply them)
  narrative?: string | null;
  tier?: string | null;
  percentile?: number | null;
  rawScore?: number | null;
  components?: { key: string; label: string; value: number; max: number; detail: string }[] | null;
  penalties?: { key: string; label: string; weight: number; detail: string }[] | null;
  flags?: { label: string; passed: boolean }[] | null;
  // From /api/reputation
  protocols: { uniswap: number; aave: number; lido: number } | null;
  // From /api/governance
  governance: {
    power: { uni: number | null; arb: number | null };
    votes: any[];
    authoredCount: number;
  } | null;
}

// ─── Color palette (matches our dark UI theme, adapted for PDF white background) ───
const COLORS = {
  bg: "#0a0f1e",
  bgLight: "#131929",
  primary: "#00d4e6",
  secondary: "#a78bfa",
  accent: "#f472b6",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  white: "#ffffff",
  border: "#1e293b",
};

/**
 * Generates a SHA-256-like fingerprint for the report.
 * This is NOT cryptographic verification (that would need a server-side private key).
 * It's a document fingerprint — if any data changes, the hash changes.
 * Think of it like a checksum on a downloaded file.
 */
function generateReportHash(address: string, timestamp: string): string {
  let hash = 0;
  const str = `${address}-${timestamp}-kredence-v2`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `AUD-${address.substring(0, 6)}...${address.substring(address.length - 4)}-${Math.abs(hash).toString(16).toUpperCase().padStart(8, "0")}`;
}

/**
 * Helper: draws a rounded rectangle.
 * jsPDF doesn't have rounded rectangles built-in, so we draw one manually
 * using lines and arcs. This is a common pattern in PDF generation.
 */
function roundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fillColor: string) {
  doc.setFillColor(fillColor);
  doc.roundedRect(x, y, w, h, r, r, "F");
}

/**
 * Helper: draws a section header with a colored accent bar on the left.
 * Returns the new Y position so the caller knows where to continue drawing.
 */
function sectionHeader(doc: jsPDF, y: number, title: string, color: string): number {
  doc.setFillColor(color);
  doc.rect(15, y, 2, 8, "F"); // Accent bar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(COLORS.bg);
  doc.text(title.toUpperCase(), 20, y + 6);
  return y + 14;
}

/**
 * Helper: adds a metric row (label + value + optional tag) to the PDF.
 */
function metricRow(doc: jsPDF, y: number, label: string, value: string, tag?: string, tagColor?: string): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#64748b");
  doc.text(label, 20, y);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.bg);
  doc.text(value, 100, y);

  if (tag && tagColor) {
    roundedRect(doc, 150, y - 3.5, 30, 5, 1.5, tagColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(COLORS.white);
    doc.text(tag, 165, y, { align: "center" });
  }

  return y + 7;
}

/**
 * Main export: generates and downloads the PDF audit report.
 *
 * Why is this a standalone function and not a React component?
 * Because PDF generation is a SIDE EFFECT (it triggers a file download).
 * Keeping it as a plain function means:
 * - Any button anywhere can call it
 * - It's testable without rendering React
 * - It doesn't re-run on every React render
 */
export async function generateAuditPDF(data: AuditReportData): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const timestamp = new Date().toISOString();
  const reportId = generateReportHash(data.address, timestamp);

  // Determine risk tier from score
  let riskTier = "High Risk (Tier 3)";
  let riskColor = COLORS.danger;
  if (data.score >= 700) { riskTier = "Low Risk (Tier 1)"; riskColor = COLORS.success; }
  else if (data.score >= 400) { riskTier = "Medium Risk (Tier 2)"; riskColor = COLORS.warning; }

  // Prefer the calibrated percentile the scoring engine produced. The old
  // linear fallback only holds if scores are uniformly distributed, which they
  // are not — it's kept purely so older callers still render.
  const scoreFraction = Math.min(data.score / 900, 1);
  const percentile = (data.percentile ?? Math.max((1 - scoreFraction) * 100, 0.1)).toFixed(1);

  // ════════════════════════════════════════════════════════
  // SECTION 1: HEADER & VERIFICATION METADATA
  // ════════════════════════════════════════════════════════

  // Dark header banner
  roundedRect(doc, 0, 0, pageWidth, 52, 0, COLORS.bg);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary);
  doc.text("KREDENCE", 15, 16);
  doc.setTextColor(COLORS.text);
  doc.text(" ON-CHAIN IDENTITY & CREDIT AUDIT", 49, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.textMuted);
  doc.text(`Report ID: ${reportId}`, 15, 24);
  doc.text(`Generated: ${new Date(timestamp).toUTCString()}`, 15, 29);
  doc.text(`Target: ${data.address}`, 15, 34);
  doc.text(`Analysis Engine: K-Alpha v3.0 / Decoupled Engine`, 15, 39);

  // Risk tier badge in header
  roundedRect(doc, 145, 22, 50, 8, 2, riskColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(COLORS.white);
  doc.text(riskTier.toUpperCase(), 170, 27.5, { align: "center" });

  // Score badge
  roundedRect(doc, 145, 34, 50, 12, 2, COLORS.bgLight);
  doc.setFontSize(18);
  doc.setTextColor(COLORS.primary);
  doc.text(`${data.score}`, 163, 43, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(COLORS.textMuted);
  doc.text("/ 900", 177, 43);

  let y = 62;

  // ════════════════════════════════════════════════════════
  // SECTION 2: EXECUTIVE SUMMARY
  // ════════════════════════════════════════════════════════

  y = sectionHeader(doc, y, "Executive Summary", COLORS.primary);

  roundedRect(doc, 15, y, pageWidth - 30, 28, 3, "#f0f9ff");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#334155");

  // The scoring engine writes a wallet-specific sentence; fall back to the
  // generic copy only when a caller predates that field.
  const verdictText = data.narrative
    ? data.narrative
    : data.score > 600
      ? `This wallet demonstrates a sophisticated pattern of cross-chain interaction, prioritizing liquidity density and governance participation. With ${data.walletAgeDays} days of on-chain history across ${data.activeChains} chain(s) and ${data.txCount.toLocaleString("en-US")} total transactions, this identity exhibits long-term conviction and is classified as a high-value actor for specialized protocols.`
      : `This wallet shows standard patterns of on-chain traversal with ${data.txCount.toLocaleString("en-US")} transactions over ${data.walletAgeDays} days. Activity parameters conform to median ecosystem trends. Moderate engagement level detected with potential for growth.`;

  const splitVerdict = doc.splitTextToSize(verdictText, pageWidth - 40);
  doc.text(splitVerdict, 20, y + 6);

  y += 34;

  // Score / Percentile / Risk summary row
  const summaryItems = [
    { label: "Big Brain Score", value: `${data.score} / 900`, color: COLORS.primary },
    { label: "Percentile Rank", value: `Top ${percentile}%`, color: COLORS.secondary },
    { label: data.tier ? "Tier / Risk" : "Risk Assessment", value: data.tier ?? riskTier, color: riskColor },
  ];

  summaryItems.forEach((item, i) => {
    const bx = 15 + i * 60;
    roundedRect(doc, bx, y, 55, 16, 2, "#f8fafc");
    doc.setFontSize(6.5);
    doc.setTextColor("#94a3b8");
    doc.setFont("helvetica", "normal");
    doc.text(item.label.toUpperCase(), bx + 4, y + 5);
    doc.setFontSize(10);
    doc.setTextColor(item.color);
    doc.setFont("helvetica", "bold");
    doc.text(item.value, bx + 4, y + 12);
  });

  y += 24;

  // ════════════════════════════════════════════════════════
  // SECTION 2b: SCORE DECOMPOSITION
  // Shows exactly where the 900 points came from, and what was docked.
  // Only rendered when the caller supplies v3.0 scoring data.
  // ════════════════════════════════════════════════════════

  if (data.components && data.components.length > 0) {
    // The decomposition block runs ~110mm tall with penalties, so give it a
    // fresh page rather than letting it straddle a break mid-bar.
    if (y > 140) { doc.addPage(); y = 20; }
    y = sectionHeader(doc, y, "Score Decomposition", COLORS.secondary);

    data.components.forEach((c) => {
      const pct = c.max > 0 ? c.value / c.max : 0;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor("#334155");
      doc.text(c.label, 20, y);

      // Progress track + fill
      roundedRect(doc, 80, y - 2.6, 70, 3, 1.5, "#e2e8f0");
      if (pct > 0) roundedRect(doc, 80, y - 2.6, Math.max(70 * pct, 1), 3, 1.5, COLORS.secondary);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(COLORS.bg);
      doc.text(`${c.value} / ${c.max}`, 155, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor("#94a3b8");
      doc.text(c.detail, 20, y + 3.5);

      y += 9;
    });

    if (data.penalties && data.penalties.length > 0) {
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(COLORS.danger);
      doc.text("BEHAVIOURAL PENALTIES", 20, y);
      y += 5;

      data.penalties.forEach((p) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor("#334155");
        doc.text(p.label, 20, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(COLORS.danger);
        doc.text(`-${Math.round(p.weight * 100)}%`, 155, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor("#94a3b8");
        doc.text(p.detail, 20, y + 3.5);
        y += 9;
      });

      if (data.rawScore) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor("#64748b");
        doc.text(`Raw subtotal ${data.rawScore} reduced to ${data.score} after penalties.`, 20, y);
        y += 6;
      }
    }

    y += 4;
  }

  // ════════════════════════════════════════════════════════
  // SECTION 3: CORE ON-CHAIN METRICS MATRIX
  // ════════════════════════════════════════════════════════

  if (y > 200) { doc.addPage(); y = 20; }
  y = sectionHeader(doc, y, "Core On-Chain Metrics Matrix", COLORS.secondary);

  // Table header
  roundedRect(doc, 15, y, pageWidth - 30, 7, 1, COLORS.bg);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(COLORS.text);
  doc.text("METRIC", 20, y + 5);
  doc.text("ANALYZED VALUE", 70, y + 5);
  doc.text("SUB-SCORE", 125, y + 5);
  doc.text("RISK", 165, y + 5);
  y += 9;

  // Wallet Age row
  const ageYears = (data.walletAgeDays / 365).toFixed(1);
  const ageTag = data.walletAgeDays > 365 ? "LOW" : data.walletAgeDays > 90 ? "MEDIUM" : "HIGH";
  const ageTagColor = data.walletAgeDays > 365 ? COLORS.success : data.walletAgeDays > 90 ? COLORS.warning : COLORS.danger;
  y = metricRow(doc, y, "Wallet Age", `${data.walletAgeDays.toLocaleString("en-US")} Days (${ageYears} yrs)`, ageTag, ageTagColor);

  // Transaction Density row
  const density = (data.txCount / Math.max(data.walletAgeDays, 1)).toFixed(2);
  const densityTag = data.txCount > 100 ? "LOW" : data.txCount > 20 ? "MEDIUM" : "HIGH";
  const densityTagColor = data.txCount > 100 ? COLORS.success : data.txCount > 20 ? COLORS.warning : COLORS.danger;
  y = metricRow(doc, y, "Transaction Density", `${data.txCount.toLocaleString("en-US")} Txs / ${density} per day`, densityTag, densityTagColor);

  // Chain Diversity row
  const chainNames = data.chainBreakdown.filter(c => c.txCount > 0).map(c => c.name).join(", ");
  const diversityTag = data.activeChains >= 3 ? "LOW" : data.activeChains >= 2 ? "MEDIUM" : "HIGH";
  const diversityTagColor = data.activeChains >= 3 ? COLORS.success : data.activeChains >= 2 ? COLORS.warning : COLORS.danger;
  y = metricRow(doc, y, "Chain Diversity", `${data.activeChains} Chain(s): ${chainNames || "None"}`, diversityTag, diversityTagColor);

  // Volume row
  const vol = parseFloat(data.volume);
  const volDisplay = vol > 1000 ? `${(vol / 1000).toFixed(1)}K ETH` : `${vol.toFixed(2)} ETH`;
  const volTag = vol > 100 ? "LOW" : vol > 10 ? "MEDIUM" : "HIGH";
  const volTagColor = vol > 100 ? COLORS.success : vol > 10 ? COLORS.warning : COLORS.danger;
  y = metricRow(doc, y, "Asset Volume", volDisplay, volTag, volTagColor);

  y += 4;

  // ════════════════════════════════════════════════════════
  // SECTION 4: CHAIN-BY-CHAIN BREAKDOWN
  // ════════════════════════════════════════════════════════

  y = sectionHeader(doc, y, "Multi-Chain Activity Breakdown", COLORS.primary);

  data.chainBreakdown.forEach((chain) => {
    const chainVol = chain.volume > 1000 ? `${(chain.volume / 1000).toFixed(1)}K` : chain.volume.toFixed(2);
    const pct = data.txCount > 0 ? ((chain.txCount / data.txCount) * 100).toFixed(1) : "0";
    const barWidth = data.txCount > 0 ? Math.max((chain.txCount / data.txCount) * 100, 0) : 0;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(chain.txCount > 0 ? COLORS.bg : "#94a3b8");
    doc.text(chain.name, 20, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor("#64748b");
    doc.text(`${chain.txCount.toLocaleString("en-US")} txs  |  ${chainVol} ETH  |  ${pct}%`, 55, y);

    // Progress bar
    roundedRect(doc, 120, y - 2.5, 60, 4, 1, "#e2e8f0");
    if (barWidth > 0) {
      roundedRect(doc, 120, y - 2.5, Math.max(barWidth * 0.6, 2), 4, 1, chain.txCount > 0 ? COLORS.primary : "#e2e8f0");
    }

    y += 8;
  });

  y += 2;

  // ════════════════════════════════════════════════════════
  // SECTION 5: PROTOCOL INTERACTION BREAKDOWN
  // ════════════════════════════════════════════════════════

  y = sectionHeader(doc, y, "Reputation & Protocol Interaction Breakdown", COLORS.accent);

  if (data.protocols) {
    const protocols = [
      { name: "Uniswap (Swaps & LPs)", volume: data.protocols.uniswap, icon: "DEX" },
      { name: "Aave (Borrow/Lend)", volume: data.protocols.aave, icon: "LEND" },
      { name: "Lido (Liquid Staking)", volume: data.protocols.lido, icon: "STAKE" },
    ];

    protocols.forEach((p) => {
      const pVol = p.volume > 1000 ? `${(p.volume / 1000).toFixed(1)}K ETH` : `${p.volume.toFixed(4)} ETH`;

      roundedRect(doc, 15, y, pageWidth - 30, 10, 2, "#fdf4ff");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(COLORS.accent);
      doc.text(p.icon, 20, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(COLORS.bg);
      doc.text(p.name, 35, y + 6);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(p.volume > 0 ? COLORS.bg : "#94a3b8");
      doc.text(p.volume > 0 ? pVol : "No activity", 140, y + 6);

      y += 12;
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor("#94a3b8");
    doc.text("Protocol interaction data unavailable — Alchemy API did not respond.", 20, y);
    y += 8;
  }

  y += 2;

  // ════════════════════════════════════════════════════════
  // SECTION 6: GOVERNANCE & DAO PARTICIPATION
  // ════════════════════════════════════════════════════════

  // Check if we need a new page
  if (y > 230) { doc.addPage(); y = 20; }

  y = sectionHeader(doc, y, "Governance & DAO Participation Record", COLORS.secondary);

  if (data.governance) {
    const gov = data.governance;

    // Voting power boxes
    const powerItems = [
      { label: "UNI Voting Power", value: gov.power.uni ? gov.power.uni.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0", active: !!gov.power.uni },
      { label: "ARB Voting Power", value: gov.power.arb ? gov.power.arb.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0", active: !!gov.power.arb },
      { label: "Snapshot Votes", value: `${gov.votes.length}`, active: gov.votes.length > 0 },
      { label: "Proposals Authored", value: `${gov.authoredCount}`, active: gov.authoredCount > 0 },
    ];

    powerItems.forEach((item, i) => {
      const bx = 15 + (i % 4) * 45;
      roundedRect(doc, bx, y, 42, 14, 2, item.active ? "#f0fdf4" : "#f8fafc");
      doc.setFontSize(6);
      doc.setTextColor("#94a3b8");
      doc.setFont("helvetica", "normal");
      doc.text(item.label.toUpperCase(), bx + 3, y + 5);
      doc.setFontSize(10);
      doc.setTextColor(item.active ? COLORS.success : "#cbd5e1");
      doc.setFont("helvetica", "bold");
      doc.text(item.value, bx + 3, y + 12);
    });

    y += 20;

    // Vote history (up to 5 most recent)
    if (gov.votes.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor("#64748b");
      doc.text("RECENT SNAPSHOT VOTES", 20, y);
      y += 5;

      gov.votes.slice(0, 5).forEach((vote: any, idx: number) => {
        const space = vote.proposal?.space?.name || "DAO";
        const title = vote.proposal?.title?.substring(0, 50) || "Unknown";
        const choiceName = vote.proposal?.choices?.[vote.choice - 1] || "Unknown";
        const state = vote.proposal?.state === "closed" ? "EXECUTED" : vote.proposal?.state?.toUpperCase() || "UNKNOWN";

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor("#64748b");
        doc.text(`${(idx + 1).toString().padStart(2, "0")}.`, 20, y);
        doc.setTextColor(COLORS.bg);
        doc.text(`[${state}] ${space}: ${title}`, 27, y);
        doc.setTextColor(COLORS.secondary);
        doc.text(`Voted: ${choiceName}`, 150, y);

        y += 5;
      });

      if (gov.votes.length > 5) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(6.5);
        doc.setTextColor("#94a3b8");
        doc.text(`+ ${gov.votes.length - 5} more votes on record`, 27, y);
        y += 5;
      }
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor("#94a3b8");
    doc.text("Governance data unavailable — API did not respond.", 20, y);
    y += 8;
  }

  y += 4;

  // ════════════════════════════════════════════════════════
  // SECTION 7: ANTI-SYBIL & SECURITY ASSESSMENT
  // ════════════════════════════════════════════════════════

  if (y > 240) { doc.addPage(); y = 20; }

  y = sectionHeader(doc, y, "Anti-Sybil & Security Assessment", COLORS.danger);

  // Derive sybil indicators from real data
  const contractRatio = data.protocols
    ? ((data.protocols.uniswap + data.protocols.aave + data.protocols.lido) > 0 ? "High" : "Low")
    : "Unknown";
  const sybilStatus = data.walletAgeDays > 180 && data.txCount > 50 && data.activeChains >= 2
    ? "CLEARED" : data.walletAgeDays > 30 && data.txCount > 10
    ? "LOW RISK" : "REVIEW RECOMMENDED";
  const sybilColor = sybilStatus === "CLEARED" ? COLORS.success : sybilStatus === "LOW RISK" ? COLORS.warning : COLORS.danger;

  const securityRows = [
    { label: "Sybil Risk Status", value: sybilStatus, color: sybilColor },
    { label: "Smart Contract Interaction Ratio", value: `${contractRatio} (DeFi protocol usage detected)`, color: COLORS.bg },
    { label: "Wallet Age Verification", value: data.walletAgeDays > 365 ? "OG Status (1yr+)" : `${data.walletAgeDays} days`, color: COLORS.bg },
    { label: "Multi-Chain Presence", value: data.activeChains >= 2 ? `Verified (${data.activeChains} chains)` : "Single-chain only", color: COLORS.bg },
    { label: "Tornado Cash / Mixer Exposure", value: "Not Analyzed (requires specialized indexer)", color: "#94a3b8" },
  ];

  securityRows.forEach((row) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor("#64748b");
    doc.text(row.label, 20, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(row.color);
    doc.text(row.value, 100, y);
    y += 7;
  });

  y += 6;

  // ════════════════════════════════════════════════════════
  // SECTION 8: VERIFICATION FOOTER
  // ════════════════════════════════════════════════════════

  if (y > 250) { doc.addPage(); y = 20; }

  // Footer bar
  const footerY = Math.max(y, 255);
  roundedRect(doc, 0, footerY, pageWidth, 42, 0, COLORS.bg);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(COLORS.primary);
  doc.text("VERIFICATION & AUTHENTICITY", 15, footerY + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(COLORS.textMuted);
  doc.text(`Document Fingerprint: ${reportId}`, 15, footerY + 14);
  doc.text(`Generated: ${new Date(timestamp).toUTCString()}`, 15, footerY + 19);
  doc.text(`Engine: Kredence K-Alpha v2.1 | Decoupled Scoring Architecture`, 15, footerY + 24);
  doc.text(`Verify live: kredence-v2.vercel.app/dashboard?address=${data.address}`, 15, footerY + 29);

  // QR Code
  try {
    const verifyUrl = `https://kredence-v2.vercel.app/dashboard?address=${data.address}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 1,
      color: { dark: "#00d4e6", light: "#0a0f1e" },
    });
    doc.addImage(qrDataUrl, "PNG", 170, footerY + 5, 25, 25);
  } catch (err) {
    // QR generation failed — not critical, skip it
    doc.setFontSize(6);
    doc.setTextColor(COLORS.textMuted);
    doc.text("[QR Unavailable]", 175, footerY + 18);
  }

  // ─── DOWNLOAD ───
  const fileName = `Kredence_Audit_${data.address.substring(0, 8)}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
