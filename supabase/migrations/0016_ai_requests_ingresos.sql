-- Agrega el contador de ingresos sin modificar registros existentes.
alter table ai_requests
  add column if not exists n_ingresos int not null default 0;

comment on column ai_requests.n_ingresos is 'Ingresos registrados por la solicitud de voz';
