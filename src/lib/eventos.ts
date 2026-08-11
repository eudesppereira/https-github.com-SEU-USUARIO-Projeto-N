// Parser dos blocos de evento emitidos pelo modelo no fim das mensagens.
// O texto exibido ao cliente nunca contém os blocos.

export type TipoEvento =
  | "consentimento_lgpd"
  | "consentimento_fotos"
  | "anamnese_completa"
  | "checkin"
  | "retorno"
  | "solicitacao_exclusao"
  | "alerta_substituicao";

export interface EventoNutre {
  tipo: TipoEvento;
  payload: Record<string, unknown>;
}

const RE_EVENTO =
  /<<<NUTRE_EVENTO:([a-z_]+)>>>\s*([\s\S]*?)\s*<<<FIM_NUTRE_EVENTO>>>/g;

const TIPOS_VALIDOS: TipoEvento[] = [
  "consentimento_lgpd",
  "consentimento_fotos",
  "anamnese_completa",
  "checkin",
  "retorno",
  "solicitacao_exclusao",
  "alerta_substituicao",
];

export function extrairEventos(texto: string): {
  textoLimpo: string;
  eventos: EventoNutre[];
} {
  const eventos: EventoNutre[] = [];
  const textoLimpo = texto
    .replace(RE_EVENTO, (_m, tipo: string, corpo: string) => {
      if (!TIPOS_VALIDOS.includes(tipo as TipoEvento)) return "";
      let payload: Record<string, unknown> = {};
      const corpoTrim = corpo.trim();
      if (corpoTrim) {
        try {
          // tolera fences de código em volta do JSON
          const json = corpoTrim.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
          payload = JSON.parse(json);
        } catch {
          payload = { _erroParse: true, _bruto: corpoTrim.slice(0, 2000) };
        }
      }
      eventos.push({ tipo: tipo as TipoEvento, payload });
      return "";
    })
    .trim();
  return { textoLimpo, eventos };
}
