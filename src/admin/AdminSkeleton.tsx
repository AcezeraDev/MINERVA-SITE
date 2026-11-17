// Esqueleto do painel admin enquanto o pedaço lazy (AdminPanel) carrega.
// Fica num arquivo próprio e leve para não puxar o painel inteiro para o pacote inicial.
export function AdminSkeleton() {
  return (
    <section className="admin-control-room admin-skeleton min-h-screen" role="status" aria-label="Carregando painel do admin">
      <div className="grid min-h-screen lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="admin-sidebar hidden lg:block" aria-hidden="true" />
        <main className="admin-main min-w-0 px-4 pb-12 pt-5 sm:px-6 md:px-8 md:pt-8 xl:px-10" aria-hidden="true">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="admin-skel h-3 w-40" />
            <div className="admin-skel mt-3 h-10 w-64" />
            <div className="admin-skel mt-3 h-4 w-full max-w-lg" />
            <div className="mt-6 grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="admin-skel h-[7.5rem] rounded-xl" />
              ))}
            </div>
            <div className="admin-skel mt-4 h-14 rounded-xl" />
            <div className="admin-panel-card mt-6 p-4 md:p-5">
              <div className="admin-skel h-5 w-48" />
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="mt-4 flex items-center gap-3">
                  <div className="admin-skel h-9 w-9 rounded-full" />
                  <div className="admin-skel h-4 flex-1" />
                  <div className="admin-skel hidden h-4 w-24 sm:block" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
      <span className="sr-only">Carregando painel do admin…</span>
    </section>
  );
}
