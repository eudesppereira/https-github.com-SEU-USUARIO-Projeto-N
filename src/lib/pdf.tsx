// Geração do PDF do plano alimentar liberado. Layout segue a identidade
// "Nutre.AI" (cabeçalho em gradiente verde→preto, wordmark, faixa de métricas,
// cartões de macros, refeições em duas colunas e caixa de observações verde).
// react-pdf não aceita oklch()/gradiente em CSS, então usamos hex e desenhamos
// o gradiente do cabeçalho via SVG.
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  renderToBuffer,
} from "@react-pdf/renderer";
import { parsearDieta, type DietaItem } from "./dieta-parse";

// Versão do template. Suba este número sempre que o layout mudar: PDFs salvos
// por versões antigas são regenerados no próximo acesso (ver lib/pdf-cache.ts).
export const PDF_TEMPLATE_VERSION = 3;

// PALETA — padrão Nutre.AI
const VERDE_ESCURO = "#0f3d26"; // base do cabeçalho e "N" do brasão
const VERDE = "#1f9d57"; // acento (".AI", meta diária)
const VERDE_NUM = "#15803d"; // números dos macros (verde-floresta)
const VERDE_BOX = "#e9f4ec"; // fundo da caixa de observações
const INK = "#1a1d1b"; // texto forte (quase preto)
const INK_SUAVE = "#6b7280"; // texto secundário / medida caseira
const ROTULO = "#8a8f94"; // rótulos uppercase
const LINE = "#e5e7eb"; // bordas / divisores
const LINE_SUAVE = "#eef0ee"; // divisor de linhas da tabela

const HEADER_H = 96;
const PAGE_W = 595.28; // A4 em pt

const styles = StyleSheet.create({
  page: { fontSize: 10, color: INK, paddingBottom: 56 },

  // ---- cabeçalho
  header: { height: HEADER_H, position: "relative", justifyContent: "center" },
  headerBg: { position: "absolute", top: 0, left: 0 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
  },
  marcaGrupo: { flexDirection: "row", alignItems: "center", gap: 10 },
  brasao: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  brasaoLetra: { fontSize: 16, fontWeight: 700, color: VERDE_ESCURO },
  wordmarkLinha: { flexDirection: "row", alignItems: "center" },
  wordmark: { fontSize: 17, fontWeight: 700, color: "#ffffff" },
  wordmarkAcento: { fontSize: 17, fontWeight: 700, color: VERDE },
  emitido: { fontSize: 8.5, color: "#9fb0a6" },

  // ---- corpo
  corpo: { paddingHorizontal: 32, paddingTop: 22 },
  titulo: { fontSize: 22, fontWeight: 700, color: INK, letterSpacing: -0.3 },
  subtitulo: { fontSize: 10, color: INK_SUAVE, marginTop: 4 },

  // ---- faixa de métricas (Objetivo · TMB · GET · Meta)
  metricas: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 8,
    marginTop: 18,
    overflow: "hidden",
  },
  metricaCelula: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: LINE,
  },
  metricaCelulaFim: { borderRightWidth: 0 },
  metricaRotulo: { fontSize: 7.5, color: ROTULO, textTransform: "uppercase", letterSpacing: 0.6 },
  metricaValor: { fontSize: 12, fontWeight: 700, color: INK, marginTop: 3 },
  metricaValorMeta: { color: VERDE },

  // ---- rótulos de seção
  secaoRotulo: {
    fontSize: 8.5,
    fontWeight: 700,
    color: ROTULO,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 10,
  },

  // ---- cartões de macros
  macrosLinha: { flexDirection: "row", gap: 12 },
  macroCartao: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
  },
  macroNumero: { fontSize: 21, fontWeight: 700, color: VERDE_NUM },
  macroRotulo: { fontSize: 9, color: INK_SUAVE, marginTop: 3 },

  // ---- refeições (duas colunas)
  refeicao: { flexDirection: "row", paddingTop: 14, marginTop: 14, borderTopWidth: 1, borderTopColor: LINE },
  refeicaoPrimeira: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
  refeicaoInfo: { width: 128, paddingRight: 12 },
  refeicaoNome: { fontSize: 11, fontWeight: 700, color: INK },
  refeicaoDetalhe: { fontSize: 8.5, color: INK_SUAVE, marginTop: 3 },
  refeicaoTabela: { flex: 1 },

  itemCabecalho: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  itemCabecalhoTexto: { fontSize: 7, fontWeight: 700, color: ROTULO, textTransform: "uppercase", letterSpacing: 0.4 },
  linhaItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: LINE_SUAVE,
  },
  colAlimento: { flex: 2, fontSize: 9.5, color: INK },
  colMedida: { flex: 1.5, fontSize: 9, color: INK_SUAVE, textAlign: "right", paddingRight: 8 },
  colGramas: { width: 46, fontSize: 9.5, fontWeight: 700, color: INK, textAlign: "right" },
  subtotal: { fontSize: 8.5, color: INK_SUAVE, textAlign: "right", marginTop: 6 },

  // ---- blocos de texto
  paragrafo: { fontSize: 9.5, lineHeight: 1.5, color: INK },
  listaSub: { fontSize: 9.5, lineHeight: 1.5, color: INK, marginBottom: 2 },

  caixaObs: {
    marginTop: 22,
    backgroundColor: VERDE_BOX,
    borderRadius: 10,
    padding: 16,
  },
  caixaObsTitulo: {
    fontSize: 8.5,
    fontWeight: 700,
    color: VERDE_NUM,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  caixaObsTexto: { fontSize: 9.5, lineHeight: 1.5, color: "#2f3a33" },

  aviso: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#f0b64d",
    backgroundColor: "#fff8ec",
    borderRadius: 10,
    padding: 14,
  },
  avisoTitulo: { fontSize: 8.5, fontWeight: 700, color: "#8a5a00", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },

  // ---- rodapé
  rodape: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    marginHorizontal: 32,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: LINE,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rodapeTexto: { fontSize: 7.5, color: ROTULO },
  disclaimer: { fontSize: 7.5, lineHeight: 1.4, color: ROTULO, marginTop: 22 },
});

