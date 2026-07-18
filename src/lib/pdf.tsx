// Geração do PDF do plano alimentar liberado. Cabeçalho com marca do
// consultório (paleta oficial do MIV Eudes Pereira — navy + ciano); o brasão
// é um placeholder desenhado em SVG até o arquivo de logo real ser
// exportado para public/brand/.
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Circle,
  renderToBuffer,
} from "@react-pdf/renderer";
import { parsearDieta, type DietaItem } from "./dieta-parse";

const NAVY = "#0b1c33";
const CYAN = "#45c7f4";
const CHARCOAL = "#4b4b4d";
const LINE = "#e2e5e8";
const CIANO_SUAVE = "#eef8fd";

const styles = StyleSheet.create({
  page: { fontSize: 10, color: CHARCOAL, paddingBottom: 48 },
  header: {
    backgroundColor: NAVY,
    paddingVertical: 22,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerTexto: { flexDirection: "column" },
  marca: { fontSize: 15, fontWeight: 700, color: "#ffffff", letterSpacing: 0.5 },
  marcaSub: { fontSize: 8, color: CYAN, letterSpacing: 2, marginTop: 2 },
  corpo: { paddingHorizontal: 32, paddingTop: 20 },
  faixaPaciente: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 10,
    marginBottom: 16,
  },
  tituloSecao: {
    fontSize: 10,
    fontWeight: 700,
    color: NAVY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  gridChave: { fontSize: 8, color: "#8a8f94", textTransform: "uppercase" },
  gridValor: { fontSize: 10, color: NAVY, fontWeight: 700, marginTop: 1 },

  // "evidência" — perfil metabólico + macros num único cartão, mesma família visual
  cartaoPerfil: {
    borderWidth: 1,
    borderColor: CYAN,
    borderLeftWidth: 4,
    backgroundColor: CIANO_SUAVE,
    borderRadius: 6,
    padding: 14,
  },
  metaHero: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 10 },
  metaHeroNumero: { fontSize: 26, fontWeight: 700, color: NAVY },
  metaHeroUnidade: { fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 3 },
  metaHeroObjetivo: {
    fontSize: 8.5,
    color: "#3f7ea3",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statsSecundarios: { flexDirection: "row", gap: 22, marginBottom: 12 },
  macrosLinha: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  macroChip: {
    flex: 1,
    minWidth: 90,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: LINE,
    borderTopWidth: 3,
    borderTopColor: CYAN,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  macroChipValor: { fontSize: 9, fontWeight: 700, color: NAVY },
  macroChipRotulo: { fontSize: 7.5, color: "#8a8f94", textTransform: "uppercase", marginTop: 1 },

  refeicao: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    overflow: "hidden",
  },
  refeicaoTitulo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: NAVY,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  refeicaoNumero: {
    fontSize: 8,
    fontWeight: 700,
    color: NAVY,
    backgroundColor: CYAN,
    width: 14,
    height: 14,
    borderRadius: 7,
    textAlign: "center",
  },
  refeicaoTituloTexto: { fontSize: 10, fontWeight: 700, color: "#ffffff" },
  // cabeçalho das colunas do cardápio (Alimento | Medida caseira | Quantidade)
  itemCabecalho: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#eef2f5",
  },
  itemCabecalhoTexto: {
    fontSize: 7,
    fontWeight: 700,
    color: "#6b7075",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  colGramasCabecalho: { minWidth: 34, marginLeft: 8, textAlign: "center" },
  linhaItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  linhaItemPar: { backgroundColor: "#fafbfc" },
  colAlimento: { flex: 2, fontSize: 9.5, color: CHARCOAL },
  colMedida: { flex: 1.6, textAlign: "right", fontSize: 8.5, color: "#8a8f94" },
  colGramas: {
    fontSize: 8.5,
    fontWeight: 700,
    color: NAVY,
    backgroundColor: CIANO_SUAVE,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginLeft: 8,
    minWidth: 34,
    textAlign: "center",
  },
  subtotal: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontSize: 8.5,
    fontWeight: 700,
    color: NAVY,
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: "#f3f7fa",
  },
  paragrafo: { fontSize: 9.5, lineHeight: 1.5, color: CHARCOAL },
  aviso: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#f0b64d",
    backgroundColor: "#fff8ec",
    borderRadius: 4,
    padding: 10,
  },
  rodape: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LINE,
    fontSize: 7.5,
    color: "#8a8f94",
    lineHeight: 1.4,
  },
});

