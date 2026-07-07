import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-700 text-3xl font-bold text-white">
        N
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Nutre.AI</h1>
      <p className="max-w-sm text-sm text-gray-600">
        Avaliação e acompanhamento nutricional com revisão profissional do
        nutricionista Eudes Pereira — CRN 52959.
      </p>
      <p className="text-sm text-gray-500">
        Cliente: acesse pelo link exclusivo que você recebeu.
      </p>
      <Link
        href="/admin"
        className="mt-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Painel do nutricionista
      </Link>
    </div>
  );
}
