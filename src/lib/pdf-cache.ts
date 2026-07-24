import { prisma } from "@/lib/db";
import { gerarDietaPdf, PDF_TEMPLATE_VERSION } from "@/lib/pdf";

// PDF salvo em `Dieta.pdfDados` recebe um prefixo de versão do template. Quando
// o template do plano muda (redesign), a versão sobe e qualquer PDF salvo por um
// template antigo é regenerado no próximo acesso — dietas liberadas antes do
// redesign passam a entregar o novo padrão sem migração de banco.
const PREFIXO_VERSAO = `v${PDF_TEMPLATE_VERSION}:`;

export interface DadosGeracaoPdf {
  clienteNome: string;
  ciclo: number;
  dataLiberacao: Date;
  conteudo: string;
}

// Serializa o PDF com a marca da versão atual do template (usado na liberação).
export function codificarPdf(buffer: Buffer): string {
  return PREFIXO_VERSAO + buffer.toString("base64");
}

// Retorna o PDF atualizado da dieta. Reusa o cache só quando ele foi gerado pela
// versão atual do template; caso contrário (cache vazio ou template antigo)
// regenera e repersiste com o padrão vigente.
export async function obterPdfAtualizado(
  dietaId: string,
  pdfDados: string | null,
  dados: DadosGeracaoPdf
): Promise<Buffer> {
  if (pdfDados?.startsWith(PREFIXO_VERSAO)) {
    return Buffer.from(pdfDados.slice(PREFIXO_VERSAO.length), "base64");
  }
  const buffer = await gerarDietaPdf(dados);
  await prisma.dieta.update({
    where: { id: dietaId },
    data: { pdfDados: codificarPdf(buffer) },
  });
  return buffer;
}