// Brasão placeholder — escudo simples em navy/ciano com monograma, no
// espírito do símbolo oficial (casal atlético + balança) até o arquivo
// exportado do MIV substituir este componente.
function BrasaoPlaceholder() {
  return (
    <Svg width={34} height={34} viewBox="0 0 40 40">
      <Path
        d="M20 2 L36 8 V20 C36 30 29 36 20 39 C11 36 4 30 4 20 V8 Z"
        fill={NAVY}
        stroke={CYAN}
        strokeWidth={1.5}
      />
      <Circle cx={20} cy={18} r={8} fill="none" stroke={CYAN} strokeWidth={1.2} />
      <Path d="M15 22 L25 22 L23 30 L17 30 Z" fill={CYAN} opacity={0.9} />
    </Svg>
  );
}

interface DadosPdf {
  clienteNome: string;
  ciclo: number;
  dataLiberacao: Date;
  conteudo: string;
}

function Cabecalho() {
  return (
    <View style={styles.header} fixed>
      <BrasaoPlaceholder />
      <View style={styles.headerTexto}>
        <Text style={styles.marca}>EUDES PEREIRA</Text>
        <Text style={styles.marcaSub}>NUTRICIONISTA · CRN 52959</Text>
      </View>
    </View>
  );
}

const CHAVES_MACRO = ["proteinas", "carboidratos", "gorduras", "agua"];

