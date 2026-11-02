-- Predicación recurrente: la salida marcada se repite cada semana (mismo día, hora, territorios y destinatarios) mientras
-- cada territorio siga con la misma asignación (el mismo capitán) que tenía al programarla. La marca pasa a la salida
-- más reciente de la serie (lib/preaching/recurring.ts, job diario).
ALTER TABLE preaching_sessions ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0;
-- Asignación del territorio vigente al programar la salida (sin FK: el historial de asignaciones se puede borrar).
ALTER TABLE preaching_session_territories ADD COLUMN assignment_id TEXT;
