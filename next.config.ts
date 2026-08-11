import path from "path";
import type { NextConfig } from "next";

// Raiz do Turbopack = diretório do projeto por padrão. Em execução a partir de
// um git worktree (cujo node_modules vem do repo pai), defina TURBOPACK_ROOT
// para o repo pai para que a resolução de módulos fique dentro da raiz.
const turbopackRoot = process.env.TURBOPACK_ROOT
  ? path.resolve(process.env.TURBOPACK_ROOT)
  : __dirname;

const nextConfig: NextConfig = {
  turbopack: { root: turbopackRoot },
};

export default nextConfig;