function normalizarChave(chave: string): string {
  return chave
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function extrairNumero(valor: string): { numero: string; resto: string } {
  const m = valor.match(/^([\d.,]+)\s*(.*)$/);
  return m ? { numero: m[1], resto: m[2] } : { numero: valor, resto: "" };
}

function CartaoPerfilEMacros({ perfil }: { perfil: [string, string][] }) {
  const macros = perfil.filter(([k]) => CHAVES_MACRO.includes(normalizarChave(k)));
  const nucleo = perfil.filter(([k]) => !CHAVES_MACRO.includes(normalizarChave(k)));
  const meta = nucleo.find(([k]) => normalizarChave(k).includes("meta calorica"));
  const outrosNucleo = nucleo.filter(([k]) => k !== meta?.[0]);
  const metaPartes = meta ? extrairNumero(meta[1]) : null;

  return (
    <View style={styles.cartaoPerfil}>
      {metaPartes && (
        <View style={styles.metaHero}>
          <Text style={styles.metaHeroNumero}>{metaPartes.numero}</Text>
          <Text style={styles.metaHeroUnidade}>kcal/dia</Text>
          <Text style={styles.metaHeroObjetivo}>{metaPartes.resto}</Text>
        </View>
      )}
      {outrosNucleo.length > 0 && (
        <View style={styles.statsSecundarios}>
          {outrosNucleo.map(([k, v]) => (
            <View key={k}>
              <Text style={styles.gridChave}>{k}</Text>
              <Text style={styles.gridValor}>{v}</Text>
            </View>
          ))}
        </View>
      )}
      {macros.length > 0 && (
        <View style={styles.macrosLinha}>
          {macros.map(([k, v]) => (
            <View key={k} style={styles.macroChip}>
              <Text style={styles.macroChipValor}>{v}</Text>
              <Text style={styles.macroChipRotulo}>{k}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function LinhaItemCardapio({ item, index }: { item: DietaItem; index: number }) {
  const estiloLinha = index % 2 === 1 ? [styles.linhaItem, styles.linhaItemPar] : [styles.linhaItem];
  return (
    <View style={estiloLinha}>
      <Text style={styles.colAlimento}>{item.alimento}</Text>
      <Text style={styles.colMedida}>{item.medidaCaseira ?? ""}</Text>
      {item.gramas && <Text style={styles.colGramas}>{item.gramas}</Text>}
    </View>
  );
}

// Helvetica (fonte padrão do react-pdf) não tem glifo pro sinal de menos
// unicode (−, U+2212) usado no prompt — vira espaço em branco. Normaliza
// pro hífen comum antes de desenhar qualquer texto no PDF.
function normalizarParaPdf(texto: string): string {
  return texto.replace(/−/g, "-");
}

function DocumentoDieta({ clienteNome, ciclo, dataLiberacao, conteudo }: DadosPdf) {
  const dieta = parsearDieta(normalizarParaPdf(conteudo));
  const dataFmt = dataLiberacao.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Document title={`Plano alimentar — ${clienteNome}`}>
      <Page size="A4" style={styles.page}>
        <Cabecalho />

        <View style={styles.corpo}>
          <View style={styles.faixaPaciente}>
            <View>
              <Text style={styles.gridChave}>Paciente</Text>
              <Text style={styles.gridValor}>{clienteNome}</Text>
            </View>
            <View>
              <Text style={styles.gridChave}>Ciclo</Text>
              <Text style={styles.gridValor}>{ciclo}</Text>
            </View>
            <View>
              <Text style={styles.gridChave}>Data</Text>
              <Text style={styles.gridValor}>{dataFmt}</Text>
            </View>
          </View>

          {dieta.perfil.length > 0 && (
            <>
              <Text style={styles.tituloSecao}>Perfil metabólico</Text>
              <CartaoPerfilEMacros perfil={dieta.perfil} />
            </>
          )}

          {dieta.refeicoes.length > 0 ? (
            <View break>
              <Text style={[styles.tituloSecao, { marginTop: 0 }]}>Plano alimentar</Text>
              {dieta.refeicoes.map((r, i) => (
                <View key={`${r.titulo}-${i}`} style={styles.refeicao} wrap={false}>
                  <View style={styles.refeicaoTitulo}>
                    <Text style={styles.refeicaoNumero}>{i + 1}</Text>
                    <Text style={styles.refeicaoTituloTexto}>{r.titulo}</Text>
                  </View>
                  {r.itens.length > 0 && (
                    <View style={styles.itemCabecalho}>
                      <Text style={[styles.colAlimento, styles.itemCabecalhoTexto]}>Alimento</Text>
                      <Text style={[styles.colMedida, styles.itemCabecalhoTexto]}>Medida caseira</Text>
                      <Text style={[styles.itemCabecalhoTexto, styles.colGramasCabecalho]}>Qtd</Text>
                    </View>
                  )}
                  {r.itens.map((item, j) => (
                    <LinhaItemCardapio key={j} item={item} index={j} />
                  ))}
                  {r.subtotal && (
                    <Text style={styles.subtotal}>Total da refeição: {r.subtotal}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View break>
              <Text style={[styles.tituloSecao, { marginTop: 0 }]}>Plano alimentar</Text>
              <Text style={styles.paragrafo}>{dieta.bruto}</Text>
            </View>
          )}

          {dieta.substituicoes.length > 0 && (
            <>
              <Text style={styles.tituloSecao}>Substituições equivalentes</Text>
              {dieta.substituicoes.map((s, i) => (
                <Text key={i} style={[styles.paragrafo, { marginBottom: 3 }]}>
                  {s}
                </Text>
              ))}
            </>
          )}

          {dieta.orientacoes && (
            <>
              <Text style={styles.tituloSecao}>Orientações</Text>
              <Text style={styles.paragrafo}>{dieta.orientacoes}</Text>
            </>
          )}

          {dieta.observacoesClinicas && (
            <View style={styles.aviso}>
              <Text style={[styles.paragrafo, { fontWeight: 700, marginBottom: 3 }]}>
                Observações clínicas
              </Text>
              <Text style={styles.paragrafo}>{dieta.observacoesClinicas}</Text>
            </View>
          )}

          {dieta.acompanhamento && (
            <>
              <Text style={styles.tituloSecao}>Acompanhamento</Text>
              <Text style={styles.paragrafo}>{dieta.acompanhamento}</Text>
            </>
          )}

          <Text style={styles.rodape}>
            {dieta.disclaimer ??
              "Este plano tem caráter de informação e orientação nutricional, elaborado com base nas informações fornecidas."}
            {"\n"}Plano revisado e liberado pelo nutricionista Eudes Pereira — CRN 52959 · gerado
            em {dataFmt}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function gerarDietaPdf(dados: DadosPdf): Promise<Buffer> {
  return renderToBuffer(<DocumentoDieta {...dados} />);
}
