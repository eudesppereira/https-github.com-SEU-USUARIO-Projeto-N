// Demonstração: roda a política de energia + micronutrientes DRI para 4 perfis
// (adulto masculino, adulto feminino, criança/adolescente, idoso).
// Uso: npx tsx scripts/demo-dri.ts
import {
  calcularPerfilMetabolico,
  type Objetivo,
  type Sexo,
} from "../src/lib/calculos";
import {
  resolverEnergia,
  montarBlocoDri,
} from "../src/lib/dri/perfil-dri";

interface Persona {
  rotulo: string;
  sexo: Sexo;
  idade: number;
  pesoKg: number;
  alturaCm: number;
  fatorAtividade: number;
  objetivo: Objetivo;
}

const personas: Persona[] = [
  { rotulo: "Adulto masculino", sexo: "masculino", idade: 35, pesoKg: 80, alturaCm: 178, fatorAtividade: 1.55, objetivo: "emagrecimento" },
  { rotulo: "Adulto feminino", sexo: "feminino", idade: 30, pesoKg: 63, alturaCm: 165, fatorAtividade: 1.375, objetivo: "manutencao" },
  { rotulo: "Crianca/adolescente", sexo: "masculino", idade: 15, pesoKg: 60, alturaCm: 170, fatorAtividade: 1.375, objetivo: "manutencao" },
  { rotulo: "Idoso", sexo: "feminino", idade: 68, pesoKg: 63, alturaCm: 160, fatorAtividade: 1.375, objetivo: "manutencao" },
];

for (const p of personas) {
  const energia = resolverEnergia({
    sexo: p.sexo,
    idadeAnos: p.idade,
    pesoKg: p.pesoKg,
    alturaCm: p.alturaCm,
    fatorAtividade: p.fatorAtividade,
  });

  const perfil = calcularPerfilMetabolico(
    { sexo: p.sexo, idade: p.idade, pesoKg: p.pesoKg, alturaCm: p.alturaCm, fatorAtividade: p.fatorAtividade, objetivo: p.objetivo },
    energia.metodo === "eer_dri" && energia.eerKcal != null
      ? { getOverride: energia.eerKcal, metodoEnergia: "eer_dri", avisoEnergia: energia.aviso }
      : { metodoEnergia: "mifflin_get", avisoEnergia: energia.aviso },
  );

  const bloco = montarBlocoDri({ sexo: p.sexo, idadeAnos: p.idade });
  // amostra: cabeçalho do estágio + 6 primeiras linhas de nutriente
  const linhas = bloco.split("\n");
  const estagio = linhas[1];
  const amostra = linhas.filter((l) => l.startsWith("| ") && !l.startsWith("| Nutriente")).slice(0, 6);

  console.log("\n============================================================");
  console.log(`${p.rotulo}: ${p.sexo}, ${p.idade}a, ${p.pesoKg}kg, ${p.alturaCm}cm, fator ${p.fatorAtividade}, ${p.objetivo}`);
  console.log("------------------------------------------------------------");
  console.log(`Faixa clinica : ${energia.faixa}`);
  console.log(`Metodo energia: ${perfil.metodoEnergia}${perfil.metodoEnergia === "eer_dri" ? "  (EER DRI)" : "  (GET Mifflin - padrao-ouro)"}`);
  console.log(`TMB           : ${perfil.tmb} kcal`);
  console.log(`GET/EER usado : ${perfil.get} kcal${perfil.eerKcal != null ? `  [EER=${perfil.eerKcal}]` : ""}`);
  console.log(`Meta calorica : ${perfil.metaCalorica} kcal`);
  console.log(`Macros        : P ${perfil.macros.proteinaG}g | C ${perfil.macros.carboidratoG}g | G ${perfil.macros.gorduraG}g`);
  console.log(`Agua          : ${perfil.aguaLitros} L`);
  if (perfil.avisoEnergia) console.log(`AVISO energia : ${perfil.avisoEnergia}`);
  console.log(`DRI ${estagio}`);
  console.log("Micronutrientes (amostra):");
  for (const l of amostra) console.log(`  ${l}`);
}

export {};