interface DadosPdf {
  clienteNome: string;
  ciclo: number;
  dataLiberacao: Date;
  conteudo: string;
}

const CHAVES_MACRO = ["proteinas", "carboidratos", "gorduras", "agua"];

function normalizarChave(chave: string): string {
  return chave
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Helvetica (fonte padrão do react-pdf) não tem glifo pro sinal de menos
// unicode (−, U+2212) — normaliza pro hífen comum antes de desenhar.
function normalizarParaPdf(texto: string): string {
  return texto.replace(/−/g, "-");
}

// "Café da manhã — 7h · 420 kcal" → { nome: "Café da manhã", detalhe: "7h · 420 kcal" }
function separarTitulo(titulo: string): { nome: string; detalhe: string | null } {
  const m = titulo.match(/^(.*?)\s*(?:[—–-]|\(|·)\s*(.+?)\)?\s*$/);
  if (m) return { nome: m[1].trim(), detalhe: m[2].trim() };
  return { nome: titulo.trim(), detalhe: null };
}

function Cabecalho({ dataFmt }: { dataFmt: string }) {
  return (
    <View style={styles.header} fixed>
      <Svg style={styles.headerBg} width={PAGE_W} height={HEADER_H} viewBox={`0 0 ${PAGE_W} ${HEADER_H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="hdr" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={VERDE_ESCURO} />
            <Stop offset="0.55" stopColor="#0d2018" />
            <Stop offset="1" stopColor="#080d0a" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={PAGE_W} height={HEADER_H} fill="url(#hdr)" />
      </Svg>
      <View style={styles.headerRow}>
        <View style={styles.marcaGrupo}>
          <View style={styles.brasao}>
            <Text style={styles.brasaoLetra}>N</Text>
          </View>
          <View style={styles.wordmarkLinha}>
            <Text style={styles.wordmark}>Nutre</Text>
            <Text style={styles.wordmarkAcento}>.AI</Text>
          </View>
        </View>
        <Text style={styles.emitido}>Emitido em {dataFmt}</Text>
      </View>
    </View>
  );
}

function FaixaMetricas({ nucleo }: { nucleo: [string, string][] }) {
  const celulas = nucleo.slice(0, 4);
  return (
    <View style={styles.metricas}>
      {celulas.map(([k, v], i) => {
        const ehMeta = normalizarChave(k).includes("meta");
        const estiloCelula =
          i === celulas.length - 1 ? [styles.metricaCelula, styles.metricaCelulaFim] : [styles.metricaCelula];
        return (
          <View key={k} style={estiloCelula}>
            <Text style={styles.metricaRotulo}>{k}</Text>
            <Text style={ehMeta ? [styles.metricaValor, styles.metricaValorMeta] : [styles.metricaValor]}>{v}</Text>
          </View>
        );
      })}
    </View>
  );
}

function CartoesMacros({ macros }: { macros: [string, string][] }) {
  return (
    <View style={styles.macrosLinha}>
      {macros.map(([k, v]) => (
        <View key={k} style={styles.macroCartao}>
          <Text style={styles.macroNumero}>{v}</Text>
          <Text style={styles.macroRotulo}>{k}</Text>
        </View>
      ))}
    </View>
  );
}

function LinhaItemCardapio({ item }: { item: DietaItem }) {
  return (
    <View style={styles.linhaItem}>
      <Text style={styles.colAlimento}>{item.alimento}</Text>
      <Text style={styles.colMedida}>{item.medidaCaseira ?? "—"}</Text>
      <Text style={styles.colGramas}>{item.gramas ?? "—"}</Text>
    </View>
  );
}

function DocumentoDieta({ clienteNome, ciclo, dataLiberacao, conteudo }: DadosPdf) {
  const dieta = parsearDieta(normalizarParaPdf(conteudo));
  const dataFmt = dataLiberacao.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const macros = dieta.perfil.filter(([k]) => CHAVES_MACRO.includes(normalizarChave(k)));
  const nucleo = dieta.perfil.filter(([k]) => !CHAVES_MACRO.includes(normalizarChave(k)));
  const observacoes = [dieta.orientacoes, dieta.acompanhamento].filter(Boolean).join("\n\n");

  return (
    <Document title={`Plano alimentar — ${clienteNome}`}>
      <Page size="A4" style={styles.page}>
        <Cabecalho dataFmt={dataFmt} />

        <View style={styles.corpo}>
          <Text style={styles.titulo}>Plano Alimentar Personalizado</Text>
          <Text style={styles.subtitulo}>
            {clienteNome} · Ciclo {ciclo} · Elaborado por Eudes Pereira — CRN 52959
          </Text>

          {nucleo.length > 0 && <FaixaMetricas nucleo={nucleo} />}

          {macros.length > 0 && (
            <>
              <Text style={styles.secaoRotulo}>Distribuição de macros</Text>
              <CartoesMacros macros={macros} />
            </>
          )}

          {dieta.refeicoes.length > 0 ? (
            <>
              <Text style={styles.secaoRotulo}>Refeições do dia</Text>
              {dieta.refeicoes.map((r, i) => {
                const { nome, detalhe } = separarTitulo(r.titulo);
                const estilo = i === 0 ? [styles.refeicao, styles.refeicaoPrimeira] : [styles.refeicao];
                return (
                  <View key={`${r.titulo}-${i}`} style={estilo} wrap={false}>
                    <View style={styles.refeicaoInfo}>
                      <Text style={styles.refeicaoNome}>{nome}</Text>
                      {detalhe && <Text style={styles.refeicaoDetalhe}>{detalhe}</Text>}
                    </View>
                    <View style={styles.refeicaoTabela}>
                      {r.itens.length > 0 && (
                        <View style={styles.itemCabecalho}>
                          <Text style={[styles.colAlimento, styles.itemCabecalhoTexto]}>Alimento</Text>
                          <Text style={[styles.colMedida, styles.itemCabecalhoTexto]}>Medida caseira</Text>
                          <Text style={[styles.colGramas, styles.itemCabecalhoTexto]}>Gramas</Text>
                        </View>
                      )}
                      {r.itens.map((item, j) => (
                        <LinhaItemCardapio key={j} item={item} />
                      ))}
                      {r.subtotal && <Text style={styles.subtotal}>Total da refeição: {r.subtotal}</Text>}
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <>
              <Text style={styles.secaoRotulo}>Plano alimentar</Text>
              <Text style={styles.paragrafo}>{dieta.bruto}</Text>
            </>
          )}

          {dieta.substituicoes.length > 0 && (
            <>
              <Text style={styles.secaoRotulo}>Substituições equivalentes</Text>
              {dieta.substituicoes.map((s, i) => (
                <Text key={i} style={styles.listaSub}>
                  {s}
                </Text>
              ))}
            </>
          )}

          {observacoes && (
            <View style={styles.caixaObs}>
              <Text style={styles.caixaObsTitulo}>Observações do nutricionista</Text>
              <Text style={styles.caixaObsTexto}>{observacoes}</Text>
            </View>
          )}

          {dieta.observacoesClinicas && (
            <View style={styles.aviso}>
              <Text style={styles.avisoTitulo}>Observações clínicas</Text>
              <Text style={styles.paragrafo}>{dieta.observacoesClinicas}</Text>
            </View>
          )}

          <Text style={styles.disclaimer}>
            {dieta.disclaimer ??
              "Este plano tem caráter de informação e orientação nutricional, elaborado com base nas informações fornecidas."}
            {"\n"}Plano revisado e liberado pelo nutricionista Eudes Pereira — CRN 52959 · gerado em {dataFmt}
          </Text>
        </View>

        <View style={styles.rodape} fixed>
          <Text style={styles.rodapeTexto}>Nutre.AI · Nutricionista Eudes Pereira — CRN 52959</Text>
          <Text style={styles.rodapeTexto}>Documento gerado para acompanhamento nutricional</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function gerarDietaPdf(dados: DadosPdf): Promise<Buffer> {
  return renderToBuffer(<DocumentoDieta {...dados} />);
}
