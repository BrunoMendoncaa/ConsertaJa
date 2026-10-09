// Gera os scripts de instalação para colar no SQL Editor do Supabase (sem precisar da CLI):
//   supabase/instalacao/01-estrutura.sql      todas as migrations, numa transação só
//   supabase/instalacao/02-dados-de-teste.sql o seed (assistências e logins fictícios)
//
// Rode de novo sempre que criar uma migration:  npm run db:sql-instalacao
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const migDir = join(root, 'supabase', 'migrations');
const outDir = join(root, 'supabase', 'instalacao');
mkdirSync(outDir, { recursive: true });

const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
const migrations = files.map((f) => {
  const [version, ...rest] = f.replace(/\.sql$/, '').split('_');
  return { file: f, version, name: rest.join('_'), sql: readFileSync(join(migDir, f), 'utf8').trim() };
});

const header = `-- =============================================================================
-- TecnoFix · Instalação do banco (1 de 2): estrutura
-- GERADO AUTOMATICAMENTE por scripts/gerar-sql-instalacao.mjs — não edite à mão.
--
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Roda tudo numa transação: ou instala completo, ou não altera nada.
-- Também registra as migrations no histórico, então um "supabase db push"
-- futuro sabe que elas já foram aplicadas.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.assistances') is not null then
    raise exception 'O banco já foi preparado antes (a tabela public.assistances já existe). Nada foi alterado.';
  end if;
end;
$$;
`;

const body = migrations
  .map((m) => `\n-- >>> ${m.file} ${'>'.repeat(Math.max(3, 70 - m.file.length))}\n\n${m.sql}\n`)
  .join('');

const footer = `
-- >>> histórico de migrations (o mesmo que a Supabase CLI usa) >>>>>>>>>>>>>>>>>
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text not null primary key,
  statements text[],
  name       text
);
insert into supabase_migrations.schema_migrations (version, name) values
${migrations.map((m) => `  ('${m.version}', '${m.name}')`).join(',\n')}
on conflict (version) do nothing;

commit;

-- Atualiza o cache da API REST para enxergar as tabelas e funções novas.
notify pgrst, 'reload schema';
`;

writeFileSync(join(outDir, '01-estrutura.sql'), header + body + footer);

// ---------------------------------------------------------------- seed
const seed = readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8');
const guard = `begin;

do $$
begin
  if to_regclass('public.assistances') is null then
    raise exception 'Rode primeiro o 01-estrutura.sql.';
  end if;
  if exists (select 1 from auth.users where email in ('ana@techsp.dev','bruno@techsp.dev','carla@techsp.dev','diego@rapidorio.dev'))
     or exists (select 1 from public.assistances where slug in ('assistencia-tech-sp','conserta-rapido-rio')) then
    raise exception 'Os dados de teste já foram instalados antes. Nada foi alterado.';
  end if;
end;
$$;
`;
if (!/^begin;$/m.test(seed)) throw new Error('seed.sql deveria começar com "begin;"');
const seedHeader = `-- =============================================================================
-- TecnoFix · Instalação do banco (2 de 2): dados de teste (OPCIONAL)
-- GERADO AUTOMATICAMENTE por scripts/gerar-sql-instalacao.mjs — não edite à mão.
--
-- Cria 2 assistências fictícias, 4 logins (senha consertaja123), clientes,
-- OS em vários status, orçamentos e lançamentos de caixa.
-- ATENÇÃO: use só em projeto de TESTE. Em produção, não rode este arquivo
-- (as senhas são públicas, estão no README).
-- =============================================================================

`;
writeFileSync(join(outDir, '02-dados-de-teste.sql'), seedHeader + seed.replace(/^begin;$/m, () => guard));

console.log(`ok: ${migrations.length} migrations -> supabase/instalacao/01-estrutura.sql; seed -> 02-dados-de-teste.sql`);
